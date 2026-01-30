import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Your Job | Christmas Air',
  description: 'Track the progress of your HVAC or Plumbing job',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {children}
    </div>
  );
}
