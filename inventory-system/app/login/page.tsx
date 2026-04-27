import { redirect } from 'next/navigation';
import { login } from '@/lib/api';
import { setSession, getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

async function loginAction(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    return redirect('/login?err=missing');
  }
  try {
    const data = await login(email, password);
    await setSession(data);
  } catch {
    return redirect('/login?err=invalid');
  }
  redirect('/dashboard');
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getSession();
  if (session) redirect('/dashboard');
  const params = await searchParams;
  const errMsg =
    params.err === 'invalid' ? 'Invalid email or password.' : params.err === 'missing' ? 'Email and password are required.' : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm bg-bg-card border border-border-subtle rounded-lg p-8 space-y-5"
      >
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-christmas-cream">Inventory</h1>
          <p className="text-sm text-text-secondary">Christmas Air &middot; Davis Plumbing</p>
        </header>

        {errMsg && (
          <div className="text-sm text-red-300 bg-red-900/20 border border-red-900/40 rounded px-3 py-2">
            {errMsg}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs uppercase tracking-wide text-text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-text-primary outline-none focus:border-christmas-green"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs uppercase tracking-wide text-text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full bg-bg-secondary border border-border-default rounded px-3 py-2 text-text-primary outline-none focus:border-christmas-green"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-christmas-green hover:bg-christmas-green-light text-white font-medium rounded px-4 py-2 transition"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
