'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hw-border)] bg-white/80 backdrop-blur-md dark:bg-[#0F172A]/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </div>
          <span className="text-xl font-bold text-[var(--hw-text)]">
            Homework
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/browse"
            className="text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:text-[var(--hw-text)]"
          >
            Browse Services
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:text-[var(--hw-text)]"
          >
            How it Works
          </Link>
        </nav>

        {/* Auth Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--hw-text-secondary)] transition-colors hover:text-[var(--hw-text)]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            Sign up
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-[var(--hw-text-secondary)] md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-[var(--hw-border)] bg-white px-4 pb-4 pt-2 dark:bg-[#0F172A] md:hidden">
          <nav className="flex flex-col gap-2">
            <Link
              href="/browse"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-secondary)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Browse Services
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-secondary)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              How it Works
            </Link>
            <hr className="my-2 border-[var(--hw-border)]" />
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--hw-text-secondary)] hover:bg-[var(--hw-bg-secondary)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-white hover:bg-primary-dark"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign up
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
