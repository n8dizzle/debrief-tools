/**
 * Canvas-based video renderer.
 *
 * Composites branded intro, main content (video or text), overlays,
 * and outro onto a canvas, then captures the stream via MediaRecorder
 * to produce a downloadable WebM file.
 */

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

const BRAND = {
  green: '#5D8A66',
  greenDark: '#4A7053',
  cream: '#F5F0E1',
  gold: '#B8956B',
  dark: '#0F1210',
  darkSecondary: '#161B18',
};

interface RenderOptions {
  durationInSeconds: number;
  introLabel: string;
  onProgress: (pct: number) => void;
}

interface BrandedVideoRenderOptions extends RenderOptions {
  type: 'branded-video';
  videoElement: HTMLVideoElement;
  speakerName: string;
  speakerTitle: string;
  showLowerThird: boolean;
  showWatermark: boolean;
}

interface TextTemplateRenderOptions extends RenderOptions {
  type: 'team-update' | 'shoutout' | 'announcement';
  // team-update
  title?: string;
  speakerName?: string;
  speakerTitle?: string;
  message?: string;
  // shoutout
  recipientName?: string;
  fromName?: string;
  fromTitle?: string;
  // announcement
  headline?: string;
  body?: string;
}

export type AllRenderOptions = BrandedVideoRenderOptions | TextTemplateRenderOptions;

export async function renderVideoToBlob(options: AllRenderOptions): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  const canvasStream = canvas.captureStream(FPS);

  // Combine canvas video track with audio from the source video
  const combinedStream = new MediaStream();

  // Add canvas video track
  for (const track of canvasStream.getVideoTracks()) {
    combinedStream.addTrack(track);
  }

  // If branded video, extract audio from the video element
  let audioContext: AudioContext | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;

  if (options.type === 'branded-video' && options.videoElement) {
    try {
      audioContext = new AudioContext();
      audioDestination = audioContext.createMediaStreamDestination();
      audioSource = audioContext.createMediaElementSource(options.videoElement);
      audioSource.connect(audioDestination);
      // Also connect to speakers so we can hear during render (optional)
      audioSource.connect(audioContext.destination);

      for (const track of audioDestination.stream.getAudioTracks()) {
        combinedStream.addTrack(track);
      }
    } catch (e) {
      console.warn('Could not capture audio:', e);
    }
  }

  const chunks: Blob[] = [];

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      // Cleanup audio
      if (audioSource) {
        audioSource.disconnect();
      }
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start();

  const totalFrames = options.durationInSeconds * FPS;
  const introFrames = 2 * FPS; // 2s intro
  const outroFrames = 2 * FPS; // 2s outro
  const mainFrames = totalFrames - introFrames - outroFrames;

  // If video source, wait for metadata then seek to start
  if (options.type === 'branded-video') {
    const vid = options.videoElement;
    vid.pause();

    // Ensure metadata is loaded so duration is available
    if (!vid.duration || !isFinite(vid.duration)) {
      vid.preload = 'auto';
      vid.load();
      await new Promise<void>((resolve) => {
        if (vid.readyState >= 1 && isFinite(vid.duration)) {
          resolve();
          return;
        }
        const onLoaded = () => {
          vid.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        vid.addEventListener('loadedmetadata', onLoaded);
        // Timeout fallback
        setTimeout(resolve, 5000);
      });
    }

    vid.currentTime = 0;
  }

  // --- Render intro (no audio plays during intro) ---
  for (let frame = 0; frame < introFrames; frame++) {
    drawIntro(ctx, frame, introFrames, options.introLabel);
    options.onProgress(Math.round((frame / totalFrames) * 100));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }

  // --- Render main content ---
  if (options.type === 'branded-video') {
    // Play video in real-time so audio is captured
    const vid = options.videoElement;
    vid.muted = false;
    vid.volume = 1;
    vid.currentTime = 0;
    vid.play().catch(() => {});

    for (let frame = 0; frame < mainFrames; frame++) {
      drawBrandedVideoFrame(ctx, frame, mainFrames, options);
      options.onProgress(Math.round(((introFrames + frame) / totalFrames) * 100));
      await new Promise((r) => setTimeout(r, 1000 / FPS));
    }

    vid.pause();
  } else {
    for (let frame = 0; frame < mainFrames; frame++) {
      drawTextFrame(ctx, frame, mainFrames, options);
      options.onProgress(Math.round(((introFrames + frame) / totalFrames) * 100));
      await new Promise((r) => setTimeout(r, 1000 / FPS));
    }
  }

  // --- Render outro (no audio) ---
  for (let frame = 0; frame < outroFrames; frame++) {
    drawOutro(ctx, frame, outroFrames);
    options.onProgress(Math.round(((introFrames + mainFrames + frame) / totalFrames) * 100));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }

  recorder.stop();
  return done;
}

