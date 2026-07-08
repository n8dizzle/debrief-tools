import Link from "next/link";

// Root landing at training.christmasair.com. Techs never see this — they arrive at
// /train?t=<token> from a texted link. This is just so the bare domain isn't a raw 404:
// a friendly note for techs + a manager sign-in path.
export default function HomePage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          padding: 32,
          width: "100%",
          maxWidth: 440,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "var(--christmas-green-light)",
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          CHRISTMAS AIR
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 16px" }}>Training</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 16, lineHeight: 1.55 }}>
          Technicians: open the training link we texted you. No login needed.
        </p>
        <div style={{ marginTop: 28, borderTop: "1px solid var(--border-subtle)", paddingTop: 20 }}>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 12 }}>
            Managers & office staff
          </p>
          <Link
            href="/admin"
            style={{
              display: "inline-block",
              padding: "12px 20px",
              borderRadius: 10,
              background: "var(--christmas-green)",
              color: "var(--christmas-cream)",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Admin sign-in
          </Link>
        </div>
      </div>
    </main>
  );
}
