"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Menu,
  X,
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  BarChart3,
  ScrollText,
  Users,
  Settings,
  Car,
  CarFront,
  Contact,
  CalendarCheck,
  FileText,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icon registry — layouts (Server Components) pass a string key, not a component,
// so nothing non-serializable crosses the server→client boundary.
const ICONS = {
  dashboard: LayoutDashboard,
  agencies: Building2,
  subscriptions: CreditCard,
  plans: Package,
  analytics: BarChart3,
  audit: ScrollText,
  team: Users,
  settings: Settings,
  car: Car,
  fleet: CarFront,
  customers: Contact,
  reservations: CalendarCheck,
  contracts: FileText,
  payments: Wallet,
  maintenance: Wrench,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconKey };

export function Sidebar({
  brand,
  items,
  footer,
}: {
  brand: React.ReactNode;
  items: NavItem[];
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
              isActive(item.href)
                ? "bg-sidebar-accent text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all",
                isActive(item.href) ? "opacity-100" : "opacity-0 group-hover:opacity-40",
              )}
            />
            <Icon
              className={cn(
                "size-4 shrink-0 transition-transform group-hover:scale-110",
                isActive(item.href) ? "text-primary" : "",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 text-white lg:hidden">
        <div className="min-w-0">{brand}</div>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 text-white">
              {brand}
              <button onClick={() => setOpen(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <div className="border-b border-white/10 px-5 py-4 text-white">{brand}</div>
        {nav}
        {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
      </aside>
    </>
  );
}