// ─── Intro ───────────────────────────────────────────────────

function drawIntro(ctx: CanvasRenderingContext2D, frame: number, totalFrames: number, label: string) {
  ctx.fillStyle = BRAND.dark;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const progress = frame / totalFrames;

  // Logo box
  const logoScale = clamp(progress * 3, 0, 1);
  const logoSize = 100 * logoScale;
  const logoX = WIDTH / 2 - logoSize / 2;
  const logoY = HEIGHT / 2 - 120 - logoSize / 2;

  ctx.fillStyle = BRAND.green;
  roundRect(ctx, logoX, logoY, logoSize, logoSize, 24 * logoScale);
  ctx.fill();

  // Video icon in logo
  if (logoScale > 0.5) {
    ctx.strokeStyle = BRAND.cream;
    ctx.lineWidth = 3;
    const iconSize = logoSize * 0.5;
    const ix = WIDTH / 2 - iconSize / 2;
    const iy = HEIGHT / 2 - 120 - iconSize / 2;
    ctx.strokeRect(ix, iy, iconSize * 0.7, iconSize);
    // Play triangle
    ctx.beginPath();
    ctx.moveTo(ix + iconSize * 0.75, iy + iconSize * 0.3);
    ctx.lineTo(ix + iconSize, iy + iconSize * 0.5);
    ctx.lineTo(ix + iconSize * 0.75, iy + iconSize * 0.7);
    ctx.closePath();
    ctx.stroke();
  }

  // Company name
  const textOpacity = clamp((progress - 0.25) * 4, 0, 1);
  if (textOpacity > 0) {
    ctx.globalAlpha = textOpacity;
    ctx.fillStyle = BRAND.cream;
    ctx.font = '700 52px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Christmas Air', WIDTH / 2, HEIGHT / 2 + 20);
    ctx.globalAlpha = 1;
  }

  // Divider line
  const lineWidth = clamp((progress - 0.4) * 5, 0, 1) * 300;
  if (lineWidth > 0) {
    ctx.fillStyle = BRAND.green;
    ctx.fillRect(WIDTH / 2 - lineWidth / 2, HEIGHT / 2 + 40, lineWidth, 3);
  }

  // Label
  const labelOpacity = clamp((progress - 0.6) * 4, 0, 1);
  if (labelOpacity > 0) {
    ctx.globalAlpha = labelOpacity;
    ctx.fillStyle = BRAND.gold;
    ctx.font = '500 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText(label.toUpperCase(), WIDTH / 2, HEIGHT / 2 + 85);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
  }
}

// ─── Branded Video Frame ─────────────────────────────────────

function drawBrandedVideoFrame(
  ctx: CanvasRenderingContext2D,
  frame: number,
  totalFrames: number,
  opts: BrandedVideoRenderOptions
) {
  const fadeIn = clamp(frame / 15, 0, 1);
  ctx.globalAlpha = fadeIn;

  // Draw video frame
  try {
    ctx.drawImage(opts.videoElement, 0, 0, WIDTH, HEIGHT);
  } catch {
    ctx.fillStyle = BRAND.dark;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  ctx.globalAlpha = 1;

  // Gradient overlay for lower third readability
  if (opts.showLowerThird && opts.speakerName) {
    const gradient = ctx.createLinearGradient(0, HEIGHT * 0.7, 0, HEIGHT);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, HEIGHT * 0.7, WIDTH, HEIGHT * 0.3);
  }

  // Logo watermark
  if (opts.showWatermark && frame > 15) {
    drawWatermark(ctx, clamp((frame - 15) / 15, 0, 0.6));
  }

  // Lower third
  if (opts.showLowerThird && opts.speakerName && frame > 20) {
    drawLowerThird(ctx, opts.speakerName, opts.speakerTitle, clamp((frame - 20) / 15, 0, 1));
  }

  // Video plays in real-time — no seeking needed, just draw current frame
}

// ─── Text Template Frame ─────────────────────────────────────

