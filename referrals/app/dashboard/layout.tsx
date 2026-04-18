import { redirect } from "next/navigation";
import { getCurrentReferrer } from "@/lib/customer-auth";
import SiteFooter from "@/components/SiteFooter";
import DashboardHeader from "./DashboardHeader";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const referrer = await getCurrentReferrer();
  if (!referrer) redirect("/sign-in");

  return (
    <>
      <DashboardHeader firstName={referrer.first_name} />
      <main className="px-6 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
