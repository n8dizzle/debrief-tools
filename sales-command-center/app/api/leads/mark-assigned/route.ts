import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase';
import { sendViaWebhook } from '@/lib/slack';

// GET endpoint so it can be triggered from a Slack button URL
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('id');
    const serviceTitanId = searchParams.get('stId');

    if (!leadId && !serviceTitanId) {
      return new NextResponse(renderHTML('Error', 'Missing lead ID', false, true), {
        headers: { 'Content-Type': 'text/html' },
        status: 400,
      });
    }

    const supabase = createServerSupabaseClient();

    // Find the lead
    let query = supabase.from('leads').select('*, advisor:comfort_advisors(name)');

    if (leadId) {
      query = query.eq('id', leadId);
    } else if (serviceTitanId) {
      query = query.eq('service_titan_id', serviceTitanId);
    }

    const { data: lead, error: findError } = await query.single();

    if (findError || !lead) {
      return new NextResponse(renderHTML('Not Found', 'Lead not found in dashboard', false, true), {
        headers: { 'Content-Type': 'text/html' },
        status: 404,
      });
    }

    // Update the lead status to "Assigned"
    const { error: updateError } = await supabase
      .from('leads')
      .update({ status: 'Assigned' })
      .eq('id', lead.id);

    if (updateError) {
      return new NextResponse(renderHTML('Error', `Failed to update: ${updateError.message}`, false, true), {
        headers: { 'Content-Type': 'text/html' },
        status: 500,
      });
    }

    const advisorName = lead.advisor?.name || 'Unknown';

    // Send confirmation message to Slack
    await sendViaWebhook({
      text: `✅ *${lead.client_name}* marked as assigned to *${advisorName}*`,
    });

    // Return a page that auto-closes
    return new NextResponse(
      renderHTML(
        'Done!',
        `${lead.client_name} → ${advisorName}`,
        true,
        true
      ),
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error: any) {
    return new NextResponse(renderHTML('Error', error.message, false, true), {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    });
  }
}

function renderHTML(title: string, message: string, success = false, autoClose = false): string {
  const bgColor = success ? '#4CAF50' : '#f44336';
  const icon = success ? '✓' : '✕';

  const autoCloseScript = autoClose ? `
    <script>
      setTimeout(function() { window.close(); }, 1500);
    </script>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${autoCloseScript}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: white;
    }
    .card {
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    p {
      font-size: 16px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>
  `;
}
