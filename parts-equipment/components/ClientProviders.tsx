'use client';
import dynamic from 'next/dynamic';

// AppShell (and its whole dependency graph: useOrders, realtime, supabase client,
// modals) is CLIENT-ONLY. Rendering it during SSR pulls those env-touching modules
// into the server layout bundle, which crashed prod (`new URL('')` at module eval).
// Keep ssr:false — the server layout only stamps <html data-theme> for no-flash theming.
const AuthProvider = dynamic(() => import('./AuthProvider'), { ssr: false });
const AppShell = dynamic(() => import('./AppShell'), { ssr: false });

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
