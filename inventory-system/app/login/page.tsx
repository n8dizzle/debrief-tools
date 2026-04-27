import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect('/dashboard');

  const params = await searchParams;
  const showGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const showCredentials = process.env.NEXTAUTH_ALLOW_CREDENTIALS !== 'false';

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <LoginForm
        showGoogle={showGoogle}
        showCredentials={showCredentials}
        initialError={params.error ?? null}
      />
    </main>
  );
}
