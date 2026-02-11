import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Celebrations | Christmas Air',
  description: 'View and contribute to team celebration boards',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {children}
    </div>
  );
}
