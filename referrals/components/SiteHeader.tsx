import Link from "next/link";

export default function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-10 backdrop-blur"
      style={{
        background: "rgba(245, 242, 220, 0.92)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" style={{ color: "var(--ca-dark-green)" }}>
          <span className="text-2xl font-display" style={{ fontFamily: "var(--font-lobster)" }}>
            Christmas Air
          </span>
          <span className="text-xs opacity-70 hidden sm:inline">Neighbors Helping Neighbors</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/triple-win" style={{ color: "var(--ca-dark-green)" }}>
            Triple Win
          </Link>
          <Link href="/faq" style={{ color: "var(--ca-dark-green)" }}>
            FAQ
          </Link>
          <Link
            href="/sign-in"
            className="hidden sm:inline"
            style={{ color: "var(--ca-dark-green)" }}
          >
            Sign in
          </Link>
          <Link href="/enroll" className="btn btn-primary">
            Join the program
          </Link>
        </nav>
      </div>
    </header>
  );
}
