/* eslint-disable @typescript-eslint/no-explicit-any */
import { CarFront, MapPin, Phone } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MissionStatusForm } from "./mission-status-form";

export const metadata = { title: "Missions — FleetHub" };

const missionLabels: Record<string, string> = {
  DELIVERY: "Livraison", COLLECTION: "Récupération", AIRPORT_DELIVERY: "Livraison aéroport",
  HOTEL_DELIVERY: "Livraison hôtel", CUSTOMER_ADDRESS: "Adresse client", GARAGE: "Garage", OTHER: "Mission",
};

export default async function DriverHome() {
  const ctx = await requireAgency(["DRIVER"]);
  const supabase = await createClient();
  const { data: missions } = await (supabase as any).from("delivery_missions")
    .select("id,mission_type,status,address,location,scheduled_at,notes,customers(first_name,last_name,phone),vehicles(brand,model,license_plate)")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("assigned_employee", ctx.user.id)
    .in("status", ["PLANNED", "ACCEPTED", "PREPARING", "READY", "ON_THE_WAY", "ARRIVED"])
    .order("scheduled_at");

  return <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
    <div className="flex items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Mes missions</h1><p className="text-sm text-muted-foreground">{ctx.membership.agencyName}</p></div>
      <form action={signOut}><Button variant="outline" size="sm" type="submit">Déconnexion</Button></form>
    </div>
    {(missions ?? []).length === 0
      ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Aucune mission assignée.</CardContent></Card>
      : (missions ?? []).map((mission: any) => {
          const customer = mission.customers;
          const vehicle = mission.vehicles;
          const phone = String(customer?.phone ?? "").replace(/[^+\d]/g, "");
          return <Card key={mission.id}>
            <CardHeader><CardTitle className="text-base">{missionLabels[mission.mission_type] ?? "Mission"} · {new Date(mission.scheduled_at).toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" })}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {customer && <div className="text-sm"><p className="font-medium">{customer.first_name} {customer.last_name}</p>{phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-primary underline"><Phone className="size-3.5" /> {customer.phone}</a>}</div>}
              <p className="flex items-center gap-1.5 text-sm"><CarFront className="size-4 text-muted-foreground" />{vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.license_plate}` : "Véhicule à confirmer"}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" />{mission.address ?? mission.location ?? "Adresse à confirmer"}</p>
              {mission.notes && <p className="rounded-md bg-muted/40 p-2 text-sm">{mission.notes}</p>}
              <MissionStatusForm missionId={mission.id} status={mission.status} />
            </CardContent>
          </Card>;
        })}
  </div>;
}
