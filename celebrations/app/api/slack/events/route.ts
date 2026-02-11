import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { verifySlackSignature, getSlackUser, downloadSlackFile, postSlackReply } from '@/lib/slack';

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

    // Only handle messages (not bot messages or edits)
    if (
      event.type !== 'message' ||
      event.subtype ||
      event.bot_id
    ) {
      return NextResponse.json({ ok: true });
    }

    // Process asynchronously - return 200 immediately
    processSlackMessage(event).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}

async function processSlackMessage(event: any) {
  const supabase = getServerSupabase();
  const channelId = event.channel;
  const messageTs = event.ts;

  // Check if channel is linked to a board
  const { data: config } = await supabase
    .from('cel_slack_config')
    .select('board_id, cel_boards(id, slug, title, status)')
    .eq('slack_channel_id', channelId)
    .eq('is_active', true)
    .single();

  if (!config || !config.cel_boards) return;
  const board = config.cel_boards as any;
  if (board.status !== 'active') return;

  // Dedup: check if we already processed this message
  const { data: existing } = await supabase
    .from('cel_posts')
    .select('id')
    .eq('slack_message_ts', messageTs)
    .single();

  if (existing) return;

  // Get user info
  const user = await getSlackUser(event.user);
  const authorName = user?.name || 'Slack User';
  const authorAvatar = user?.avatar || null;

  // Handle files
  if (event.files && event.files.length > 0) {
    for (const file of event.files) {
      const isImage = file.mimetype?.startsWith('image/');
      const isVideo = file.mimetype?.startsWith('video/');
      const isGif = file.mimetype === 'image/gif';

      if (!isImage && !isVideo) continue;

      // Download from Slack
      const fileBuffer = await downloadSlackFile(file.url_private_download || file.url_private);
      if (!fileBuffer) continue;

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
        text_content: event.text || null,
        media_url: urlData.publicUrl,
        media_storage_path: storagePath,
        media_width: file.original_w || null,
        media_height: file.original_h || null,
        author_name: authorName,
        author_avatar_url: authorAvatar,
        source: 'slack',
        slack_message_ts: messageTs,
        slack_channel_id: channelId,
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
      });
    } else {
      // Plain text message
      await supabase.from('cel_posts').insert({
        board_id: board.id,
        content_type: 'text',
        text_content: event.text,
        author_name: authorName,
        author_avatar_url: authorAvatar,
        source: 'slack',
        slack_message_ts: messageTs,
        slack_channel_id: channelId,
      });
    }
  }

  // Reply in thread
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://celebrate.christmasair.com';
  await postSlackReply(
    channelId,
    messageTs,
    `Added to ${board.title}! View: ${appUrl}/b/${board.slug}`
  );
}
