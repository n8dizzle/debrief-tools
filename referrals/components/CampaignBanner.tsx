/**
 * Promo banner driven by ref_reward_configs.campaign_label. Renders only when
 * the admin has set a label in /admin/config. Mounted on the 3 conversion
 * pages (/dashboard, /refer/[code], /enroll) — not the deep marketing pages,
 * which stay evergreen.
 *
 * Server-safe: no hooks, no state, no client-side fetching. Parent pages
 * pass the label down from getCurrentProgram().
 */
export default function CampaignBanner({ label }: { label: string | null }) {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  return (
    <div
      className="px-4 md:px-6 py-3"
      style={{
        background: "rgba(97,139,96,0.10)",
        borderBottom: "1px solid var(--ca-green)",
        color: "var(--ca-dark-green)",
      }}
      role="status"
      aria-label="Active campaign"
    >
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <span
          aria-hidden="true"
          className="text-lg"
          style={{ lineHeight: 1 }}
        >
          ★
        </span>
        <p className="text-sm md:text-base font-semibold">{trimmed}</p>
      </div>
    </div>
  );
}