function drawTextFrame(
  ctx: CanvasRenderingContext2D,
  frame: number,
  totalFrames: number,
  opts: TextTemplateRenderOptions
) {
  // Background
  const grd = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grd.addColorStop(0, BRAND.dark);
  grd.addColorStop(0.5, BRAND.darkSecondary);
  grd.addColorStop(1, '#1C231E');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Green accent bar (left)
  ctx.fillStyle = BRAND.green;
  ctx.fillRect(0, 0, 8, HEIGHT);

  // Watermark
  if (frame > 15) {
    drawWatermark(ctx, clamp((frame - 15) / 15, 0, 0.6));
  }

  if (opts.type === 'team-update') {
    drawTeamUpdate(ctx, frame, opts);
  } else if (opts.type === 'shoutout') {
    drawShoutout(ctx, frame, opts);
  } else if (opts.type === 'announcement') {
    drawAnnouncement(ctx, frame, opts);
  }
}

function drawTeamUpdate(ctx: CanvasRenderingContext2D, frame: number, opts: TextTemplateRenderOptions) {
  // Title
  const titleOpacity = clamp(frame / 20, 0, 1);
  ctx.globalAlpha = titleOpacity;
  ctx.fillStyle = BRAND.cream;
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.textAlign = 'left';
  wrapText(ctx, opts.title || '', 80, 200, WIDTH - 160, 80);
  ctx.globalAlpha = 1;

  // Message
  const msgOpacity = clamp((frame - 20) / 20, 0, 1);
  if (msgOpacity > 0) {
    ctx.globalAlpha = msgOpacity * 0.85;
    ctx.fillStyle = BRAND.cream;
    ctx.font = '400 36px system-ui, sans-serif';
    wrapText(ctx, opts.message || '', 80, 360, WIDTH - 280, 52);
    ctx.globalAlpha = 1;
  }

  // Lower third
  if (opts.speakerName && frame > 10) {
    drawLowerThird(ctx, opts.speakerName, opts.speakerTitle || '', clamp((frame - 10) / 15, 0, 1));
  }
}

