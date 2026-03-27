import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';
import { DEFAULT_WEIGHTS } from '@/lib/sd-utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServerSupabase();
  const { data } = await supabase
    .from('sd_scoring_config')
    .select('*')
    .limit(1)
    .single();

  return NextResponse.json({
    weights: data?.weights || DEFAULT_WEIGHTS,
    updated_at: data?.updated_at || null,
    updated_by: data?.updated_by || null,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only managers/owners can update weights
  if (session.user.role === 'employee') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { weights } = body;

  if (!weights || typeof weights !== 'object') {
    return NextResponse.json({ error: 'Invalid weights' }, { status: 400 });
  }

  // Validate weights sum to ~1.0
  const total = Object.values(weights as Record<string, number>).reduce((s: number, v) => s + v, 0);
  if (Math.abs(total - 1.0) > 0.01) {
    return NextResponse.json({ error: 'Weights must sum to 1.0' }, { status: 400 });
  }

  const supabase = getServerSupabase();

  // Check if config exists
  const { data: existing } = await supabase
    .from('sd_scoring_config')
    .select('id')
    .limit(1)
    .single();

  if (existing) {
    await supabase
      .from('sd_scoring_config')
      .update({
        weights,
        updated_at: new Date().toISOString(),
        updated_by: session.user.email,
      })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('sd_scoring_config')
      .insert({
        weights,
        updated_by: session.user.email,
      });
  }

  return NextResponse.json({ success: true, weights });
}
