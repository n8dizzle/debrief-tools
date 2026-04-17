/**
 * Shared HTML shell for transactional emails.
 * Brand-matched: cream background, dark green headings, Open Sans body.
 */
export function renderEmailLayout(opts: {
  preheader: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Christmas Air</title>
</head>
<body style="margin:0;padding:0;background:#F5F2DC;font-family:'Open Sans',system-ui,sans-serif;color:#1A1F1A;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</span>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F2DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(65,84,64,0.12);">
        <tr>
          <td style="background:#415440;padding:24px 32px;">
            <p style="margin:0;color:#F5F2DC;font-size:28px;font-family:Georgia,'Times New Roman',serif;font-style:italic;">Christmas Air</p>
            <p style="margin:4px 0 0;color:#F5F2DC;opacity:0.8;font-size:13px;">Neighbors Helping Neighbors</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;line-height:1.55;font-size:16px;color:#1A1F1A;">
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#F5F2DC;padding:20px 32px;font-size:12px;color:#415440;opacity:0.8;text-align:center;">
            Christmas Air Conditioning &amp; Plumbing &middot; Veteran-Owned, Locally-Owned<br>
            (469) 214-2013 &middot; TACLA00120029E &middot; M18185
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
