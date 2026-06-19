"use client";

import { useState, useMemo } from "react";
import AdminTable, { type AdminColumn } from "@/components/AdminTable";
import type { Referrer } from "@/lib/supabase";
import STCustomerEdit from "./STCustomerEdit";
import DeleteReferrerButton from "./DeleteReferrerButton";
import ReferrerTypeTag from "./ReferrerTypeTag";

export interface ReferrerRow extends Referrer {
  charity?: { id: string; name: string } | null;
  suggested_charity_name: string | null;
}

type Filter = "all" | "no_st" | "customers" | "employees";

const COLUMNS: AdminColumn<ReferrerRow>[] = [
  {
    key: "name",
    label: "Name",
    sortable: true,
    width: 180,
    truncate: true,
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
    key: "type",
    label: "Type",
    sortable: true,
    width: 130,
    sortValue: (r) => r.referrer_type ?? "",
    searchValue: (r) => r.referrer_type ?? "",
    render: (r) => (
      <ReferrerTypeTag referrerId={r.id} initialType={r.referrer_type} />
    ),
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    width: 230,
    truncate: true,
    sortValue: (r) => r.email.toLowerCase(),
    searchValue: (r) => r.email,
    render: (r) => <span className="opacity-70">{r.email}</span>,
  },
  {
    key: "code",
    label: "Code",
    width: 140,
    truncate: true,
    searchValue: (r) => r.referral_code,
    render: (r) => <code className="text-xs">{r.referral_code}</code>,
  },
  {
    key: "st_customer",
    label: "ST customer",
    width: 150,
    render: (r) => (
      <STCustomerEdit referrerId={r.id} initialId={r.service_titan_id} />
    ),
  },
  {
    key: "charity",
    label: "Charity",
    width: 200,
    truncate: true,
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
    width: 95,
    sortValue: (r) => r.lifetime_referrals,
    className: "text-right",
    render: (r) => <>{r.lifetime_referrals}</>,
  },
  {
    key: "earned",
    label: "Earned",
    sortable: true,
    width: 95,
    sortValue: (r) => Number(r.total_earned),
    className: "text-right",
    render: (r) => <>${Number(r.total_earned).toFixed(0)}</>,
  },
  {
    key: "donated",
    label: "Donated",
    sortable: true,
    width: 95,
    sortValue: (r) => Number(r.total_donated_on_their_behalf),
    className: "text-right",
    render: (r) => <>${Number(r.total_donated_on_their_behalf).toFixed(0)}</>,
  },
  {
    key: "enrolled",
    label: "Enrolled",
    sortable: true,
    width: 115,
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
    width: 70,
    minWidth: 50,
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

const FILTERS: { key: Filter; label: string; count: (rows: ReferrerRow[]) => number }[] = [
  { key: "all",       label: "All",           count: (r) => r.length },
  { key: "no_st",     label: "No ST Link",    count: (r) => r.filter((x) => !x.service_titan_id).length },
  { key: "customers", label: "Customers",     count: (r) => r.filter((x) => x.referrer_type === "CUSTOMER" || !x.referrer_type).length },
  { key: "employees", label: "Employees",     count: (r) => r.filter((x) => x.referrer_type === "EMPLOYEE").length },
];

export default function ReferrersTable({ rows }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all")       return rows;
    if (filter === "no_st")     return rows.filter((r) => !r.service_titan_id);
    if (filter === "customers") return rows.filter((r) => r.referrer_type === "CUSTOMER" || !r.referrer_type);
    if (filter === "employees") return rows.filter((r) => r.referrer_type === "EMPLOYEE");
    return rows;
  }, [rows, filter]);

  const linked   = rows.filter((r) => !!r.service_titan_id).length;
  const unlinked = rows.filter((r) => !r.service_titan_id).length;

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(({ key, label, count }) => {
          const n = count(rows);
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
              style={{
                background: active ? "var(--christmas-green)" : "var(--bg-muted)",
                color: active ? "#fff" : "var(--text-muted)",
                border: `1px solid ${active ? "var(--christmas-green)" : "var(--border-subtle)"}`,
              }}
            >
              {label}
              <span
                className="ml-1.5 opacity-75"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {n}
              </span>
            </button>
          );
        })}

        {/* ST link summary */}
        <span
          className="ml-auto text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {linked} ST linked · <span style={{ color: unlinked > 0 ? "var(--ca-red, #c0392b)" : "inherit" }}>{unlinked} not linked</span>
        </span>
      </div>

      <AdminTable
        tableId="referrers"
        columns={COLUMNS}
        rows={filtered}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by name, email, code, or charity…"
        emptyMessage={filter === "no_st" ? "All referrers have an ST link! ✅" : "No referrers yet."}
      />
    </div>
  );
}
