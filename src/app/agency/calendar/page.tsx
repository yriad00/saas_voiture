import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/stat-card";
import { RESERVATION_STATUS, VEHICLE_CATEGORY, VEHICLE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Calendrier véhicules — FleetHub" };

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

type Event = { kind: "reservation" | "rental" | "maintenance" | "block"; label: string; detail: string; href?: string };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch?: string; category?: string; status?: string }>;
}) {
  const ctx = await requireAgency();
  const params = await searchParams;
  const selected = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const [yearText, monthText] = selected.split("-");
  const parsedYear = Number(yearText);
  const parsedMonth = Number(monthText) - 1;
  const safeDate = Number.isFinite(parsedYear) && parsedMonth >= 0 && parsedMonth <= 11 ? new Date(parsedYear, parsedMonth, 1) : new Date();
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = isoDate(year, month, 1);
  const monthEnd = isoDate(year, month, daysInMonth);
  const previous = new Date(year, month - 1, 1).toISOString().slice(0, 7);
  const next = new Date(year, month + 1, 1).toISOString().slice(0, 7);
  const branchFilter = params.branch && /^[0-9a-f-]{36}$/i.test(params.branch) ? params.branch : "";
  const categoryFilter = params.category && params.category in VEHICLE_CATEGORY ? params.category : "";
  const statusFilter = params.status && params.status in VEHICLE_STATUS ? params.status : "";

  const supabase = await createClient();
  const [{ data: branches }, { data: vehicles }, { data: reservations }, { data: rentals }, { data: maintenance }, { data: blocks }] = await Promise.all([
    supabase.from("branches").select("id, name, code").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name"),
    supabase.from("vehicles").select("id, branch_id, brand, model, license_plate, category, status").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).order("brand").order("model"),
    supabase.from("reservations").select("id, vehicle_id, reference, start_date, end_date, status").eq("agency_id", ctx.membership.agencyId).not("status", "eq", "CANCELLED").lte("start_date", monthEnd).gte("end_date", monthStart),
    supabase.from("contracts").select("id, vehicle_id, contract_number, start_date, end_date, status").eq("agency_id", ctx.membership.agencyId).eq("status", "ACTIVE").lte("start_date", monthEnd).gte("end_date", monthStart),
    supabase.from("maintenance_records").select("id, vehicle_id, type, service_date, next_service_date, status").eq("agency_id", ctx.membership.agencyId).in("status", ["SCHEDULED", "IN_PROGRESS"]).lte("service_date", monthEnd).gte("next_service_date", monthStart),
    supabase.from("vehicle_blocks").select("id, vehicle_id, block_type, reason, start_date, end_date").eq("agency_id", ctx.membership.agencyId).eq("status", "ACTIVE").lte("start_date", monthEnd).gte("end_date", monthStart),
  ]);

  const filteredVehicles = (vehicles ?? []).filter((vehicle) =>
    (!branchFilter || vehicle.branch_id === branchFilter) &&
    (!categoryFilter || vehicle.category === categoryFilter) &&
    (!statusFilter || vehicle.status === statusFilter),
  );
  const dates = Array.from({ length: daysInMonth }, (_, index) => isoDate(year, month, index + 1));
  const monthLabel = new Intl.DateTimeFormat("fr-MA", { month: "long", year: "numeric" }).format(safeDate);
  const dayFormatter = new Intl.DateTimeFormat("fr-MA", { weekday: "short", day: "numeric" });

  const eventsFor = (vehicleId: string, date: string): Event[] => {
    const events: Event[] = [];
    for (const reservation of reservations ?? []) if (reservation.vehicle_id === vehicleId && inRange(date, reservation.start_date, reservation.end_date)) events.push({ kind: "reservation", label: reservation.reference, detail: RESERVATION_STATUS[reservation.status]?.label ?? "Réservation", href: `/agency/reservations/${reservation.id}` });
    for (const rental of rentals ?? []) if (rental.vehicle_id === vehicleId && inRange(date, rental.start_date, rental.end_date)) events.push({ kind: "rental", label: rental.contract_number, detail: "Location active", href: `/agency/contracts/${rental.id}` });
    for (const record of maintenance ?? []) {
      const end = record.next_service_date ?? record.service_date;
      if (record.vehicle_id === vehicleId && inRange(date, record.service_date, end)) events.push({ kind: "maintenance", label: "Maintenance", detail: record.type });
    }
    for (const block of blocks ?? []) if (block.vehicle_id === vehicleId && inRange(date, block.start_date, block.end_date)) events.push({ kind: "block", label: "Blocage", detail: block.reason });
    return events;
  };

  const query = (overrides: Record<string, string>) => {
    const values = { month: selected, branch: branchFilter, category: categoryFilter, status: statusFilter, ...overrides };
    return `/agency/calendar?${new URLSearchParams(Object.entries(values).filter(([, value]) => value)).toString()}`;
  };

  return (
    <>
      <PageHeader title="Calendrier véhicules" description="Timeline par véhicule: réservations, locations actives, maintenance et blocages." action={<Button asChild><Link href="/agency/reservations/new">Nouvelle réservation</Link></Button>} />
      <Card className="mb-6 p-4">
        <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="month" value={selected}  readOnly />
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Branche<select name="branch" defaultValue={branchFilter} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"><option value="">Toutes les branches</option>{(branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}</select></label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Catégorie<select name="category" defaultValue={categoryFilter} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"><option value="">Toutes</option>{Object.entries(VEHICLE_CATEGORY).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">Statut<select name="status" defaultValue={statusFilter} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"><option value="">Tous</option>{Object.entries(VEHICLE_STATUS).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}</select></label>
          <div className="flex items-end"><Button type="submit" variant="outline" className="w-full">Filtrer</Button></div>
          <div className="flex items-end"><Link href={query({ branch: "", category: "", status: "" })} className="flex h-10 w-full items-center justify-center rounded-md border px-3 text-sm hover:bg-muted">Réinitialiser</Link></div>
        </form>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b p-4"><Button asChild variant="ghost" size="sm"><Link href={query({ month: previous })} aria-label="Mois précédent"><ChevronLeft /></Link></Button><h2 className="flex items-center gap-2 text-base font-semibold capitalize"><CalendarDays className="size-4 text-primary" />{monthLabel}</h2><Button asChild variant="ghost" size="sm"><Link href={query({ month: next })} aria-label="Mois suivant"><ChevronRight /></Link></Button></div>
        <div className="overflow-x-auto"><div className="min-w-max">
          <div className="grid border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground" style={{ gridTemplateColumns: `220px repeat(${daysInMonth}, minmax(92px, 1fr))` }}><div className="sticky left-0 z-10 border-r bg-muted/40 p-3 text-left">Véhicule</div>{dates.map((date) => <div key={date} className="border-r p-2">{dayFormatter.format(new Date(`${date}T12:00:00`))}</div>)}</div>
          {(filteredVehicles ?? []).map((vehicle) => <div key={vehicle.id} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `220px repeat(${daysInMonth}, minmax(92px, 1fr))` }}><div className="sticky left-0 z-10 border-r bg-background p-3"><Link href={`/agency/fleet/${vehicle.id}`} className="text-sm font-medium hover:underline">{vehicle.brand} {vehicle.model}</Link><p className="text-xs text-muted-foreground">{vehicle.license_plate} · {VEHICLE_CATEGORY[vehicle.category] ?? vehicle.category}</p></div>{dates.map((date) => { const events = eventsFor(vehicle.id, date); return <div key={date} className={cn("min-h-20 border-r p-1", date === new Date().toISOString().slice(0, 10) && "bg-primary/5")}>{events.map((event, index) => <Link key={`${event.kind}-${index}`} href={event.href ?? `/agency/fleet/${vehicle.id}`} className={cn("mb-1 block truncate rounded px-1.5 py-1 text-[10px] leading-tight", event.kind === "rental" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", event.kind === "reservation" && "bg-primary/10 text-primary", event.kind === "maintenance" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200", event.kind === "block" && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200")} title={`${event.label} · ${event.detail}`}><span className="block font-semibold">{event.label}</span><span className="block truncate">{event.detail}</span></Link>)}</div>; })}</div>)}
          {filteredVehicles.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Aucun véhicule ne correspond aux filtres.</p>}
        </div></div>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Les réservations, locations et immobilisations restent liées aux validations de l&apos;agence.</p>
    </>
  );
}
