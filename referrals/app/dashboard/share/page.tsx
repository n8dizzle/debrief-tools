import { redirect } from "next/navigation";
import { getCurrentReferrer } from "@/lib/customer-auth";
import ShareTools from "./ShareTools";

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const referrer = await getCurrentReferrer();
  if (!referrer) redirect("/sign-in");

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl mb-2">Share your link</h1>
      <p className="opacity-80 mb-8">
        Different ways to get your link in front of neighbors. Your link works
        as many times as you need.
      </p>
      <ShareTools
        referralLink={referrer.referral_link}
        referrerFirstName={referrer.first_name}
      />
    </div>
  );
}
