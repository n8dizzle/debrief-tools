"use client";

import AdminTable, { type AdminColumn } from "@/components/AdminTable";
import type { Referral, Referrer } from "@/lib/supabase";
import { stLeadUrl, stBookingUrl } from "@/lib/servicetitan-links";
import STLinkBadge from "@/components/STLinkBadge";
import TagInSTButton from "./TagInSTButton";
import SimulateCompletionButton from "./SimulateCompletionButton";

type ReferralRow = Referral & {
  referrer: Pick<Referrer, "first_name" | "last_name" | "referral_code">;
};

function ReferralStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    SUBMITTED: { bg: "rgba(184,149,107,0.2)", fg: "#8a6a3a", label: "Submitted" },
    BOOKED: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af", label: "Booked" },
    COMPLETED: { bg: "rgba(97,139,96,0.15)", fg: "#415440", label: "Completed" },
    REWARD_ISSUED: { bg: "rgba(34,197,94,0.15)", fg: "#15803d", label: "Reward issued" },
    EXPIRED: { bg: "rgba(135,76,59,0.1)", fg: "#874c3b", label: "Expired" },
    INELIGIBLE: { bg: "rgba(0,0,0,0.05)", fg: "#6b7280", label: "Ineligible" },
  };
  const s = styles[status] || styles.SUBMITTED;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

const COLUMNS: AdminColumn<ReferralRow>[] = [
  {
    key: "friend",
    label: "Friend",
    searchValue: (r) => `${r.referred_name} ${r.referred_phone}`,
    render: (r) => (
      <>
        {r.referred_name}
        <div className="text-xs opacity-60">{r.referred_phone}</div>
      </>
    ),
  },
  {
    key: "referred_by",
    label: "Referred by",
    sortable: true,
    sortValue: (r) =>
      `${r.referrer.first_name} ${r.referrer.last_name}`.toLowerCase(),
    searchValue: (r) =>
      `${r.referrer.first_name} ${r.referrer.last_name} ${r.referrer.referral_code}`,
    render: (r) => (
      <>
        {r.referrer.first_name} {r.referrer.last_name}
        <div className="text-xs opacity-60">
          <code>{r.referrer.referral_code}</code>
        </div>
      </>
    ),
  },
  {
    key: "service",
    label: "Service",
    searchValue: (r) => r.service_requested ?? "",
    render: (r) => (
      <span className="opacity-80 text-xs max-w-xs block">{r.service_requested}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    sortValue: (r) => r.status,
    render: (r) => <ReferralStatusBadge status={r.status} />,
  },
  {
    key: "servicetitan",
    label: "ServiceTitan",
    render: (r) => (
      <div className="flex flex-col gap-1.5">
        {r.service_titan_booking_id ? (
          <div className="flex flex-col gap-0.5">
            <STLinkBadge
              id={r.service_titan_booking_id}
              href={stBookingUrl(r.service_titan_booking_id)}
            />
            <span className="text-[10px] uppercase tracking-wide opacity-60">
              booking
            </span>
          </div>
        ) : r.service_titan_lead_id ? (
          <div className="flex flex-col gap-0.5">
            <STLinkBadge
              id={r.service_titan_lead_id}
              href={stLeadUrl(r.service_titan_lead_id)}
            />
            <span className="text-[10px] uppercase tracking-wide opacity-60">
              lead
            </span>
          </div>
        ) : (
          <STLinkBadge
            id={null}
            href={null}
            emptyTitle="No ServiceTitan booking or lead was created — either neither ID was configured in Settings at submission, or ST was unreachable"
          />
        )}
        <TagInSTButton
          referralId={r.id}
          customerId={r.service_titan_customer_id}
        />
        <SimulateCompletionButton referralId={r.id} status={r.status} />
      </div>
    ),
  },
  {
    key: "invoice",
    label: "Invoice",
    sortable: true,
    sortValue: (r) => (r.invoice_total != null ? Number(r.invoice_total) : -1),
    className: "text-right",
    render: (r) => (
      <>{r.invoice_total ? `$${Number(r.invoice_total).toFixed(0)}` : "—"}</>
    ),
  },
  {
    key: "submitted",
    label: "Submitted",
    sortable: true,
    sortValue: (r) => r.submitted_at,
    render: (r) => (
      <span className="opacity-70 text-xs">
        {new Date(r.submitted_at).toLocaleDateString()}
      </span>
    ),
  },
];

interface Props {
  rows: ReferralRow[];
}

export default function ReferralsTable({ rows }: Props) {
  return (
    <AdminTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      searchPlaceholder="Search by name, phone, code, or service…"
      emptyMessage="No referrals match this filter."
    />
  );
}
