"use client";

import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";

const COLLAPSE_KEY = "training_sidebar_collapsed";

// Responsive sidebar shell, mirrors ar-collections DashboardShell: mobile drawer +
// desktop collapsible sidebar, content area shifts with a left margin.
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true); } catch {}
  }, []);

  const toggle = () => setCollapsed((p) => {
    const next = !p;
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {}
    return next;
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)" }}>
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-white/10" style={{ color: "var(--text-secondary)" }} aria-label="Open menu">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="font-semibold" style={{ color: "var(--christmas-cream)" }}>Christmas Air Training</span>
        <div className="w-10" />
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} desktopCollapsed={collapsed} onToggleDesktopCollapsed={toggle} />

      <main className={`transition-[margin] duration-300 ease-in-out pt-16 lg:pt-0 ${collapsed ? "lg:ml-16" : "lg:ml-64"}`}>
        <div className="p-4 lg:p-6 xl:p-8">{children}</div>
      </main>
    </div>
  );
}
