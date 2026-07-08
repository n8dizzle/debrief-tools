"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Home", icon: "home", exact: true },
  { href: "/admin/roster", label: "Roster", icon: "users" },
  { href: "/admin/trainings", label: "Trainings", icon: "book" },
  { href: "/admin/spike", label: "Spike", icon: "chart" },
];

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactElement> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
    book: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
    chart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    arrow: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />,
  };
  return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icons[type] || icons.home}</svg>;
}

export default function Sidebar({
  isOpen = true, onClose, desktopCollapsed = false, onToggleDesktopCollapsed,
}: { isOpen?: boolean; onClose?: () => void; desktopCollapsed?: boolean; onToggleDesktopCollapsed?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const hideLbl = desktopCollapsed ? "lg:hidden" : "";
  const justify = desktopCollapsed ? "lg:justify-center lg:px-0" : "";
  const handleClick = () => onClose?.();

  return (
    <>
      {isOpen && onClose && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 flex flex-col z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 ${desktopCollapsed ? "lg:w-16" : "lg:w-64"} ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "var(--bg-secondary)", borderRight: "1px solid var(--border-subtle)" }}
      >
        <div className={`p-4 border-b flex items-center justify-between ${desktopCollapsed ? "lg:justify-center lg:px-2" : ""}`} style={{ borderColor: "var(--border-subtle)" }}>
          <Link href="/admin" className="flex items-center gap-3" onClick={handleClick}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--christmas-green)" }}>
              <svg className="w-6 h-6" fill="none" stroke="var(--christmas-cream)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
            </div>
            <div className={hideLbl}>
              <div className="font-bold text-lg" style={{ color: "var(--christmas-cream)" }}>Christmas Air</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Training</div>
            </div>
          </Link>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors" style={{ color: "var(--text-secondary)" }} aria-label="Close menu">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {onToggleDesktopCollapsed && (
          <button onClick={onToggleDesktopCollapsed} className="hidden lg:flex items-center justify-end pr-3 py-2 border-b hover:bg-white/5 transition-colors" style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }} aria-label="Toggle sidebar">
            <svg className={`w-4 h-4 transition-transform ${desktopCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}

        <nav className="flex-1 overflow-y-auto p-4">
          <div className={`text-xs font-semibold uppercase tracking-wider mb-2 px-3 ${hideLbl}`} style={{ color: "var(--text-muted)" }}>Manage</div>
          <div className="space-y-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={handleClick} title={desktopCollapsed ? l.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${justify}`}
                style={{ backgroundColor: isActive(l.href, l.exact) ? "var(--christmas-green)" : "transparent", color: isActive(l.href, l.exact) ? "var(--christmas-cream)" : "var(--text-secondary)" }}>
                <NavIcon type={l.icon} />
                <span className={`text-sm ${isActive(l.href, l.exact) ? "font-medium" : ""} ${hideLbl}`}>{l.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <a href="https://portal.christmasair.com" title={desktopCollapsed ? "Back to Portal" : undefined} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${justify}`} style={{ color: "var(--text-secondary)" }}>
            <NavIcon type="arrow" />
            <span className={`text-sm ${hideLbl}`}>Back to Portal</span>
          </a>
        </div>
      </aside>
    </>
  );
}
