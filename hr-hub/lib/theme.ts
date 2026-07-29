import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase';

export type Theme = 'light' | 'dark';

// Resolve the active theme for this render. Order:
//   1) the ca_theme cookie (set portal-wide on .christmasair.com — the fast, cross-app path)
//   2) the user's portal_users.preferences.theme (durable source of truth, survives new devices)
//   3) dark (the default, unchanged from today)
export async function resolveTheme(): Promise<Theme> {
  const c = (await cookies()).get('ca_theme')?.value;
  if (c === 'light' || c === 'dark') return c;
  try {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string } | undefined)?.id;
    const supabase = getServerSupabase();
    if (id && supabase) {
      const { data } = await supabase.from('portal_users').select('preferences').eq('id', id).maybeSingle();
      const t = ((data as { preferences?: { theme?: string } } | null)?.preferences?.theme) ?? null;
      if (t === 'light' || t === 'dark') return t;
    }
  } catch { /* fall through to default */ }
  return 'dark';
}
