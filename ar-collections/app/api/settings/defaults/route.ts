import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

/**
 * GET /api/settings/defaults
 * Get default settings (e.g., default invoice owner)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['manager', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('ar_slack_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'default_invoice_owner')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching default settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    return NextResponse.json({
      default_invoice_owner: data?.setting_value || '',
    });
  } catch (error) {
    console.error('Default settings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/defaults
 * Update default settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['manager', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { default_invoice_owner } = body;

    if (default_invoice_owner === undefined) {
      return NextResponse.json({ error: 'Missing default_invoice_owner' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { error } = await supabase
      .from('ar_slack_settings')
      .update({
        setting_value: default_invoice_owner || '',
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'default_invoice_owner');

    if (error) {
      console.error('Error updating default owner:', error);
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Default settings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
