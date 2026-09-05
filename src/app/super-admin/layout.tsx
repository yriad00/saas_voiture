import { requireSuperAdmin } from "@/lib/auth/session";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

const NAV: NavItem[] = [
  { href: "/super-admin", label: "Dashboard", icon: "dashboard" },
  { href: "/super-admin/agencies", label: "Agencies", icon: "agencies" },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: "subscriptions" },
  { href: "/super-admin/plans", label: "Plans", icon: "plans" },
  { href: "/super-admin/analytics", label: "Analytics", icon: "analytics" },
  { href: "/super-admin/audit-logs", label: "Audit Logs", icon: "audit" },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        brand={
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">FleetHub</span>
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Admin
            </span>
          </div>
        }
        items={NAV}
        footer={
          <UserMenu name={ctx.profile.full_name ?? "Admin"} subtitle="Super Admin" />
        }
      />
      <main className="flex-1 overflow-x-hidden bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
