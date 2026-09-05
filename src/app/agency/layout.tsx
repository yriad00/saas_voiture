import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

const NAV: NavItem[] = [
  { href: "/agency", label: "Tableau de bord", icon: "dashboard" },
  { href: "/agency/fleet", label: "Flotte", icon: "fleet" },
  { href: "/agency/customers", label: "Clients", icon: "customers" },
  { href: "/agency/reservations", label: "Réservations", icon: "reservations" },
  { href: "/agency/contracts", label: "Contrats", icon: "contracts" },
  { href: "/agency/payments", label: "Paiements", icon: "payments" },
  { href: "/agency/maintenance", label: "Maintenance", icon: "maintenance" },
  { href: "/agency/team", label: "Équipe", icon: "team" },
  { href: "/agency/settings", label: "Paramètres", icon: "settings" },
];

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAgency();

  // §8 — business features are gated on the agency being operational.
  if (!["ACTIVE", "TRIAL"].includes(ctx.membership.agencyStatus)) {
    redirect("/no-access");
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        brand={
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-white/15">
              <Car className="size-4 text-white" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{ctx.membership.agencyName}</p>
              <p className="text-[10px] uppercase tracking-wide text-sidebar-foreground">FleetHub</p>
            </div>
          </div>
        }
        items={NAV}
        footer={
          <UserMenu
            name={ctx.profile.full_name ?? ctx.profile.email ?? "User"}
            subtitle={ctx.membership.roleName}
          />
        }
      />
      <main className="flex-1 overflow-x-hidden bg-background">
        <div className="fh-animate-in mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
