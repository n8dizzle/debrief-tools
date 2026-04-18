import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import type { RewardConfig, RewardTier } from "@/lib/supabase";
import EditConfig from "./EditConfig";

export const dynamic = "force-dynamic";

async function getConfig(
  id: string
): Promise<(RewardConfig & { tiers: RewardTier[] }) | null> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("ref_reward_configs")
    .select("*, tiers:ref_reward_tiers(*)")
    .eq("id", id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any) || null;
}

export default async function EditConfigPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const config = await getConfig(id);
  if (!config) notFound();

  const tiers = (config.tiers || []).sort((a, b) =>
    a.service_category.localeCompare(b.service_category)
  );

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/config"
        className="text-sm opacity-70"
        style={{ color: "var(--ca-dark-green)" }}
      >
        ← All configs
      </Link>
      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="text-4xl">{config.name}</h1>
          {config.description && (
            <p className="opacity-80 mt-1">{config.description}</p>
          )}
        </div>
        <Link
          href={`/admin/config/${id}/history`}
          className="btn btn-secondary text-sm"
        >
          Change log →
        </Link>
      </div>

      <EditConfig config={config} tiers={tiers} />
    </div>
  );
}
