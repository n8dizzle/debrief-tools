import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface Attachment {
  filename: string;
  content: Buffer;
  content_type?: string;
}

export async function sendEmail(to: string | string[], subject: string, html: string, attachments?: Attachment[], cc?: string[]) {
  const client = getResend();
  const { data, error } = await client.emails.send({
    from: 'Christmas Air <noreply@christmasair.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    ...(attachments?.length ? { attachments } : {}),
    ...(cc?.length ? { cc } : {}),
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

interface ActionItemForEmail {
  description: string;
  priority: string;
  due_date: string | null;
  status: string;
}

export function generateActionItemEmail(
  documentTitle: string,
  actionItems: ActionItemForEmail[],
  senderName: string,
  personalMessage?: string
): string {
  const priorityColors: Record<string, string> = {
    high: '#ef4444',
    medium: '#eab308',
    low: '#22c55e',
  };

  const actionRows = actionItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-size: 14px; color: #1f2937;">${item.description}</div>
          <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background: ${priorityColors[item.priority] || '#6b7280'}20; color: ${priorityColors[item.priority] || '#6b7280'}; font-weight: 500;">${item.priority}</span>
            ${item.due_date ? `<span style="margin-left: 8px;">Due: ${item.due_date}</span>` : ''}
          </div>
        </td>
      </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1C231E; border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 18px; color: #F5F0E1;">Christmas Air</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6B9B75;">Doc Dispatch - Action Items</p>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px;">
          <tr>
            <td>
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Document:</p>
              <h2 style="margin: 0 0 16px; font-size: 16px; color: #1f2937;">${documentTitle}</h2>

              ${personalMessage ? `<div style="background: #f9fafb; border-left: 3px solid #5D8A66; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Message from ${senderName}:</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #1f2937;">${personalMessage}</p>
              </div>` : ''}

              <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #374151;">Action Items (${actionItems.length})</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                ${actionRows}
              </table>

              <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                Sent by ${senderName} via Doc Dispatch
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface ChatMessageForEmail {
  role: string;
  content: string;
  created_at: string;
}

interface DocumentEmailOptions {
  documentTitle: string;
  documentType: string | null;
  summary: string | null;
  extractedData: Record<string, any>;
  actionItems: ActionItemForEmail[];
  senderName: string;
  personalMessage?: string;
  hasAttachment: boolean;
  filename?: string;
  attachmentNotice?: string;
  chatMessages?: ChatMessageForEmail[];
}

export function generateDocumentEmail(opts: DocumentEmailOptions): string {
  const {
    documentTitle, documentType, summary, extractedData,
    actionItems, senderName, personalMessage, hasAttachment,
    filename, attachmentNotice, chatMessages = [],
  } = opts;

  const attachmentLabel = attachmentNotice || filename || 'Document image attached';

  const priorityColors: Record<string, string> = {
    high: '#ef4444',
    medium: '#eab308',
    low: '#22c55e',
  };

  const docType = documentType
    ? documentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Document';

  const extractedRows = Object.entries(extractedData || {})
    .filter(([, v]) => v)
    .map(([key, value]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const displayValue = key === 'amount' ? `$${Number(value).toLocaleString()}` : String(value);
      return `<tr>
        <td style="padding: 6px 12px; font-size: 13px; color: #6b7280; white-space: nowrap;">${label}</td>
        <td style="padding: 6px 12px; font-size: 13px; color: #1f2937; text-align: right;">${displayValue}</td>
      </tr>`;
    })
    .join('');

  const chatHtml = chatMessages.length > 0
    ? chatMessages.map(msg => {
        const isUser = msg.role === 'user';
        // Strip sources section from assistant messages
        const content = !isUser && msg.content.includes('\n\nSources:\n')
          ? msg.content.split('\n\nSources:\n')[0]
          : msg.content;
        const escapedContent = content.replace(/\n/g, '<br>');
        return `<tr><td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 11px; font-weight: 600; color: ${isUser ? '#1C231E' : '#5D8A66'}; margin-bottom: 2px;">${isUser ? 'You' : 'AI'}</div>
          <div style="font-size: 13px; color: #374151; line-height: 1.4;">${escapedContent}</div>
        </td></tr>`;
      }).join('')
    : '';

  const actionRows = actionItems
    .map(item => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-size: 13px; color: #1f2937;">${item.description}</div>
          <div style="margin-top: 3px; font-size: 11px; color: #6b7280;">
            <span style="display: inline-block; padding: 1px 6px; border-radius: 9999px; background: ${priorityColors[item.priority] || '#6b7280'}20; color: ${priorityColors[item.priority] || '#6b7280'}; font-weight: 500;">${item.priority}</span>
            ${item.due_date ? `<span style="margin-left: 6px;">Due: ${item.due_date}</span>` : ''}
          </div>
        </td>
      </tr>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1C231E; border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 18px; color: #F5F0E1;">Christmas Air</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6B9B75;">Doc Dispatch</p>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px;">
          <tr>
            <td>
              <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280;">${docType}</p>
              <h2 style="margin: 0 0 16px; font-size: 18px; color: #1f2937;">${documentTitle}</h2>

              ${personalMessage ? `<div style="background: #f9fafb; border-left: 3px solid #5D8A66; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 13px; color: #6b7280;">Message from ${senderName}:</p>
                <p style="margin: 4px 0 0; font-size: 14px; color: #1f2937;">${personalMessage}</p>
              </div>` : ''}

              ${hasAttachment ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;">
                <p style="margin: 0; font-size: 13px; color: #166534;">📎 ${attachmentLabel}</p>
              </div>` : ''}

              ${summary ? `<div style="margin-bottom: 16px;">
                <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #374151;">Summary</p>
                <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">${summary}</p>
              </div>` : ''}

              ${extractedRows ? `<div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #374151;">Details</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  ${extractedRows}
                </table>
              </div>` : ''}

              ${actionRows ? `<div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #374151;">Action Items (${actionItems.length})</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  ${actionRows}
                </table>
              </div>` : ''}

              ${chatHtml ? `<div style="margin-bottom: 16px;">
                <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #374151;">AI Chat Transcript (${chatMessages.length} messages)</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fafafa;">
                  ${chatHtml}
                </table>
              </div>` : ''}

              <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                Sent by ${senderName} via Doc Dispatch
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
