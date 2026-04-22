import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getAllSettings } from "@/lib/settings";
import { getServerSupabase } from "@/lib/supabase";
import SettingsEditor from "./SettingsEditor";

export const dynamic = "force-dynamic";

async function getTripleWinCounts(): Promise<{
  withCharity: number;
  withoutCharity: number;
  eligibleForAnnouncement: number;
}> {
  const supabase = getServerSupabase();
  const [withCharity, withoutCharity, eligibleForAnnouncement] =
    await Promise.all([
      supabase
        .from("ref_referrers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .not("selected_charity_id", "is", null),
      supabase
        .from("ref_referrers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .is("selected_charity_id", null),
      supabase
        .from("ref_referrers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .is("selected_charity_id", null)
        .is("triple_win_announcement_sent_at", null),
    ]);
  return {
    withCharity: withCharity.count ?? 0,
    withoutCharity: withoutCharity.count ?? 0,
    eligibleForAnnouncement: eligibleForAnnouncement.count ?? 0,
  };
}

export default async function SettingsPage() {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-3xl mb-2">Settings</h1>
        <p className="opacity-80">
          You don&apos;t have permission to view or edit program settings. Ask
          an owner to grant you <code>referrals.can_manage_settings</code> in
          the portal.
        </p>
      </div>
    );
  }

  const [settings, tripleWinCounts] = await Promise.all([
    getAllSettings(),
    getTripleWinCounts(),
  ]);

  // Hide triple_win_enabled from the settings list. It's pinned to true by
  // migration 010 and deleted in PR2. No editable UI surface while the
  // kill-switch code is still being torn out.
  const visibleSettings = settings.filter((s) => s.key !== "triple_win_enabled");

  return (
    <div>
      <h1 className="text-3xl mb-2">Settings</h1>
      <p className="opacity-70 mb-8 text-sm max-w-xl">
        Runtime config for the referrals program. Changes take effect
        immediately — no redeploy needed.
      </p>
      <SettingsEditor
        initial={visibleSettings}
        tripleWinCounts={tripleWinCounts}
      />
    </div>
  );
}
