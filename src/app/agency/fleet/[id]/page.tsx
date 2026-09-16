/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Fuel, Gauge, Calendar, Shield, FileText, Satellite, ExternalLink } from "lucide-react";
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVehicle } from "@/lib/services/vehicles";
import { VehicleStatusActions } from "./status-actions";
import { DeleteVehicleButton } from "./delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { VEHICLE_STATUS, FUEL_TYPE, TRANSMISSION, VEHICLE_CATEGORY } from "@/lib/labels";
import { VehicleDocumentForm } from "../document-form";
import { VehicleDocumentDelete } from "../document-delete";
import { VehicleBlockForm } from "../block-form";
import { VehicleBlockCancel } from "../block-cancel";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAgency();
  const { id } = await params;
  const vehicle = await getVehicle(id);
  if (!vehicle || vehicle.agency_id !== ctx.membership.agencyId) notFound();

  const canWrite = ["AGENCY_OWNER", "MANAGER", "AGENT"].includes(ctx.membership.roleKey);
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("vehicle_documents")
    .select("id, document_type, document_number, issued_at, expires_at, file_name, size_bytes, storage_path, created_at")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("vehicle_id", id)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  const documentLinks = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from("vehicle-documents").createSignedUrl(document.storage_path, 300);
    return { ...document, signedUrl: data?.signedUrl ?? null };
  }));
  const { data: blocks } = await supabase
    .from("vehicle_blocks")
    .select("id, block_type, reason, start_date, end_date, status")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("vehicle_id", id)
    .eq("status", "ACTIVE")
    .order("start_date", { ascending: true });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/agency/fleet">
          <ArrowLeft /> Retour à la flotte
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {vehicle.brand} {vehicle.model}
            </h1>
            <StatusBadge meta={VEHICLE_STATUS[vehicle.status]} />
          </div>
          <p className="text-sm text-muted-foreground">
            {vehicle.year} &middot; {vehicle.license_plate}
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/agency/fleet/${vehicle.id}/edit`}>
                <Pencil /> Modifier
              </Link>
            </Button>
            <VehicleStatusActions vehicleId={vehicle.id} current={vehicle.status} />
            <DeleteVehicleButton vehicleId={vehicle.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Info label="Marque" value={vehicle.brand} />
            <Info label="Modèle" value={vehicle.model} />
            <Info label="Année" value={String(vehicle.year)} />
            <Info label="Couleur" value={vehicle.color} />
            <Info label="Immatriculation" value={vehicle.license_plate} />
            <Info label="N° châssis (VIN)" value={vehicle.vin} />
            <Info label="Catégorie" value={VEHICLE_CATEGORY[vehicle.category] ?? vehicle.category} />
            <Info label="Boîte" value={TRANSMISSION[vehicle.transmission]} />
            <Info icon={Fuel} label="Carburant" value={FUEL_TYPE[vehicle.fuel_type]} />
            <Info label="Places" value={String(vehicle.seats)} />
            <Info label="Portes" value={String(vehicle.doors)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exploitation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Info icon={Gauge} label="Tarif journalier" value={formatCurrency(Number(vehicle.daily_rate))} />
            <Info label="Kilométrage" value={`${Number(vehicle.mileage).toLocaleString("fr-MA")} km`} />
            <Info icon={Shield} label="Expiration assurance" value={formatDate(vehicle.insurance_expiry)} />
            <Info icon={FileText} label="Visite technique" value={formatDate(vehicle.technical_inspection_expiry)} />
            <Info icon={Calendar} label="Immatriculé le" value={formatDate(vehicle.registration_date)} />
            <Info label="Ajouté le" value={formatDate(vehicle.created_at)} />
            <Info label="Propriété" value={vehicle.ownership_type === "SUBLEASE" ? "Sous-location / partenaire" : vehicle.ownership_type === "LEASING" ? "Leasing / financé" : "Agence"} />
            {vehicle.ownership_type === "SUBLEASE" && <><Info label="Propriétaire" value={(vehicle as any).owner_name ?? null} /><Info label="Contact propriétaire" value={(vehicle as any).owner_phone ?? null} /><Info label="Coût / jour" value={formatCurrency(Number((vehicle as any).owner_cost_per_day ?? 0))} /></>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Satellite className="size-4 text-primary" /> GPS & suivi</CardTitle>
          {vehicle.gps_enabled ? <StatusBadge meta={{ label: "Activé", variant: "success" }} /> : <StatusBadge meta={{ label: "Non configuré", variant: "secondary" }} />}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Fournisseur" value={vehicle.gps_provider} />
          <Info label="Identifiant boîtier" value={vehicle.gps_device_id} />
          <Info label="Dernière position" value={vehicle.gps_last_seen_at ? formatDate(vehicle.gps_last_seen_at) : "Aucune donnée"} />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Position connue</p>
            {vehicle.gps_last_latitude != null && vehicle.gps_last_longitude != null ? (
              <a className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline" href={`https://www.google.com/maps?q=${vehicle.gps_last_latitude},${vehicle.gps_last_longitude}`} target="_blank" rel="noreferrer">
                {Number(vehicle.gps_last_latitude).toFixed(5)}, {Number(vehicle.gps_last_longitude).toFixed(5)} <ExternalLink className="size-3" />
              </a>
            ) : <p className="mt-0.5 text-sm">Aucune donnée</p>}
          </div>
          {vehicle.gps_tracking_url && (
            <div className="sm:col-span-2 lg:col-span-4">
              <a className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline" href={vehicle.gps_tracking_url} target="_blank" rel="noreferrer">
                Ouvrir le suivi du fournisseur <ExternalLink className="size-4" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Disponibilité et blocages</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && <VehicleBlockForm vehicleId={vehicle.id} />}
          {blocks && blocks.length > 0 ? <div className="divide-y rounded-lg border">
            {blocks.map((block) => <div key={block.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
              <div><p className="font-medium">{VEHICLE_BLOCK_TYPES[block.block_type] ?? block.block_type}</p><p className="text-xs text-muted-foreground">{block.reason} · {formatDate(block.start_date)} → {formatDate(block.end_date)}</p></div>
              {canWrite && <VehicleBlockCancel vehicleId={vehicle.id} blockId={block.id} />}
            </div>)}
          </div> : <p className="text-sm text-muted-foreground">Aucun blocage actif.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Documents du véhicule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {canWrite && <VehicleDocumentForm vehicleId={vehicle.id} />}
          {documentLinks.length > 0 ? (
            <div className="divide-y rounded-lg border">
              {documentLinks.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{VEHICLE_DOCUMENT_TYPES[document.document_type] ?? document.document_type}</p>
                    <p className="text-xs text-muted-foreground">{document.file_name}{document.document_number ? ` · ${document.document_number}` : ""} · {Math.round(Number(document.size_bytes) / 1024)} Ko</p>
                    {(document.issued_at || document.expires_at) && <p className="text-xs text-muted-foreground">{document.issued_at ? `Émis ${formatDate(document.issued_at)}` : ""}{document.expires_at ? ` · Expire ${formatDate(document.expires_at)}` : ""}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {document.signedUrl ? <a className="text-primary hover:underline" href={document.signedUrl} target="_blank" rel="noreferrer">Ouvrir</a> : <span className="text-xs text-muted-foreground">Lien indisponible</span>}
                    {canWrite && <VehicleDocumentDelete vehicleId={vehicle.id} documentId={document.id} />}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Aucun document privé ajouté.</p>}
        </CardContent>
      </Card>

      {vehicle.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{vehicle.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const VEHICLE_DOCUMENT_TYPES: Record<string, string> = {
  REGISTRATION: "Carte grise",
  INSURANCE: "Assurance",
  TECHNICAL_INSPECTION: "Visite technique",
  LEASE: "Location longue durée",
  PURCHASE: "Achat",
  OTHER: "Autre",
};

const VEHICLE_BLOCK_TYPES: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  ADMIN: "Blocage administratif",
  TRANSFER: "Transfert",
  DAMAGE: "Dommage",
};

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Fuel;
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <p className="mt-0.5 text-sm">{value ?? "—"}</p>
    </div>
  );
}
