/**
 * ServiceTitan job summaries/notes come back as rich text with raw HTML
 * (<div>, <span>, <br>, &nbsp;, etc.). Convert to clean plain text for display.
 */
export function stripHtml(input?: string | null): string {
  if (!input) return '';
  // Defensive cap — these are short job summaries/notes; never run 10 passes over a huge blob.
  const src = input.length > 20000 ? input.slice(0, 20000) : input;
  return src
    .replace(/<\s*br\s*\/?>/gi, '\n')          // <br> → newline
    .replace(/<\/(p|div|li|tr)>/gi, '\n')       // block closers → newline
    .replace(/<[^>]+>/g, '')                    // drop remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')                 // trailing spaces before newline
    .replace(/\n{3,}/g, '\n\n')                 // collapse blank runs
    .trim();
}
