import { redirect } from "next/navigation";
import { Car } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { can } from "@/lib/auth/session";
import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

const DAILY_NAV: NavItem[] = [
  { href: "/agency/today", label: "Aujourd’hui", icon: "calendar", section: "Quotidien" },
  { href: "/agency/reservations", label: "Réservations", icon: "reservations", section: "Quotidien" },
  { href: "/agency/contracts", label: "Locations / contrats", icon: "contracts", section: "Quotidien" },
  { href: "/agency/fleet", label: "Véhicules", icon: "fleet", section: "Quotidien" },
  { href: "/agency/customers", label: "Clients", icon: "customers", section: "Quotidien" },
];

const OWNER_NAV: NavItem[] = [
  { href: "/agency", label: "Tableau de bord", icon: "dashboard", section: "Pilotage" },
  ...DAILY_NAV,
  { href: "/agency/calendar", label: "Calendrier", icon: "calendar", section: "Quotidien" },
  { href: "/agency/payments", label: "Paiements", icon: "payments", section: "Gestion" },
  { href: "/agency/caisse", label: "Caisse", icon: "payments", section: "Gestion" },
  { href: "/agency/maintenance", label: "Maintenance", icon: "maintenance", section: "Gestion" },
  { href: "/agency/expenses", label: "Dépenses", icon: "expenses", section: "Gestion" },
  { href: "/agency/operations", label: "Plus d’opérations", icon: "maintenance", section: "Gestion" },
  { href: "/agency/reports", label: "Rapports", icon: "analytics", section: "Gestion" },
  { href: "/agency/team", label: "Équipe", icon: "team", section: "Gestion" },
  { href: "/agency/settings", label: "Paramètres", icon: "settings", section: "Gestion" },
];

const AGENT_PLUS: NavItem[] = [
  { href: "/agency/maintenance", label: "Maintenance", icon: "maintenance", section: "Plus" },
  { href: "/agency/payments", label: "Paiements", icon: "payments", section: "Plus" },
  { href: "/agency/operations", label: "Plus d’opérations", icon: "maintenance", section: "Plus" },
];

function navigationFor(ctx: Awaited<ReturnType<typeof requireAgency>>): NavItem[] {
  const role = ctx.membership.roleKey;
  if (role === "AGENT") {
    return [...DAILY_NAV, ...AGENT_PLUS.filter((item) =>
      item.href === "/agency/maintenance"
        ? can(ctx, "maintenance.view") || can(ctx, "maintenance:read")
        : item.href === "/agency/payments"
          ? can(ctx, "payments.view") || can(ctx, "payments:read")
          : can(ctx, "contracts.update"),
    )];
  }
  if (role === "ACCOUNTANT") {
    return [
      ...DAILY_NAV,
      { href: "/agency/payments", label: "Paiements", icon: "payments", section: "Plus" },
      { href: "/agency/caisse", label: "Caisse", icon: "payments", section: "Plus" },
      { href: "/agency/expenses", label: "Dépenses", icon: "expenses", section: "Plus" },
      { href: "/agency/reports", label: "Rapports", icon: "analytics", section: "Plus" },
    ];
  }
  return OWNER_NAV;
}

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
        items={navigationFor(ctx)}
        footer={
          <UserMenu
            name={ctx.profile.full_name ?? ctx.profile.email ?? "User"}
            subtitle={ctx.membership.roleName}
          />
        }
      />
      <main className="relative flex-1 overflow-x-hidden bg-background">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/[0.035] to-transparent" />
        <div className="fh-animate-in relative mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}
