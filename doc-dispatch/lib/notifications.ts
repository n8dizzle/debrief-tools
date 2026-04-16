import { getServerSupabase } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

interface UploadNotificationParams {
  documentId: string;
  documentTitle: string;
  uploaderName: string;
  uploaderEmail: string;
  pageCount: number;
  source: 'web' | 'email';
}

export async function sendUploadNotification(params: UploadNotificationParams) {
  try {
    const supabase = getServerSupabase();

    const { data } = await supabase
      .from('dd_settings')
      .select('value')
      .eq('key', 'upload_notifications')
      .single();

    if (!data?.value?.enabled || !data.value.recipients?.length) return;

    const recipients: string[] = data.value.recipients;
    const { documentId, documentTitle, uploaderName, uploaderEmail, pageCount, source } = params;
    const sourceLabel = source === 'email' ? 'emailed in' : 'uploaded';
    const pageLabel = pageCount > 1 ? `${pageCount} pages` : '1 page';
    const displayTitle = documentTitle || 'Untitled Document';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #1C231E; border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; font-size: 18px; color: #F5F0E1;">Christmas Air</h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #6B9B75;">Doc Dispatch — New Document</p>
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px;">
          <tr>
            <td>
              <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">
                <strong>${uploaderName || uploaderEmail}</strong> ${sourceLabel} a new document (${pageLabel}).
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1f2937;">
                ${displayTitle}
              </p>
              <a href="https://docs.christmasair.com/documents/${documentId}" style="display: inline-block; padding: 10px 20px; background: #5D8A66; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                View Document
              </a>
              <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                You're receiving this because you're subscribed to Doc Dispatch upload notifications.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await sendEmail(recipients, `New Document: ${displayTitle}`, html);
  } catch (err) {
    // Non-fatal — don't break the flow
    console.error('Upload notification error:', err);
  }
}
