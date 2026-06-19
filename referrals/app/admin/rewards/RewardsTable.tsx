"use client";

import AdminTable, { type AdminColumn } from "@/components/AdminTable";
import type { Reward, Referrer } from "@/lib/supabase";
import { tremendousOrderUrl } from "@/lib/servicetitan-links";
import STLinkBadge from "@/components/STLinkBadge";
import RewardActions from "./RewardActions";

type RewardRow = Reward & {
  referrer: Pick<Referrer, "first_name" | "last_name" | "email">;
};

function RewardStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    PENDING: { bg: "rgba(184,149,107,0.2)", fg: "#8a6a3a" },
    APPROVED: { bg: "rgba(59,130,246,0.15)", fg: "#1e40af" },
    ISSUED: { bg: "rgba(97,139,96,0.15)", fg: "#415440" },
    DELIVERED: { bg: "rgba(34,197,94,0.15)", fg: "#15803d" },
    FAILED: { bg: "rgba(135,76,59,0.15)", fg: "#874c3b" },
    CANCELLED: { bg: "rgba(0,0,0,0.05)", fg: "#6b7280" },
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

function buildColumns(tremendousEnv: string): AdminColumn<RewardRow>[] {
  return [
    {
      key: "referrer",
      label: "Referrer",
      sortable: true,
      width: 220,
      sortValue: (r) =>
        `${r.referrer.first_name} ${r.referrer.last_name}`.toLowerCase(),
      searchValue: (r) =>
        `${r.referrer.first_name} ${r.referrer.last_name} ${r.referrer.email}`,
      render: (r) => (
        <>
          {r.referrer.first_name} {r.referrer.last_name}
          <div className="text-xs opacity-60 truncate">{r.referrer.email}</div>
        </>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      width: 100,
      sortValue: (r) => Number(r.amount),
      className: "text-right font-semibold",
      render: (r) => <>${Number(r.amount).toFixed(0)}</>,
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      width: 150,
      truncate: true,
      sortValue: (r) => r.type,
      searchValue: (r) => r.type.replace(/_/g, " "),
      render: (r) => (
        <span className="text-xs opacity-80">{r.type.replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      width: 170,
      sortValue: (r) => r.status,
      render: (r) => (
        <>
          <RewardStatusBadge status={r.status} />
          {r.tremendous_status === "pending_approval" && (
            <div className="text-xs mt-1 opacity-80" style={{ color: "#8a6a3a" }}>
              waiting on Tremendous
            </div>
          )}
          {r.failure_reason && (
            <div
              className="text-xs mt-1 opacity-80"
              style={{ color: "var(--ca-red)" }}
            >
              {r.failure_reason.slice(0, 80)}
            </div>
          )}
        </>
      ),
    },
    {
      key: "tremendous",
      label: "Tremendous",
      width: 140,
      render: (r) => (
        <STLinkBadge
          id={r.tremendous_order_id}
          href={tremendousOrderUrl(r.tremendous_order_id, tremendousEnv)}
          emptyTitle="No Tremendous order yet — reward hasn't been fulfilled"
        />
      ),
    },
    {
      key: "created",
      label: "Created",
      sortable: true,
      width: 115,
      sortValue: (r) => r.created_at,
      render: (r) => (
        <span className="opacity-70 text-xs">
          {new Date(r.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: 120,
      render: (r) => (
        <>{r.status === "PENDING" && <RewardActions rewardId={r.id} />}</>
      ),
    },
  ];
}

interface Props {
  rows: RewardRow[];
  tremendousEnv: string;
}

export default function RewardsTable({ rows, tremendousEnv }: Props) {
  const columns = buildColumns(tremendousEnv);
  return (
    <AdminTable
      tableId="rewards"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      searchPlaceholder="Search by name or email…"
      emptyMessage="No rewards match this filter."
    />
  );
}
