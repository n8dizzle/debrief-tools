import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GIPHY not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '24';
    const offset = searchParams.get('offset') || '0';

    if (!q.trim()) {
      return NextResponse.json({ gifs: [] });
    }

    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=pg&lang=en`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error('GIPHY search error:', res.status, text);
      return NextResponse.json({ error: 'GIPHY API error', status: res.status, detail: text }, { status: 502 });
    }

    const data = await res.json();
    const gifs = (data.data || []).map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      url: gif.images.original.url,
      thumbnail: gif.images.fixed_width_still?.url || gif.images.fixed_width?.url,
      preview: gif.images.fixed_width?.url,
      width: parseInt(gif.images.original.width),
      height: parseInt(gif.images.original.height),
    }));

    return NextResponse.json({ gifs });
  } catch (err: any) {
    console.error('GIPHY search exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
