import Link from "next/link";

// Admin shell (SSO-gated by middleware /admin/*). Simple top nav across the
// manager surfaces. Tech-facing pages live outside /admin and have no nav.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { href: "/admin", label: "Home" },
    { href: "/admin/roster", label: "Roster" },
    { href: "/admin/trainings", label: "Trainings" },
    { href: "/admin/spike", label: "Spike" },
  ];
  return (
    <div style={{ minHeight: "100dvh" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          height: 56,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <span style={{ fontWeight: 800, color: "var(--christmas-green-light)", whiteSpace: "nowrap" }}>
          CA Training
        </span>
        <nav style={{ display: "flex", gap: 4, overflowX: "auto" }}>
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <div>{children}</div>
    </div>
  );
}