function drawShoutout(ctx: CanvasRenderingContext2D, frame: number, opts: TextTemplateRenderOptions) {
  // Star circle
  const starScale = clamp(frame / 20, 0, 1);
  if (starScale > 0) {
    ctx.fillStyle = 'rgba(184, 149, 107, 0.2)';
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 200, 45 * starScale, 0, Math.PI * 2);
    ctx.fill();

    // Star (simplified)
    ctx.fillStyle = BRAND.gold;
    ctx.font = `${50 * starScale}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText('\u2605', WIDTH / 2, 215);
  }

  // Recipient name
  const nameOpacity = clamp((frame - 10) / 15, 0, 1);
  if (nameOpacity > 0) {
    ctx.globalAlpha = nameOpacity;
    ctx.fillStyle = BRAND.gold;
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.recipientName || '', WIDTH / 2, 320);
    ctx.globalAlpha = 1;
  }

  // Message
  const msgOpacity = clamp((frame - 25) / 20, 0, 1);
  if (msgOpacity > 0) {
    ctx.globalAlpha = msgOpacity;
    ctx.fillStyle = BRAND.cream;
    ctx.font = 'italic 400 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, `\u201C${opts.message || ''}\u201D`, 120, 420, WIDTH - 240, 52);
    ctx.globalAlpha = 1;
  }

  // From
  const fromOpacity = clamp((frame - 40) / 15, 0, 1);
  if (fromOpacity > 0) {
    ctx.globalAlpha = fromOpacity * 0.7;
    ctx.fillStyle = BRAND.cream;
    ctx.font = '500 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`\u2014 ${opts.fromName || ''}, ${opts.fromTitle || ''}`, WIDTH / 2, HEIGHT - 120);
    ctx.globalAlpha = 1;
  }
}

function drawAnnouncement(ctx: CanvasRenderingContext2D, frame: number, opts: TextTemplateRenderOptions) {
  // Green banner bar
  const bannerWidth = clamp(frame / 25, 0, 1) * WIDTH;
  ctx.fillStyle = BRAND.green;
  ctx.fillRect(0, 140, bannerWidth, 6);

  // Headline
  const headlineOpacity = clamp((frame - 15) / 15, 0, 1);
  if (headlineOpacity > 0) {
    ctx.globalAlpha = headlineOpacity;
    ctx.fillStyle = BRAND.cream;
    ctx.font = '800 72px system-ui, sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, opts.headline || '', 80, 240, WIDTH - 160, 86);
    ctx.globalAlpha = 1;
  }

  // Body
  const bodyOpacity = clamp((frame - 30) / 20, 0, 1);
  if (bodyOpacity > 0) {
    ctx.globalAlpha = bodyOpacity * 0.8;
    ctx.fillStyle = BRAND.cream;
    ctx.font = '400 32px system-ui, sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, opts.body || '', 80, 460, WIDTH - 280, 48);
    ctx.globalAlpha = 1;
  }

  // Lower third
  if (opts.speakerName && frame > 10) {
    drawLowerThird(ctx, opts.speakerName, opts.speakerTitle || '', clamp((frame - 10) / 15, 0, 1));
  }
}

// ─── Outro ───────────────────────────────────────────────────

function drawOutro(ctx: CanvasRenderingContext2D, frame: number, totalFrames: number) {
  ctx.fillStyle = BRAND.dark;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const fadeIn = clamp(frame / 20, 0, 1);
  const fadeOut = clamp((totalFrames - frame) / 20, 0, 1);
  ctx.globalAlpha = Math.min(fadeIn, fadeOut);

  // Logo
  const logoSize = 70;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 - 40;

  ctx.fillStyle = BRAND.green;
  roundRect(ctx, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize, 18);
  ctx.fill();

  // Video icon
  ctx.strokeStyle = BRAND.cream;
  ctx.lineWidth = 2.5;
  const is = logoSize * 0.45;
  ctx.strokeRect(cx - is / 2, cy - is * 0.35, is * 0.65, is * 0.7);
  ctx.beginPath();
  ctx.moveTo(cx + is * 0.15, cy - is * 0.15);
  ctx.lineTo(cx + is * 0.4, cy);
  ctx.lineTo(cx + is * 0.15, cy + is * 0.15);
  ctx.closePath();
  ctx.stroke();

  // Company name
  ctx.fillStyle = BRAND.cream;
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Christmas Air', cx, cy + 60);

  // Tagline
  ctx.fillStyle = BRAND.gold;
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('COMFORT IN EVERY SEASON', cx, cy + 90);
  ctx.letterSpacing = '0px';

  ctx.globalAlpha = 1;
}

// ─── Shared Drawing Helpers ──────────────────────────────────

function drawWatermark(ctx: CanvasRenderingContext2D, opacity: number) {
  ctx.globalAlpha = opacity;

  // Logo box
  ctx.fillStyle = BRAND.green;
  roundRect(ctx, WIDTH - 200, 40, 44, 44, 10);
  ctx.fill();

  // Text
  ctx.fillStyle = BRAND.cream;
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Christmas Air', WIDTH - 148, 68);

  ctx.globalAlpha = 1;
}

function drawLowerThird(ctx: CanvasRenderingContext2D, name: string, title: string, progress: number) {
  const slideX = (1 - progress) * 100;
  ctx.globalAlpha = progress;

  // Name bar
  ctx.fillStyle = BRAND.green;
  const nameWidth = ctx.measureText(name).width || 200;
  ctx.font = '700 36px system-ui, sans-serif';
  const measuredWidth = ctx.measureText(name).width;
  const barWidth = measuredWidth + 56;
  roundRect(ctx, 60 - slideX, HEIGHT - 160, barWidth, 56, 8);
  ctx.fill();

  ctx.fillStyle = BRAND.cream;
  ctx.textAlign = 'left';
  ctx.fillText(name, 88 - slideX, HEIGHT - 120);

  // Title bar
  if (title) {
    ctx.fillStyle = BRAND.dark;
    ctx.font = '400 22px system-ui, sans-serif';
    const titleWidth = ctx.measureText(title).width + 56;
    roundRect(ctx, 60 - slideX, HEIGHT - 104, titleWidth, 40, 8);
    ctx.fill();

    // Title bar border
    ctx.strokeStyle = BRAND.green;
    ctx.lineWidth = 2;
    roundRect(ctx, 60 - slideX, HEIGHT - 104, titleWidth, 40, 8);
    ctx.stroke();

    ctx.fillStyle = BRAND.cream;
    ctx.globalAlpha = progress * 0.85;
    ctx.fillText(title, 88 - slideX, HEIGHT - 78);
  }

  ctx.globalAlpha = 1;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  const align = ctx.textAlign;

  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      const drawX = align === 'center' ? x + maxWidth / 2 : x;
      ctx.fillText(line, drawX, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    const drawX = align === 'center' ? x + maxWidth / 2 : x;
    ctx.fillText(line, drawX, currentY);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
