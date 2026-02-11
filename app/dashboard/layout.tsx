import DashboardAppShell from "./_components/dashboard_app_shell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardAppShell>{children}</DashboardAppShell>;
}
