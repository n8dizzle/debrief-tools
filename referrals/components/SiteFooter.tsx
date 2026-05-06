import Link from "next/link";
import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer
      className="mt-16 md:mt-24 py-10 md:py-12 px-4 md:px-6"
      style={{ background: "var(--ca-dark-green)", color: "var(--ca-cream)" }}
    >
      <div className="max-w-6xl mx-auto grid gap-8 md:gap-10 md:grid-cols-3">
        <div>
          <Image
            src="/logo-wordmark.png"
            alt="Christmas Air and Plumbing"
            width={140}
            height={70}
            className="mb-4"
          />
          <p className="text-sm opacity-90 leading-relaxed">
            Neighbors Helping Neighbors
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
          <p className="font-bold text-base mb-2" style={{ color: "var(--ca-cream)" }}>
            Contact Us
          </p>
          <p className="font-bold">(469) 214-5517</p>
          <p>1011 Surrey Ln., Bldg 200</p>
          <p>Flower Mound, TX 75022</p>
          <p className="mt-3 text-xs opacity-75">
            TACLA00120029E &middot; M18185
          </p>
        </div>

        <div className="text-sm">
          <p className="font-bold text-base mb-2" style={{ color: "var(--ca-cream)" }}>
            Resources
          </p>
          <ul className="space-y-1.5 opacity-90">
            <li>
              <Link href="/" style={{ color: "var(--ca-cream)" }}>
                How It Works
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
              <Link href="/sign-in" style={{ color: "var(--ca-cream)" }}>
                Sign In To Your Dashboard
              </Link>
            </li>
            <li>
              <a
                href="https://christmasair.com/?utm_source=newsletter&utm_medium=webform&utm_campaign=triple_win_referral"
                style={{ color: "var(--ca-cream)" }}
              >
                Main Site
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="max-w-6xl mx-auto mt-10 pt-6 text-xs opacity-70"
        style={{ borderTop: "1px solid rgba(245,242,220,0.15)" }}
      >
        &copy; {new Date().getFullYear()}{" "}Christmas Air Conditioning &amp; Plumbing
      </div>
    </footer>
  );
}
