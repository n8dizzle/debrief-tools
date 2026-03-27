import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, call } = body;

    console.log(`Retell nominations webhook: ${event}`, call?.call_id);

    if (event !== 'call_analyzed' || !call?.call_analysis?.custom_analysis_data) {
      return NextResponse.json({ ok: true });
    }

    const data = call.call_analysis.custom_analysis_data;
    const { nominator_name, nominee_name, company_value, story } = data;

    // Validate required fields were extracted
    if (!nominator_name || !nominee_name || !company_value || !story) {
      console.error('Missing required fields from call analysis:', data);
      return NextResponse.json({ ok: true });
    }

    // Find the current open period with its categories
    const supabase = getServerSupabase();
    const { data: periods } = await supabase
      .from('cel_nomination_periods')
      .select('id, categories')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!periods || periods.length === 0) {
      console.error('No open nomination period found for voice submission');
      return NextResponse.json({ ok: true });
    }

    const period = periods[0];

    // Validate category against period's categories
    const validKeys = (period.categories || []).map((c: any) => c.key);
    if (validKeys.length > 0 && !validKeys.includes(company_value)) {
      console.warn(`Voice nomination category "${company_value}" not in period categories:`, validKeys);
    }

    // Insert the nomination
    const { error: insertError } = await supabase
      .from('cel_nominations')
      .insert({
        period_id: period.id,
        nominee_name: nominee_name.trim(),
        nominator_name: nominator_name.trim(),
        company_value,
        story: story.trim(),
        source: 'voice',
      });

    if (insertError) {
      console.error('Failed to insert voice nomination:', insertError);
    } else {
      console.log(`Voice nomination saved: ${nominator_name} nominated ${nominee_name} for ${company_value}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Voice webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}
