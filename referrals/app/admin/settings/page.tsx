import { requireReferralsAdmin } from "@/lib/admin-auth";
import { getAllSettings } from "@/lib/settings";
import SettingsEditor from "./SettingsEditor";

export const dynamic = "force-dynamic";

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

  const settings = await getAllSettings();

  return (
    <div>
      <h1 className="text-3xl mb-2">Settings</h1>
      <p className="opacity-70 mb-8 text-sm max-w-xl">
        Runtime config for the referrals program. Changes take effect
        immediately — no redeploy needed.
      </p>
      <SettingsEditor initial={settings} />
    </div>
  );
}
