'use client';

import { useState } from 'react';
import Link from 'next/link';

export function MarketingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-md">
      <nav className="container-wide flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Homework
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/services"
            className="animated-underline text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Services
          </Link>
          <Link
            href="/for-contractors"
            className="animated-underline text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            For Contractors
          </Link>
          <Link
            href="/about"
            className="animated-underline text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            About
          </Link>
          <Link
            href="/faq"
            className="animated-underline text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            FAQ
          </Link>
          <Link
            href="/contact"
            className="animated-underline text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Contact
          </Link>
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="https://app.homework.com/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            Sign In
          </Link>
          <Link
            href="https://app.homework.com/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-100 bg-white md:hidden">
          <div className="space-y-1 px-4 pb-4 pt-2">
            <Link
              href="/services"
              className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Services
            </Link>
            <Link
              href="/for-contractors"
              className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              For Contractors
            </Link>
            <Link
              href="/about"
              className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="/faq"
              className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              FAQ
            </Link>
            <Link
              href="/contact"
              className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
              <Link
                href="https://app.homework.com/login"
                className="rounded-lg px-3 py-2.5 text-center text-base font-medium text-slate-600 hover:bg-slate-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="https://app.homework.com/signup"
                className="rounded-lg bg-primary px-3 py-2.5 text-center text-base font-semibold text-white hover:bg-primary-dark"
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
