import { getServerSupabase } from "@/lib/supabase";
import type { Referrer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getReferrers(): Promise<Referrer[]> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_referrers")
    .select("*")
    .order("enrolled_at", { ascending: false })
    .limit(200);
  return (data as Referrer[]) || [];
}

export default async function ReferrersPage() {
  const referrers = await getReferrers();

  return (
    <div>
      <h1 className="text-4xl mb-2">Referrers</h1>
      <p className="opacity-70 mb-6">
        {referrers.length} enrolled (showing most recent 200)
      </p>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--bg-muted)" }}>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Code</Th>
              <Th>Triple Win</Th>
              <Th className="text-right">Lifetime</Th>
              <Th className="text-right">Earned</Th>
              <Th className="text-right">Donated</Th>
              <Th>Enrolled</Th>
            </tr>
          </thead>
          <tbody>
            {referrers.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <Td>
                  {r.first_name} {r.last_name}
                  {!r.is_active && (
                    <span className="ml-2 text-xs opacity-60">(inactive)</span>
                  )}
                </Td>
                <Td className="opacity-70">{r.email}</Td>
                <Td>
                  <code className="text-xs">{r.referral_code}</code>
                </Td>
                <Td>
                  {r.triple_win_enabled ? (
                    <span className="badge-trust" style={{ fontSize: "0.7rem" }}>
                      ON
                    </span>
                  ) : (
                    <span className="opacity-50 text-xs">off</span>
                  )}
                </Td>
                <Td className="text-right">{r.lifetime_referrals}</Td>
                <Td className="text-right">${Number(r.total_earned).toFixed(0)}</Td>
                <Td className="text-right">
                  ${Number(r.total_donated_on_their_behalf).toFixed(0)}
                </Td>
                <Td className="opacity-70 text-xs">
                  {new Date(r.enrolled_at).toLocaleDateString()}
                </Td>
              </tr>
            ))}
            {referrers.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center opacity-60">
                  No referrers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`text-left p-3 text-xs font-semibold uppercase tracking-wide ${className}`}
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 ${className}`}>{children}</td>;
}
