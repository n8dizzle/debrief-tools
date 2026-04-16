import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not configured');
    return null;
  }
  resendClient = new Resend(apiKey);
  return resendClient;
}

interface OpenJob {
  id: number;
  jobNumber: string;
  jobStatus: string;
  businessUnitName: string;
  jobTypeName: string;
  createdOn: string;
  hoursOpen: number;
  severity: 'warning' | 'critical';
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const h = Math.round(hours - days * 24);
  return h > 0 ? `${days}d ${h}h` : `${days}d`;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function buildEmailHtml(jobs: OpenJob[], message: string, senderName: string): string {
  const critical = jobs.filter(j => j.severity === 'critical');
  const warning = jobs.filter(j => j.severity === 'warning');

  const jobRows = jobs
    .sort((a, b) => b.hoursOpen - a.hoursOpen)
    .map(job => {
      const severityColor = job.severity === 'critical' ? '#ef4444' : '#eab308';
      const severityLabel = job.severity === 'critical' ? 'Critical' : 'Warning';
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${severityColor}20; color: ${severityColor};">${severityLabel}</span>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
            <a href="https://go.servicetitan.com/#/Job/Index/${job.id}" style="color: #5D8A66; font-weight: 600; font-family: monospace; text-decoration: none;">${job.jobNumber}</a>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${job.jobStatus}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${job.businessUnitName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${job.jobTypeName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">${formatDate(job.createdOn)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: ${severityColor};">${formatDuration(job.hoursOpen)}</td>
        </tr>`;
    })
    .join('');

  const messageHtml = message
    ? `<div style="background: #f9fafb; border-left: 3px solid #5D8A66; padding: 12px 16px; margin-bottom: 24px; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">${message.replace(/\n/g, '<br>')}</p>
      </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; padding: 24px;">
        <tr><td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 800px; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td style="background: #5D8A66; padding: 20px 24px;">
                <h1 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">Open Jobs Requiring Attention</h1>
                <p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">
                  ${jobs.length} job${jobs.length !== 1 ? 's' : ''} flagged
                  ${critical.length > 0 ? ` &mdash; ${critical.length} critical` : ''}
                  ${warning.length > 0 ? ` &mdash; ${warning.length} warning` : ''}
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 24px;">
                ${messageHtml}

                <!-- Jobs Table -->
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; font-size: 13px;">
                  <thead>
                    <tr style="background: #f9fafb;">
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Severity</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Job #</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Status</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Business Unit</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Type</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Created</th>
                      <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${jobRows}
                  </tbody>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                  Sent by ${senderName} via <a href="https://audit.christmasair.com/open-jobs" style="color: #5D8A66;">ST Audit</a>
                  &nbsp;&middot;&nbsp; Christmas Air Conditioning &amp; Plumbing
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
  }

  const { to, jobs, message } = await request.json() as {
    to: string[];
    jobs: OpenJob[];
    message?: string;
  };

  if (!to?.length || !jobs?.length) {
    return NextResponse.json({ error: 'Recipients and jobs are required' }, { status: 400 });
  }

  const senderName = session.user.name || session.user.email || 'ST Audit';
  const critical = jobs.filter(j => j.severity === 'critical').length;
  const subject = `[Action Required] ${jobs.length} Open Job${jobs.length !== 1 ? 's' : ''} Need Attention${critical > 0 ? ` (${critical} Critical)` : ''}`;

  try {
    const { data, error } = await resend.emails.send({
      from: 'ST Audit <notifications@christmasair.com>',
      to,
      subject,
      html: buildEmailHtml(jobs, message || '', senderName),
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: data?.id });
  } catch (err) {
    console.error('Email send failed:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
