import DashboardShell from "@/components/DashboardShell";

// Admin shell (SSO-gated by middleware /admin/*). Collapsible sidebar layout,
// modeled on ar.christmasair.com. Tech-facing pages live outside /admin, nav-less.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
