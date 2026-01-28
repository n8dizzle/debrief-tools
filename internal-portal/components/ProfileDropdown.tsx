"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";

interface ProfileDropdownProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  canAccessAdmin: boolean;
}

export default function ProfileDropdown({
  userName,
  userEmail,
  canAccessAdmin,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = userName || userEmail?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors"
        style={{
          background: isOpen ? "var(--bg-card-hover)" : "transparent",
          color: "var(--christmas-cream)",
        }}
        onMouseOver={(e) => {
          if (!isOpen) e.currentTarget.style.background = "var(--bg-card)";
        }}
        onMouseOut={(e) => {
          if (!isOpen) e.currentTarget.style.background = "transparent";
        }}
      >
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
          style={{
            background: "var(--christmas-green)",
            color: "var(--christmas-cream)",
          }}
        >
          {initials}
        </div>
        <span className="text-sm font-medium hidden sm:block">{displayName}</span>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg overflow-hidden z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--christmas-cream)" }}>
              {displayName}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
              {userEmail}
            </p>
          </div>

          {/* Admin Links (if authorized) */}
          {canAccessAdmin && (
            <div className="py-1">
              <Link
                href="/admin/users"
                onClick={() => setIsOpen(false)}
                className="flex items-center px-4 py-2.5 text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                  e.currentTarget.style.color = "var(--christmas-cream)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Manage Users
              </Link>
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center px-4 py-2.5 text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                  e.currentTarget.style.color = "var(--christmas-cream)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Admin Settings
              </Link>
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

          {/* Sign Out */}
          <div className="py-1">
            <button
              onClick={() => signOut()}
              className="flex items-center w-full px-4 py-2.5 text-sm transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--bg-card-hover)";
                e.currentTarget.style.color = "var(--christmas-brown-light)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
