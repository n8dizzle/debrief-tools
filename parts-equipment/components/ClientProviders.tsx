'use client';
import dynamic from 'next/dynamic';

const AuthProvider = dynamic(() => import('./AuthProvider'), { ssr: false });
const AppShell = dynamic(() => import('./AppShell'), { ssr: false });

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
