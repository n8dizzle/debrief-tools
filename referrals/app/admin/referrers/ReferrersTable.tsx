"use client";

import AdminTable, { type AdminColumn } from "@/components/AdminTable";
import type { Referrer } from "@/lib/supabase";
import STCustomerEdit from "./STCustomerEdit";
import DeleteReferrerButton from "./DeleteReferrerButton";

export interface ReferrerRow extends Referrer {
  charity?: { id: string; name: string } | null;
  suggested_charity_name: string | null;
}

const COLUMNS: AdminColumn<ReferrerRow>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    sortValue: (r) => `${r.first_name} ${r.last_name}`.toLowerCase(),
    searchValue: (r) => `${r.first_name} ${r.last_name}`,
    render: (r) => (
      <>
        {r.first_name} {r.last_name}
        {!r.is_active && (
          <span className="ml-2 text-xs opacity-60">(inactive)</span>
        )}
      </>
    ),
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    sortValue: (r) => r.email.toLowerCase(),
    searchValue: (r) => r.email,
    render: (r) => <span className="opacity-70">{r.email}</span>,
  },
  {
    key: "code",
    label: "Code",
    searchValue: (r) => r.referral_code,
    render: (r) => <code className="text-xs">{r.referral_code}</code>,
  },
  {
    key: "st_customer",
    label: "ST customer",
    render: (r) => (
      <STCustomerEdit referrerId={r.id} initialId={r.service_titan_id} />
    ),
  },
  {
    key: "charity",
    label: "Charity",
    searchValue: (r) =>
      r.charity?.name ?? r.suggested_charity_name ?? "",
    render: (r) => (
      <span className="text-xs">
        {r.charity ? (
          r.charity.name
        ) : r.suggested_charity_name ? (
          <span className="italic opacity-70">
            💡 {r.suggested_charity_name}
          </span>
        ) : (
          <span className="opacity-50">—</span>
        )}
      </span>
    ),
  },
  {
    key: "lifetime",
    label: "Lifetime",
    sortable: true,
    sortValue: (r) => r.lifetime_referrals,
    className: "text-right",
    render: (r) => <>{r.lifetime_referrals}</>,
  },
  {
    key: "earned",
    label: "Earned",
    sortable: true,
    sortValue: (r) => Number(r.total_earned),
    className: "text-right",
    render: (r) => <>${Number(r.total_earned).toFixed(0)}</>,
  },
  {
    key: "donated",
    label: "Donated",
    sortable: true,
    sortValue: (r) => Number(r.total_donated_on_their_behalf),
    className: "text-right",
    render: (r) => <>${Number(r.total_donated_on_their_behalf).toFixed(0)}</>,
  },
  {
    key: "enrolled",
    label: "Enrolled",
    sortable: true,
    sortValue: (r) => r.enrolled_at,
    render: (r) => (
      <span className="opacity-70 text-xs">
        {new Date(r.enrolled_at).toLocaleDateString()}
      </span>
    ),
  },
  {
    key: "actions",
    label: "",
    render: (r) => (
      <DeleteReferrerButton
        referrerId={r.id}
        name={`${r.first_name} ${r.last_name}`}
      />
    ),
  },
];

interface Props {
  rows: ReferrerRow[];
}

export default function ReferrersTable({ rows }: Props) {
  return (
    <AdminTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      searchPlaceholder="Search by name, email, code, or charity…"
      emptyMessage="No referrers yet."
    />
  );
}
