'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

interface Profile {
  email: string;
  full_name: string;
  phone: string;
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
      <div className="h-5 w-32 rounded bg-[var(--hw-bg-tertiary)]" />
      <div className="mt-4 space-y-4">
        <div>
          <div className="h-3 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-1.5 h-9 w-full rounded-lg bg-[var(--hw-bg-tertiary)]" />
        </div>
        <div>
          <div className="h-3 w-16 rounded bg-[var(--hw-bg-tertiary)]" />
          <div className="mt-1.5 h-9 w-full rounded-lg bg-[var(--hw-bg-tertiary)]" />
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    email: '',
    full_name: '',
    phone: '',
  });
  const [signingOut, setSigningOut] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      setProfile({
        email: user.email || '',
        full_name: user.user_metadata?.full_name || '',
        phone: user.user_metadata?.phone || user.phone || '',
      });
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.full_name,
          phone: profile.phone,
        },
      });

      if (error) {
        console.error('Failed to update profile:', error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSaved(true);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      setPasswordError('An unexpected error occurred.');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Failed to sign out:', err);
      setSigningOut(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--hw-text)]">Account</h1>
      <p className="mt-1 text-sm text-[var(--hw-text-secondary)]">
        Manage your profile and account settings.
      </p>

      {loading ? (
        <div className="mt-6 space-y-6">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Profile section */}
          <form
            onSubmit={handleSaveProfile}
            className="rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]"
          >
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">Profile</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="full_name" className="block text-xs font-medium text-[var(--hw-text-secondary)]">
                  Full Name
                </label>
                <input
                  id="full_name"
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[var(--hw-border)] bg-[var(--hw-bg)] px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-medium text-[var(--hw-text-secondary)]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="mt-1.5 w-full rounded-lg border border-[var(--hw-border)] bg-[var(--hw-bg-secondary)] px-3 py-2 text-sm text-[var(--hw-text-tertiary)] cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-[var(--hw-text-tertiary)]">
                  Email cannot be changed.
                </p>
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-[var(--hw-text-secondary)]">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-[var(--hw-border)] bg-[var(--hw-bg)] px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
          </form>

          {/* Notification preferences */}
          <div className="rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]">
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">Notification Preferences</h2>
            <div className="mt-4 space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--hw-text)]">Order updates</p>
                  <p className="text-xs text-[var(--hw-text-tertiary)]">
                    Get notified when your order status changes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-[var(--hw-border)] text-primary focus:ring-primary"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--hw-text)]">Promotions and offers</p>
                  <p className="text-xs text-[var(--hw-text-tertiary)]">
                    Receive special offers and seasonal deals.
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-[var(--hw-border)] text-primary focus:ring-primary"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--hw-text)]">Maintenance reminders</p>
                  <p className="text-xs text-[var(--hw-text-tertiary)]">
                    Reminders for upcoming home maintenance tasks.
                  </p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 rounded border-[var(--hw-border)] text-primary focus:ring-primary"
                />
              </label>
            </div>
          </div>

          {/* Security section */}
          <form
            onSubmit={handleChangePassword}
            className="rounded-xl border border-[var(--hw-border)] bg-white p-6 dark:bg-[var(--hw-bg)]"
          >
            <h2 className="text-sm font-semibold text-[var(--hw-text)]">Security</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="new_password" className="block text-xs font-medium text-[var(--hw-text-secondary)]">
                  New Password
                </label>
                <input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                  className="mt-1.5 w-full rounded-lg border border-[var(--hw-border)] bg-[var(--hw-bg)] px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm_password" className="block text-xs font-medium text-[var(--hw-text-secondary)]">
                  Confirm New Password
                </label>
                <input
                  id="confirm_password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                  className="mt-1.5 w-full rounded-lg border border-[var(--hw-border)] bg-[var(--hw-bg)] px-3 py-2 text-sm text-[var(--hw-text)] placeholder-[var(--hw-text-tertiary)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Repeat your password"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={changingPassword || (!newPassword && !confirmPassword)}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
              {passwordSaved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Password updated
                </span>
              )}
            </div>
          </form>

          {/* Sign out */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
            <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Sign Out</h2>
            <p className="mt-1 text-xs text-red-600 dark:text-red-400/80">
              You will be signed out of your account and redirected to the login page.
            </p>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
            >
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
