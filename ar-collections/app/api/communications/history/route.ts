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
      supabase
        .from('ar_emails_sent')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50),
      supabase
        .from('ar_sms_sent')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50),
    ]);

    return NextResponse.json({
      emails: emailResult.data || [],
      sms: smsResult.data || [],
    });
  } catch (error) {
    console.error('Communications history API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
