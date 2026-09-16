"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  CalendarDays,
  FileText,
  Wallet,
  Coins,
  Wrench,
  GitBranch,
  BadgePercent,
  Sparkles,
  ChevronDown,
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
  calendar: CalendarDays,
  contracts: FileText,
  payments: Wallet,
  expenses: Coins,
  maintenance: Wrench,
  branches: GitBranch,
  pricing: BadgePercent,
  extras: Sparkles,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: IconKey; section?: string };

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(true);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  const navigationPending = pendingHref !== null && pathname !== pendingHref;

  const groups = items.reduce<Array<{ section?: string; items: NavItem[] }>>((result, item) => {
    const last = result[result.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else result.push({ section: item.section, items: [item] });
    return result;
  }, []);

  const renderItem = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const shouldPrefetch = item.section === "Quotidien" || item.href === "/agency";
    return (
      <Link
        key={item.href}
        href={item.href}
        // Prefetch only on intent (hover/focus) for daily routes. This keeps a
        // persistent sidebar from launching authenticated requests for every
        // visible link while still making the next likely click feel instant.
        prefetch={false}
        onMouseEnter={() => { if (shouldPrefetch) void router.prefetch(item.href); }}
        onFocus={() => { if (shouldPrefetch) void router.prefetch(item.href); }}
        onClick={(event) => {
          setOpen(false);
          if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0 && !isActive(item.href)) {
            setPendingHref(item.href);
          }
        }}
        aria-current={isActive(item.href) ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive(item.href)
            ? "bg-sidebar-accent text-white shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
            : pendingHref === item.href
              ? "bg-sidebar-accent/70 text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white",
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary transition-opacity",
            isActive(item.href) ? "opacity-100" : "opacity-0 group-hover:opacity-40",
          )}
        />
        <Icon className={cn("size-4 shrink-0", (isActive(item.href) || pendingHref === item.href) ? "text-primary" : "")} />
        {item.label}
      </Link>
    );
  };

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
      {groups.map((group, index) => {
        if (group.section === "Plus") {
          return (
            <div key={group.section} className={cn(index > 0 && "border-t border-white/10 pt-4")}>
              <button
                type="button"
                onClick={() => setPlusOpen((value) => !value)}
                className="flex w-full items-center justify-between px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60"
                aria-expanded={plusOpen}
              >
                Plus
                <ChevronDown className={cn("size-3.5 transition-transform", plusOpen && "rotate-180")} />
              </button>
              {plusOpen && <div className="space-y-1">{group.items.map(renderItem)}</div>}
            </div>
          );
        }
        return (
          <div key={group.section ?? `section-${index}`} className={cn(index > 0 && "border-t border-white/10 pt-4")}>
            {group.section && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">{group.section}</p>}
            <div className="space-y-1">{group.items.map(renderItem)}</div>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      {navigationPending && <div aria-label="Chargement de la page" className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-primary/15"><div className="h-full w-1/3 animate-[fh-progress_900ms_ease-in-out_infinite] bg-primary" /></div>}
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-sidebar px-4 py-3 text-white lg:hidden">
        <div className="min-w-0">{brand}</div>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar shadow-2xl">
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
      <aside className="hidden w-[268px] shrink-0 flex-col border-r border-white/5 bg-[linear-gradient(180deg,var(--sidebar),color-mix(in_srgb,var(--sidebar)_88%,#172554))] lg:flex">
        <div className="border-b border-white/10 px-5 py-5 text-white">{brand}</div>
        {nav}
        {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
      </aside>
    </>
  );
}
