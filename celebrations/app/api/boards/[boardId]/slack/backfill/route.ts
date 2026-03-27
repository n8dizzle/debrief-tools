import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase, SlackImportFilters } from '@/lib/supabase';
import { getSlackUser, downloadSlackFile, shouldImportMessage, passesReactionFilter, formatSlackText } from '@/lib/slack';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

// POST /api/boards/[boardId]/slack/backfill - Pull historical messages from linked channel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'owner' && role !== 'manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: 'Slack not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { since, channel_id, filters: requestFilters, re_import } = body;
  const sinceDate = since ? new Date(since) : getStartOfMonth();
  const sinceTs = (sinceDate.getTime() / 1000).toString();

  const supabase = getServerSupabase();

  // Get linked channels for this board (with import_filters)
  let query = supabase
    .from('cel_slack_config')
    .select('slack_channel_id, slack_channel_name, import_filters')
    .eq('board_id', boardId)
    .eq('is_active', true);

  if (channel_id) {
    query = query.eq('slack_channel_id', channel_id);
  }

  const { data: configs } = await query;

  if (!configs || configs.length === 0) {
    return NextResponse.json({ error: 'No Slack channels linked to this board' }, { status: 400 });
  }

  let totalImported = 0;
  let totalSkipped = 0;
  let totalUpdated = 0;
  let totalFiltered = 0;

  for (const config of configs) {
    const channelId = config.slack_channel_id;
    const filters: SlackImportFilters = requestFilters || (config as any).import_filters || {};
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      // Fetch message history
      const url = new URL('https://slack.com/api/conversations.history');
      url.searchParams.set('channel', channelId);
      url.searchParams.set('oldest', sinceTs);
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
      });

      if (!res.ok) {
        console.error('Slack API error:', res.status);
        break;
      }

      const data = await res.json();
      if (!data.ok) {
        console.error('Slack API error:', data.error);
        return NextResponse.json({ error: `Slack error: ${data.error}` }, { status: 502 });
      }

      const messages = data.messages || [];

      for (const msg of messages) {
        // Allow GIPHY bot messages, skip other bots/subtypes
        const isGiphyBot = msg.bot_profile?.name?.toLowerCase() === 'giphy' ||
          msg.username === 'Giphy' ||
          (msg.attachments || []).some((a: any) => (a.image_url || '').includes('giphy.com'));
        if ((msg.subtype || msg.bot_id) && !isGiphyBot) continue;
        // Skip messages with no text, no files, and no giphy attachment
        if (!msg.text && (!msg.files || msg.files.length === 0) && !isGiphyBot) continue;

        // Apply import filters (cheap checks first)
        const hasFilters = filters.media_only || filters.keywords_include?.length || filters.keywords_exclude?.length || filters.min_reactions || filters.reaction_emojis?.length;
        if (hasFilters) {
          const cheapResult = shouldImportMessage(msg, filters);
          if (cheapResult === false) {
            totalFiltered++;
            continue;
          }
          // Expensive reaction filter (API call per message)
          if (filters.min_reactions || filters.reaction_emojis?.length) {
            const passesReaction = await passesReactionFilter(channelId, msg.ts, filters);
            if (!passesReaction) {
              totalFiltered++;
              continue;
            }
          }
        }

        // Dedup check (scoped to this board)
        const { data: existing } = await supabase
          .from('cel_posts')
          .select('id')
          .eq('board_id', boardId)
          .eq('slack_message_ts', msg.ts)
          .maybeSingle();

        if (existing && !re_import) {
          totalSkipped++;
          continue;
        }

        // Get user info — for bot messages, use username fallback
        let authorName = 'Slack User';
        let authorAvatar: string | null = null;
        if (msg.user) {
          const user = await getSlackUser(msg.user);
          authorName = user?.name || authorName;
          authorAvatar = user?.avatar || null;
        } else if (msg.username) {
          authorName = msg.username;
        }

        // Format Slack markup in text (emojis, @mentions, channels, links)
        const formattedText = msg.text ? await formatSlackText(msg.text) : null;

        // Re-import: update existing post's text, author, status, and timestamp
        if (existing && re_import) {
          await supabase
            .from('cel_posts')
            .update({
              text_content: formattedText,
              author_name: authorName,
              author_avatar_url: authorAvatar,
              status: 'pending',
              created_at: slackTsToIso(msg.ts),
            })
            .eq('id', existing.id);
          totalUpdated++;
          continue;
        }

        // Check for GIPHY bot attachments first
        const giphyAttachmentUrl = extractGiphyUrlFromMsg(msg);
        if (giphyAttachmentUrl) {
          const { error: insertError } = await supabase.from('cel_posts').insert({
            board_id: boardId,
            content_type: 'gif',
            media_url: giphyAttachmentUrl,
            author_name: authorName,
            author_avatar_url: authorAvatar,
            source: 'slack',
            slack_message_ts: msg.ts,
            slack_channel_id: channelId,
            status: 'pending',
            created_at: slackTsToIso(msg.ts),
          });
          if (!insertError) totalImported++;
          continue;
        }

        // Handle files
        if (msg.files && msg.files.length > 0) {
          console.log(`Backfill: message ${msg.ts} has ${msg.files.length} file(s):`, msg.files.map((f: any) => ({
            name: f.name, mimetype: f.mimetype, mode: f.mode,
            has_url_private: !!f.url_private, has_url_download: !!f.url_private_download,
          })));
          for (const file of msg.files) {
            const isImage = file.mimetype?.startsWith('image/');
            const isVideo = file.mimetype?.startsWith('video/');
            const isGif = file.mimetype === 'image/gif';

            if (!isImage && !isVideo) {
              console.log(`Backfill: Skipping non-media file: ${file.name} (${file.mimetype})`);
              continue;
            }

            const downloadUrl = file.url_private_download || file.url_private;
            console.log(`Backfill: Downloading ${file.name} from ${downloadUrl?.substring(0, 80)}...`);
            const fileBuffer = await downloadSlackFile(downloadUrl);
            if (!fileBuffer) {
              console.error(`Backfill: Failed to download file: ${file.name}`);
              continue;
            }
            console.log(`Backfill: Downloaded ${file.name}: ${fileBuffer.length} bytes`);

            const ext = file.name?.split('.').pop() || 'bin';
            const random = Math.random().toString(36).slice(2, 10);
            const storagePath = `boards/${boardId}/${Date.now()}-${random}.${ext}`;

            const { error: uploadError } = await supabase.storage
              .from('celebrations-media')
              .upload(storagePath, fileBuffer, {
                contentType: file.mimetype,
                upsert: false,
              });

            if (uploadError) {
              console.error('Failed to upload Slack file:', uploadError);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from('celebrations-media')
              .getPublicUrl(storagePath);

            const { error: insertError } = await supabase.from('cel_posts').insert({
              board_id: boardId,
              content_type: isGif ? 'gif' : isVideo ? 'video' : 'photo',
              text_content: formattedText,
              media_url: urlData.publicUrl,
              media_storage_path: storagePath,
              media_width: file.original_w || null,
              media_height: file.original_h || null,
              author_name: authorName,
              author_avatar_url: authorAvatar,
              source: 'slack',
              slack_message_ts: msg.ts,
              slack_channel_id: channelId,
              status: 'pending',
              created_at: slackTsToIso(msg.ts),
            });

            if (!insertError) totalImported++;
          }
        } else if (msg.text) {
          // Check for GIPHY URLs
          const giphyMatch = msg.text.match(/https:\/\/media\d*\.giphy\.com\/media\/[^\s>]+/);

          if (giphyMatch) {
            const { error: insertError } = await supabase.from('cel_posts').insert({
              board_id: boardId,
              content_type: 'gif',
              media_url: giphyMatch[0],
              author_name: authorName,
              author_avatar_url: authorAvatar,
              source: 'slack',
              slack_message_ts: msg.ts,
              slack_channel_id: channelId,
              status: 'pending',
              created_at: slackTsToIso(msg.ts),
            });
            if (!insertError) totalImported++;
          } else {
            const { error: insertError } = await supabase.from('cel_posts').insert({
              board_id: boardId,
              content_type: 'text',
              text_content: formattedText,
              author_name: authorName,
              author_avatar_url: authorAvatar,
              source: 'slack',
              slack_message_ts: msg.ts,
              slack_channel_id: channelId,
              status: 'pending',
              created_at: slackTsToIso(msg.ts),
            });
            if (!insertError) totalImported++;
          }
        }
      }

      // Pagination
      cursor = data.response_metadata?.next_cursor;
      hasMore = !!cursor;
    }
  }

  return NextResponse.json({
    imported: totalImported,
    updated: totalUpdated,
    skipped: totalSkipped,
    filtered: totalFiltered,
    since: sinceDate.toISOString(),
  });
}

/**
 * Extract a GIPHY URL from a Slack message's attachments, blocks, or text.
 * Returns null if no GIPHY URL found.
 */
function extractGiphyUrlFromMsg(msg: any): string | null {
  const giphyPattern = /https:\/\/media\d*\.giphy\.com\/media\/[^\s>"]+/;

  if (msg.attachments) {
    for (const att of msg.attachments) {
      const match = (att.image_url || att.thumb_url || att.fallback || '').match(giphyPattern);
      if (match) return match[0];
    }
  }

  if (msg.blocks) {
    const blockStr = JSON.stringify(msg.blocks);
    const match = blockStr.match(giphyPattern);
    if (match) return match[0];
  }

  return null;
}

function slackTsToIso(ts: string): string {
  return new Date(parseFloat(ts) * 1000).toISOString();
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
