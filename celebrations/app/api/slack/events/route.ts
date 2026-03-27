import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { verifySlackSignature, getSlackUser, downloadSlackFile, shouldImportMessage, formatSlackText } from '@/lib/slack';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = req.headers.get('x-slack-request-timestamp') || '';
  const signature = req.headers.get('x-slack-signature') || '';

  // Verify signature
  if (!verifySlackSignature(signature, timestamp, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Handle URL verification challenge
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Handle events
  if (body.type === 'event_callback') {
    const event = body.event;

    // Only handle messages (not bot messages or edits) — except GIPHY bot
    const isGiphyBot = event.bot_profile?.name?.toLowerCase() === 'giphy' ||
      event.username === 'Giphy' ||
      (event.blocks || event.attachments || []).some((b: any) =>
        JSON.stringify(b).includes('giphy.com')
      );
    if (
      event.type !== 'message' ||
      (event.subtype && !isGiphyBot) ||
      (event.bot_id && !isGiphyBot)
    ) {
      return NextResponse.json({ ok: true });
    }

    // Use after() to keep the serverless function alive after responding to Slack.
    // Without this, Vercel freezes/terminates the function once the response is sent,
    // killing the async processing before it completes.
    after(async () => {
      try {
        await processSlackMessage(event);
      } catch (err) {
        console.error('Failed to process Slack message:', err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Extract a GIPHY URL from a Slack bot message.
 * GIPHY bot puts the URL in attachments, blocks, or sometimes text.
 */
function extractGiphyUrl(event: any): string | null {
  const giphyPattern = /https:\/\/media\d*\.giphy\.com\/media\/[^\s>"]+/;

  // Check attachments (most common for /giphy)
  if (event.attachments) {
    for (const att of event.attachments) {
      const match = (att.image_url || att.thumb_url || att.fallback || '').match(giphyPattern);
      if (match) return match[0];
      // Also check from_url
      if (att.from_url && att.from_url.includes('giphy.com')) {
        const urlMatch = att.image_url || att.thumb_url;
        if (urlMatch) return urlMatch;
      }
    }
  }

  // Check blocks
  if (event.blocks) {
    const blockStr = JSON.stringify(event.blocks);
    const match = blockStr.match(giphyPattern);
    if (match) return match[0];
  }

  // Check text as fallback
  if (event.text) {
    const match = event.text.match(giphyPattern);
    if (match) return match[0];
  }

  return null;
}

function slackTsToIso(ts: string): string {
  return new Date(parseFloat(ts) * 1000).toISOString();
}

async function processSlackMessage(event: any) {
  const supabase = getServerSupabase();
  const channelId = event.channel;
  const messageTs = event.ts;

  // Check if channel is linked to a board
  const { data: config } = await supabase
    .from('cel_slack_config')
    .select('board_id, import_filters, cel_boards(id, slug, title, status)')
    .eq('slack_channel_id', channelId)
    .eq('is_active', true)
    .single();

  if (!config || !config.cel_boards) return;
  const board = config.cel_boards as any;
  if (board.status !== 'active') return;

  // Apply import filters (cheap checks only — skip reaction filters for real-time messages)
  const filters = (config as any).import_filters || {};
  if (filters.media_only || filters.keywords_include?.length || filters.keywords_exclude?.length) {
    const result = shouldImportMessage(event, filters);
    if (result === false) return;
  }

  // Dedup: check if we already processed this message (scoped to this board)
  const { data: existing } = await supabase
    .from('cel_posts')
    .select('id')
    .eq('board_id', board.id)
    .eq('slack_message_ts', messageTs)
    .single();

  if (existing) return;

  // Get user info — for bot messages, try to get the user who triggered the command
  let authorName = 'Slack User';
  let authorAvatar: string | null = null;
  if (event.user) {
    const user = await getSlackUser(event.user);
    authorName = user?.name || authorName;
    authorAvatar = user?.avatar || null;
  } else if (event.username) {
    authorName = event.username;
  }

  // Check for GIPHY bot message — extract GIF URL from attachments/blocks
  const giphyUrl = extractGiphyUrl(event);
  if (giphyUrl) {
    await supabase.from('cel_posts').insert({
      board_id: board.id,
      content_type: 'gif',
      media_url: giphyUrl,
      author_name: authorName,
      author_avatar_url: authorAvatar,
      source: 'slack',
      slack_message_ts: messageTs,
      slack_channel_id: channelId,
      status: 'pending',
      created_at: slackTsToIso(messageTs),
    });
    return;
  }

  // Format Slack markup in text (emojis, @mentions, channels, links)
  const formattedText = event.text ? await formatSlackText(event.text) : null;

  // Handle files
  if (event.files && event.files.length > 0) {
    console.log(`Slack message has ${event.files.length} file(s):`, event.files.map((f: any) => ({
      name: f.name, mimetype: f.mimetype, mode: f.mode,
      has_url_private: !!f.url_private, has_url_download: !!f.url_private_download,
    })));
    for (const file of event.files) {
      const isImage = file.mimetype?.startsWith('image/');
      const isVideo = file.mimetype?.startsWith('video/');
      const isGif = file.mimetype === 'image/gif';

      if (!isImage && !isVideo) {
        console.log(`Skipping non-media file: ${file.name} (${file.mimetype})`);
        continue;
      }

      // Download from Slack
      const downloadUrl = file.url_private_download || file.url_private;
      console.log(`Downloading Slack file: ${file.name} from ${downloadUrl?.substring(0, 80)}...`);
      const fileBuffer = await downloadSlackFile(downloadUrl);
      if (!fileBuffer) {
        console.error(`Failed to download Slack file: ${file.name}`);
        continue;
      }
      console.log(`Downloaded ${file.name}: ${fileBuffer.length} bytes`);

      // Upload to Supabase
      const ext = file.name?.split('.').pop() || 'bin';
      const random = Math.random().toString(36).slice(2, 10);
      const storagePath = `boards/${board.id}/${Date.now()}-${random}.${ext}`;

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

      await supabase.from('cel_posts').insert({
        board_id: board.id,
        content_type: isGif ? 'gif' : isVideo ? 'video' : 'photo',
        text_content: formattedText,
        media_url: urlData.publicUrl,
        media_storage_path: storagePath,
        media_width: file.original_w || null,
        media_height: file.original_h || null,
        author_name: authorName,
        author_avatar_url: authorAvatar,
        source: 'slack',
        slack_message_ts: messageTs,
        slack_channel_id: channelId,
        status: 'pending',
        created_at: slackTsToIso(messageTs),
      });
    }
  } else if (event.text) {
    // Check for GIPHY URLs
    const giphyMatch = event.text.match(/https:\/\/media\d*\.giphy\.com\/media\/[^\s>]+/);

    if (giphyMatch) {
      await supabase.from('cel_posts').insert({
        board_id: board.id,
        content_type: 'gif',
        media_url: giphyMatch[0],
        author_name: authorName,
        author_avatar_url: authorAvatar,
        source: 'slack',
        slack_message_ts: messageTs,
        slack_channel_id: channelId,
        status: 'pending',
        created_at: slackTsToIso(messageTs),
      });
    } else {
      // Plain text message
      await supabase.from('cel_posts').insert({
        board_id: board.id,
        content_type: 'text',
        text_content: formattedText,
        author_name: authorName,
        author_avatar_url: authorAvatar,
        source: 'slack',
        slack_message_ts: messageTs,
        slack_channel_id: channelId,
        status: 'pending',
        created_at: slackTsToIso(messageTs),
      });
    }
  }

}
