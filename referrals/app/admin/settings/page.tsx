import { getAllSettings } from "@/lib/settings";
import SettingsEditor from "./SettingsEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
