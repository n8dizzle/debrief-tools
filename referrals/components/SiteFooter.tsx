import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer
      className="mt-24 py-12 px-6"
      style={{ background: "var(--ca-dark-green)", color: "var(--ca-cream)" }}
    >
      <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-3">
        <div>
          <h3 className="text-2xl mb-3" style={{ color: "var(--ca-cream)" }}>
            Christmas Air
          </h3>
          <p className="text-sm opacity-90 leading-relaxed">
            Conditioning &amp; Plumbing
            <br />
            Your neighbors in Flower Mound
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="badge-trust" style={{ background: "rgba(245,242,220,0.15)", color: "var(--ca-cream)" }}>
              Veteran-Owned
            </span>
            <span className="badge-trust" style={{ background: "rgba(245,242,220,0.15)", color: "var(--ca-cream)" }}>
              Locally-Owned
            </span>
          </div>
        </div>

        <div className="text-sm opacity-90 leading-relaxed">
          <p className="font-semibold mb-2" style={{ color: "var(--ca-cream)" }}>
            Get in touch
          </p>
          <p>(469) 214-2013</p>
          <p>1011 Surrey Ln., Bldg 200</p>
          <p>Flower Mound, TX 75022</p>
          <p className="mt-3 text-xs opacity-75">
            TACLA00120029E &middot; M18185
          </p>
        </div>

        <div className="text-sm">
          <p className="font-semibold mb-2" style={{ color: "var(--ca-cream)" }}>
            Program
          </p>
          <ul className="space-y-1.5 opacity-90">
            <li>
              <Link href="/" style={{ color: "var(--ca-cream)" }}>
                How it works
              </Link>
            </li>
            <li>
              <Link href="/triple-win" style={{ color: "var(--ca-cream)" }}>
                Triple Win
              </Link>
            </li>
            <li>
              <Link href="/faq" style={{ color: "var(--ca-cream)" }}>
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/terms" style={{ color: "var(--ca-cream)" }}>
                Program Terms
              </Link>
            </li>
            <li>
              <a
                href="https://christmasair.com"
                style={{ color: "var(--ca-cream)" }}
              >
                Main site
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto mt-10 pt-6 text-xs opacity-70"
        style={{ borderTop: "1px solid rgba(245,242,220,0.15)" }}
      >
        &copy; {new Date().getFullYear()} Christmas Air Conditioning &amp; Plumbing. Neighbors helping neighbors.
      </div>
    </footer>
  );
}
