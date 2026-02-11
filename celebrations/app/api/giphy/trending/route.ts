import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GIPHY not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = searchParams.get('limit') || '24';
  const offset = searchParams.get('offset') || '0';

  const res = await fetch(
    `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}&rating=pg`,
    { next: { revalidate: 300 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'GIPHY API error' }, { status: 502 });
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
}
