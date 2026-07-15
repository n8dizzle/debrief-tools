import { cookies } from 'next/headers';

export type Theme = 'light' | 'dark';

// Resolve the active theme for this render from the portal-wide `ca_theme` cookie
// (set on `.christmasair.com` by the portal ProfileDropdown). Default: dark.
//
// Kept deliberately dependency-free: this runs in the ROOT layout's server bundle,
// so it must not import auth/supabase/realtime modules. The rest of the app (the
// shell) is client-rendered (ssr:false) to keep those modules out of SSR — see
// components/ClientProviders.tsx. A user who has never set a theme in the portal
// gets the default until the cookie is set; that's fine and avoids a DB call here.
export async function resolveTheme(): Promise<Theme> {
  const c = (await cookies()).get('ca_theme')?.value;
  return c === 'light' ? 'light' : 'dark';
}
