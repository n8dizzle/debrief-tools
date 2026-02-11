import { getServerSupabase } from '@/lib/supabase';
import { notFound, redirect } from 'next/navigation';
import PublicBoardView from './PublicBoardView';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getServerSupabase();
  const { data: board } = await supabase
    .from('cel_boards')
    .select('title, description, honoree_name')
    .eq('slug', slug)
    .single();

  if (!board) return { title: 'Board Not Found' };

  return {
    title: `${board.title} | Christmas Air Celebrations`,
    description: board.description || `Celebration board${board.honoree_name ? ` for ${board.honoree_name}` : ''}`,
  };
}

export default async function PublicBoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getServerSupabase();

  const { data: board, error } = await supabase
    .from('cel_boards')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!board || error) {
    notFound();
  }

  // Internal boards require auth - redirect to login
  if (board.visibility === 'internal') {
    redirect(`/login?callbackUrl=/boards/${board.id}`);
  }

  // Fetch posts with reactions
  const { data: posts } = await supabase
    .from('cel_posts')
    .select('*, cel_reactions(*)')
    .eq('board_id', board.id)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  const transformedPosts = (posts || []).map((p: any) => ({
    ...p,
    reactions: p.cel_reactions || [],
    cel_reactions: undefined,
  }));

  return (
    <PublicBoardView
      board={board}
      initialPosts={transformedPosts}
    />
  );
}
