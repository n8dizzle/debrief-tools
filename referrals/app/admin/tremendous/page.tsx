import { requireReferralsAdmin } from "@/lib/admin-auth";
import TremendousTester, { type TremendousEnvInfo } from "./TremendousTester";

export const dynamic = "force-dynamic";

export default async function TremendousPage() {
  const admin = await requireReferralsAdmin("can_manage_settings");
  if (!admin) {
    return (
      <div className="card max-w-xl">
        <h1 className="text-3xl mb-2">Tremendous</h1>
        <p className="opacity-80">
          You don&apos;t have permission to manage Tremendous settings. Ask an
          owner to grant you <code>referrals.can_manage_settings</code>.
        </p>
      </div>
    );
  }

  // Env-var visibility only. API key itself is never read into the payload.
  const envInfo: TremendousEnvInfo = {
    apiKeySet: !!process.env.TREMENDOUS_API_KEY,
    env: (process.env.TREMENDOUS_ENV || "production").toLowerCase(),
    fundingSourceId: process.env.TREMENDOUS_FUNDING_SOURCE_ID || null,
    campaignId: process.env.TREMENDOUS_CAMPAIGN_ID || null,
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl mb-2">Tremendous</h1>
      <p className="opacity-80 mb-8 max-w-xl text-sm">
        Test harness for the Tremendous integration. Verify credentials with a
        ping, send a sandbox test reward end-to-end, and confirm everything
        works before real customer rewards start flowing.
      </p>
      <TremendousTester env={envInfo} adminEmail={admin.email} />
    </div>
  );
}
