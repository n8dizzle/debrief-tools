"use client";

import AdminTable, { type AdminColumn } from "@/components/AdminTable";
import type { CharityDonation, Charity, Referral, Referrer } from "@/lib/supabase";
import DonationActions from "./DonationActions";

export type DonationRow = CharityDonation & {
  charity: Pick<Charity, "name" | "fulfillment_method">;
  referral: Pick<Referral, "referred_name"> & {
    referrer: Pick<Referrer, "first_name" | "last_name">;
  };
};

function DonationStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "rgba(184,149,107,0.2)", fg: "#8a6a3a" },
    APPROVED: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af" },
    ISSUED: { bg: "rgba(97,139,96,0.15)", fg: "#415440" },
    CONFIRMED: { bg: "rgba(34,197,94,0.15)", fg: "#15803d" },
    FAILED: { bg: "rgba(135,76,59,0.15)", fg: "#874c3b" },
  };
  const s = styles[status] || styles.PENDING;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {status.toLowerCase()}
    </span>
  );
}

const COLUMNS: AdminColumn<DonationRow>[] = [
  {
    key: "charity",
    label: "Charity",
    sortable: true,
    sortValue: (d) => (d.charity?.name ?? "").toLowerCase(),
    searchValue: (d) => d.charity?.name ?? "",
    render: (d) => <>{d.charity?.name || "—"}</>,
  },
  {
    key: "method",
    label: "Method",
    render: (d) => (
      <span className="text-xs opacity-70">
        {(d.charity?.fulfillment_method || "").toLowerCase().replace(/_/g, " ")}
      </span>
    ),
  },
  {
    key: "from_referrer",
    label: "From referrer",
    sortable: true,
    sortValue: (d) =>
      `${d.referral?.referrer?.first_name ?? ""} ${d.referral?.referrer?.last_name ?? ""}`.toLowerCase(),
    searchValue: (d) =>
      `${d.referral?.referrer?.first_name ?? ""} ${d.referral?.referrer?.last_name ?? ""}`,
    render: (d) => (
      <>
        {d.referral?.referrer?.first_name} {d.referral?.referrer?.last_name}
      </>
    ),
  },
  {
    key: "for_friend",
    label: "For friend",
    searchValue: (d) => d.referral?.referred_name ?? "",
    render: (d) => (
      <span className="opacity-80">{d.referral?.referred_name}</span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    sortable: true,
    sortValue: (d) => Number(d.amount),
    className: "text-right font-semibold",
    render: (d) => <>${Number(d.amount).toFixed(0)}</>,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortValue: (d) => d.status,
    render: (d) => (
      <>
        <DonationStatusBadge status={d.status} />
        {d.failure_reason && (
          <div
            className="text-xs mt-1 opacity-80"
            style={{ color: "var(--ca-red)" }}
          >
            {d.failure_reason.slice(0, 80)}
          </div>
        )}
      </>
    ),
  },
  {
    key: "actions",
    label: "Actions",
    render: (d) => (
      <>{d.status === "PENDING" && <DonationActions donationId={d.id} />}</>
    ),
  },
];

interface Props {
  rows: DonationRow[];
}

export default function DonationsTable({ rows }: Props) {
  return (
    <AdminTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(d) => d.id}
      searchPlaceholder="Search by charity, referrer, or friend…"
      emptyMessage="No donations match this filter."
    />
  );
}
