import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import convert from 'heic-convert';
import { getServerSupabase } from '@/lib/supabase';

// Public, token-gated photo upload for a recall investigation — no login.
// The photo_upload_token on sd_recall_investigations is the secret. Exempt from the
// auth middleware (see middleware.ts matcher: /upload and /api/public).

// heic-convert is pure JS (no native deps) but still needs the Node runtime + a few
// seconds of headroom for large iPhone photos.
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
};

// iOS sometimes sends HEIC with an empty MIME type — fall back to the filename extension.
function detectType(file: File): string {
  if (file.type) return file.type;
  const n = (file.name || '').toLowerCase();
  if (n.endsWith('.heic')) return 'image/heic';
  if (n.endsWith('.heif')) return 'image/heif';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  return '';
}

async function resolve(token: string) {
  if (!token) return null;
  const supabase = getServerSupabase();
  const { data: inv } = await supabase
    .from('sd_recall_investigations')
    .select('id, st_recall_job_id')
    .eq('photo_upload_token', token)
    .maybeSingle();
  return inv ?? null;
}

// GET /api/public/upload?token=... → minimal context so the page can show what this is for
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const inv = await resolve(token);
  if (!inv) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });

  const supabase = getServerSupabase();
  const { data: recall } = await supabase
    .from('sd_recalls_caused')
    .select('customer_name')
    .eq('st_recall_job_id', inv.st_recall_job_id).maybeSingle();
  const { count } = await supabase
    .from('sd_recall_photos')
    .select('id', { count: 'exact', head: true })
    .eq('investigation_id', inv.id);

  return NextResponse.json({
    job_id: inv.st_recall_job_id,
    customer_name: recall?.customer_name ?? null,
    uploaded: count ?? 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/public/upload?token=...  (multipart form, field "file")
export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const inv = await resolve(token);
  if (!inv) return NextResponse.json({ error: 'This link is no longer valid.' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });

  const type = detectType(file);
  let ext = ALLOWED[type];
  if (!ext) return NextResponse.json({ error: 'Please upload a photo (JPG, PNG, WEBP, or HEIC).' }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: 'That file was empty.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Photo is too large (max 15 MB).' }, { status: 413 });

  let buffer = Buffer.from(await file.arrayBuffer());
  let contentType = type;

  // HEIC/HEIF (typical iPhone photos) don't render inline in most desktop browsers —
  // transcode to JPEG on the way in so thumbnails always show on the RCA page.
  if (type === 'image/heic' || type === 'image/heif') {
    try {
      const jpeg = await convert({ buffer: new Uint8Array(buffer), format: 'JPEG', quality: 0.9 });
      buffer = Buffer.from(jpeg);
      contentType = 'image/jpeg';
      ext = 'jpg';
    } catch {
      return NextResponse.json({ error: 'Could not process that photo. Try again, or use JPEG.' }, { status: 422 });
    }
  }

  const supabase = getServerSupabase();
  const path = `${inv.id}/${randomBytes(12).toString('hex')}.${ext}`;
  const { error: upErr } = await supabase.storage.from('recall-photos').upload(path, buffer, { contentType, upsert: false });
  if (upErr) return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 });

  const { error: rowErr } = await supabase.from('sd_recall_photos').insert({
    investigation_id: inv.id, st_recall_job_id: inv.st_recall_job_id, storage_path: path, content_type: contentType,
  });
  if (rowErr) {
    await supabase.storage.from('recall-photos').remove([path]); // don't orphan the object
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 });
  }

  await supabase.from('sd_recall_activity').insert({ investigation_id: inv.id, actor: null, action: 'photo_uploaded' });
  return NextResponse.json({ ok: true });
}
