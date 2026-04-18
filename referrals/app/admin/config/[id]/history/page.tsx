import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import type { RewardConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ChangeLogRow {
  id: string;
  reward_config_id: string | null;
  changed_by_admin_id: string | null;
  change_type: string;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  changed_at: string;
  admin: { email: string; name: string | null } | null;
}

async function getData(
  configId: string
): Promise<{ config: RewardConfig; logs: ChangeLogRow[] } | null> {
  const supabase = getServerSupabase();
  const [{ data: config }, { data: logs }] = await Promise.all([
    supabase
      .from("ref_reward_configs")
      .select("*")
      .eq("id", configId)
      .single(),
    supabase
      .from("ref_reward_config_change_log")
      .select(
        "id, reward_config_id, changed_by_admin_id, change_type, before_json, after_json, changed_at, admin:portal_users(email, name)"
      )
      .eq("reward_config_id", configId)
      .order("changed_at", { ascending: false })
      .limit(200),
  ]);

  if (!config) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { config: config as RewardConfig, logs: (logs as any[]) || [] };
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();

  return (
    <div className="max-w-5xl">
      <Link
        href={`/admin/config/${id}`}
        className="text-sm opacity-70"
        style={{ color: "var(--ca-dark-green)" }}
      >
        ← Back to {data.config.name}
      </Link>
      <h1 className="text-4xl mt-2 mb-2">Change log</h1>
      <p className="opacity-70 mb-8">
        Every edit to this config, in reverse chronological order.
      </p>

      {data.logs.length === 0 ? (
        <div className="card text-center opacity-70">
          No changes yet. Edits made via the editor will show up here.
        </div>
      ) : (
        <div className="space-y-3">
          {data.logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: ChangeLogRow }) {
  const diff = computeDiff(log.before_json, log.after_json);

  return (
    <details
      className="card"
      style={{ padding: "0" }}
    >
      <summary className="cursor-pointer p-4 list-none">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--ca-dark-green)" }}
            >
              {humanChangeType(log.change_type)}
            </p>
            <p className="text-xs opacity-70 mt-1">
              by {log.admin?.email || "unknown"} ·{" "}
              {new Date(log.changed_at).toLocaleString()}
            </p>
          </div>
          <p className="text-xs opacity-60">
            {diff.length} field{diff.length === 1 ? "" : "s"}
          </p>
        </div>
      </summary>
      <div
        className="px-4 pb-4 text-sm"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        {diff.length === 0 ? (
          <p className="opacity-60 italic mt-3">
            No field-level changes captured.
          </p>
        ) : (
          <table className="w-full mt-3">
            <thead>
              <tr style={{ background: "var(--bg-muted)" }}>
                <th className="text-left p-2 text-xs uppercase opacity-70">
                  Field
                </th>
                <th className="text-left p-2 text-xs uppercase opacity-70">
                  Before
                </th>
                <th className="text-left p-2 text-xs uppercase opacity-70">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {diff.map((d) => (
                <tr
                  key={d.key}
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <td className="p-2 font-mono text-xs">{d.key}</td>
                  <td
                    className="p-2 font-mono text-xs"
                    style={{ color: "var(--ca-red)" }}
                  >
                    {formatValue(d.before)}
                  </td>
                  <td
                    className="p-2 font-mono text-xs"
                    style={{ color: "var(--ca-green)" }}
                  >
                    {formatValue(d.after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}

function humanChangeType(t: string): string {
  if (t === "CONFIG_METADATA_UPDATED") return "Config settings updated";
  if (t === "CONFIG_ACTIVATED") return "Config activated";
  if (t === "CONFIG_DEACTIVATED") return "Config deactivated";
  if (t === "CONFIG_DUPLICATED_FROM") return "Created by duplication";
  if (t.startsWith("TIER_UPDATED:")) {
    return `Tier updated — ${t.replace("TIER_UPDATED:", "")}`;
  }
  return t;
}

interface DiffEntry {
  key: string;
  before: unknown;
  after: unknown;
}

const IGNORED_KEYS = new Set([
  "updated_at",
  "created_at",
  "id",
  "reward_config_id",
]);

function computeDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): DiffEntry[] {
  if (!before && !after) return [];
  if (!before || !after) {
    // Show the non-null side as "all set" — useful for duplicate/create
    const source = (after || before) as Record<string, unknown>;
    return Object.entries(source)
      .filter(([k]) => !IGNORED_KEYS.has(k))
      .map(([key, val]) => ({
        key,
        before: !before ? "(none)" : null,
        after: !after ? "(removed)" : val,
      }));
  }

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: DiffEntry[] = [];
  for (const key of allKeys) {
    if (IGNORED_KEYS.has(key)) continue;
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({ key, before: b, after: a });
    }
  }
  return out.sort((x, y) => x.key.localeCompare(y.key));
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}
