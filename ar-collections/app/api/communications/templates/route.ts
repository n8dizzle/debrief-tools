import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();

    const [emailResult, smsResult] = await Promise.all([
      supabase.from('ar_email_templates').select('*').order('name'),
      supabase.from('ar_sms_templates').select('*').order('name'),
    ]);

    return NextResponse.json({
      email_templates: emailResult.data || [],
      sms_templates: smsResult.data || [],
    });
  } catch (error) {
    console.error('Templates API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
