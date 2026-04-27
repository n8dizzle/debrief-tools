'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition"
    >
      <LogOut size={14} />
      <span>Sign out</span>
    </button>
  );
}
