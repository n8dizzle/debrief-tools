import Link from "next/link";

export default function DashboardHeader({ firstName }: { firstName: string }) {
  return (
    <header
      className="sticky top-0 z-10 backdrop-blur"
      style={{
        background: "rgba(245, 242, 220, 0.92)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-3"
          style={{ color: "var(--ca-dark-green)" }}
        >
          <span
            className="text-2xl"
            style={{ fontFamily: "var(--font-lobster)" }}
          >
            Christmas Air
          </span>
          <span className="text-xs opacity-70 hidden sm:inline">Dashboard</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="opacity-80 hidden sm:inline">Hi, {firstName}</span>
          <form action="/api/auth/customer/logout" method="post">
            <button type="submit" className="opacity-70 hover:opacity-100">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
