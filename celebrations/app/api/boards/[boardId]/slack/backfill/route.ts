import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { getSlackUser, downloadSlackFile } from '@/lib/slack';

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

  const { since, channel_id } = await req.json();
  const sinceDate = since ? new Date(since) : getStartOfMonth();
  const sinceTs = (sinceDate.getTime() / 1000).toString();

  const supabase = getServerSupabase();

  // Get linked channels for this board
  let query = supabase
    .from('cel_slack_config')
    .select('slack_channel_id, slack_channel_name')
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

  for (const config of configs) {
    const channelId = config.slack_channel_id;
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
        // Skip bot messages, subtypes (joins, pins, etc)
        if (msg.subtype || msg.bot_id) continue;
        // Skip messages with no text and no files
        if (!msg.text && (!msg.files || msg.files.length === 0)) continue;

        // Dedup check
        const { data: existing } = await supabase
          .from('cel_posts')
          .select('id')
          .eq('slack_message_ts', msg.ts)
          .maybeSingle();

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Get user info
        const user = await getSlackUser(msg.user);
        const authorName = user?.name || 'Slack User';
        const authorAvatar = user?.avatar || null;

        // Handle files
        if (msg.files && msg.files.length > 0) {
          for (const file of msg.files) {
            const isImage = file.mimetype?.startsWith('image/');
            const isVideo = file.mimetype?.startsWith('video/');
            const isGif = file.mimetype === 'image/gif';

            if (!isImage && !isVideo) continue;

            const fileBuffer = await downloadSlackFile(file.url_private_download || file.url_private);
            if (!fileBuffer) continue;

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
              text_content: msg.text || null,
              media_url: urlData.publicUrl,
              media_storage_path: storagePath,
              media_width: file.original_w || null,
              media_height: file.original_h || null,
              author_name: authorName,
              author_avatar_url: authorAvatar,
              source: 'slack',
              slack_message_ts: msg.ts,
              slack_channel_id: channelId,
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
            });
            if (!insertError) totalImported++;
          } else {
            const { error: insertError } = await supabase.from('cel_posts').insert({
              board_id: boardId,
              content_type: 'text',
              text_content: msg.text,
              author_name: authorName,
              author_avatar_url: authorAvatar,
              source: 'slack',
              slack_message_ts: msg.ts,
              slack_channel_id: channelId,
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
    skipped: totalSkipped,
    since: sinceDate.toISOString(),
  });
}

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
