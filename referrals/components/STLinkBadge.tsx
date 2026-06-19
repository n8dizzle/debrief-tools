interface STLinkBadgeProps {
  id: string | number | null | undefined;
  href: string | null;
  /** Label shown when id is missing. Defaults to a muted em dash. */
  emptyLabel?: string;
  /** Tooltip on the empty state. */
  emptyTitle?: string;
  /** When true and an id exists but href is null, show the id as a muted
   *  (non-clickable) pill instead of the empty label. Useful when the id is
   *  meaningful (e.g. a Booking number) but its link target isn't available. */
  showIdWhenUnlinked?: boolean;
}

/**
 * Tiny pill showing a ServiceTitan linkage. Clickable when `href` is set —
 * opens the ST record in a new tab. Renders a muted dash when unlinked.
 * Used on the admin Referrers and Referrals tables.
 */
export default function STLinkBadge({
  id,
  href,
  emptyLabel = "—",
  emptyTitle,
  showIdWhenUnlinked = false,
}: STLinkBadgeProps) {
  if (!id || !href) {
    if (id && showIdWhenUnlinked) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: "rgba(0,0,0,0.05)",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
          title={emptyTitle || "Not linked to a ServiceTitan customer yet"}
        >
          {id}
        </span>
      );
    }
    return (
      <span
        className="text-xs opacity-50"
        title={emptyTitle || "No ServiceTitan link"}
      >
        {emptyLabel}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: "rgba(97,139,96,0.12)",
        color: "var(--ca-dark-green)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
      title={`Open in ServiceTitan (${id})`}
    >
      <span>{id}</span>
      <span aria-hidden="true" style={{ fontSize: "0.85em", opacity: 0.7 }}>
        ↗
      </span>
    </a>
  );
}
