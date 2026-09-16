"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "@e965/xlsx";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { importCustomers, importVehicles, type ImportResult } from "./actions";

type ImportKind = "customers" | "vehicles";
type PreviewRow = { rowNumber: number; data: Record<string, string> };

const CUSTOMER_FIELDS = [
  { key: "first_name", label: "Prénom", aliases: ["prenom", "first_name", "firstname"] },
  { key: "last_name", label: "Nom", aliases: ["nom", "last_name", "lastname"] },
  { key: "phone", label: "Téléphone", aliases: ["telephone", "tel", "phone", "mobile"] },
  { key: "email", label: "Email", aliases: ["email", "courriel"] },
  { key: "id_type", label: "Type pièce", aliases: ["type_piece", "typepiece", "id_type", "idtype"] },
  { key: "id_number", label: "N° pièce", aliases: ["numero_piece", "numeropiece", "id_number", "idnumber", "cin", "passport"] },
  { key: "driver_license_number", label: "N° permis", aliases: ["permis", "permis_conduire", "driver_license_number", "driverlicensenumber"] },
  { key: "driver_license_expiry", label: "Expiration permis", aliases: ["expiration_permis", "driver_license_expiry", "driverlicenseexpiry"] },
  { key: "date_of_birth", label: "Date naissance", aliases: ["date_naissance", "datenaissance", "date_of_birth", "dateofbirth"] },
  { key: "nationality", label: "Nationalité", aliases: ["nationalite", "nationality"] },
  { key: "address", label: "Adresse", aliases: ["adresse", "address"] },
  { key: "city", label: "Ville", aliases: ["ville", "city"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note"] },
] as const;

const VEHICLE_FIELDS = [
  { key: "brand", label: "Marque", aliases: ["marque", "brand"] },
  { key: "model", label: "Modèle", aliases: ["modele", "model"] },
  { key: "license_plate", label: "Immatriculation", aliases: ["immatriculation", "license_plate", "licenseplate", "plaque"] },
  { key: "year", label: "Année", aliases: ["annee", "year"] },
  { key: "category", label: "Catégorie", aliases: ["categorie", "category", "type"] },
  { key: "color", label: "Couleur", aliases: ["couleur", "color"] },
  { key: "vin", label: "VIN", aliases: ["vin", "chassis", "numero_chassis"] },
  { key: "seats", label: "Places", aliases: ["places", "sieges", "seats"] },
  { key: "doors", label: "Portes", aliases: ["portes", "doors"] },
  { key: "fuel_type", label: "Carburant", aliases: ["carburant", "fuel_type", "fuel"] },
  { key: "transmission", label: "Boîte", aliases: ["boite", "boite_vitesse", "transmission"] },
  { key: "daily_rate", label: "Tarif journalier", aliases: ["tarif", "tarif_journalier", "daily_rate", "dailyrate"] },
  { key: "mileage", label: "Kilométrage", aliases: ["kilometrage", "mileage", "km"] },
  { key: "insurance_expiry", label: "Expiration assurance", aliases: ["expiration_assurance", "insurance_expiry", "insuranceexpiry"] },
  { key: "technical_inspection_expiry", label: "Expiration visite technique", aliases: ["expiration_visite_technique", "technical_inspection_expiry", "technicalinspectionexpiry"] },
  { key: "registration_date", label: "Date immatriculation", aliases: ["date_immatriculation", "registration_date", "registrationdate"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note"] },
  { key: "gps_enabled", label: "GPS activé", aliases: ["gps_active", "gps_enabled", "gpsactive", "gpsenabled"] },
  { key: "gps_provider", label: "Fournisseur GPS", aliases: ["fournisseur_gps", "gps_provider", "gpsprovider"] },
  { key: "gps_device_id", label: "ID boîtier GPS", aliases: ["id_gps", "gps_device_id", "gpsdeviceid", "imei"] },
  { key: "gps_tracking_url", label: "Lien suivi GPS", aliases: ["lien_gps", "gps_tracking_url", "gpstrackingurl", "tracking_url"] },
] as const;

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function fieldsFor(kind: ImportKind) {
  return kind === "customers" ? CUSTOMER_FIELDS : VEHICLE_FIELDS;
}

function downloadTemplate(kind: ImportKind) {
  const fields = fieldsFor(kind);
  const headers = fields.map((field) => field.label);
  const example = kind === "customers"
    ? ["Mohamed", "Alaoui", "0612345678", "client@example.ma", "CIN", "AB12345", "", "", "", "Maroc", "", "Casablanca", ""]
    : ["Dacia", "Logan", "12345-A-6", "2024", "sedan", "Blanc", "", "5", "4", "DIESEL", "MANUAL", "350", "12000", "", "", "", "", "false", "", "", ""];
  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, kind === "customers" ? "Clients" : "Véhicules");
  XLSX.writeFile(workbook, kind === "customers" ? "modele-import-clients.xlsx" : "modele-import-vehicules.xlsx");
}

export function ImportPanel({ kind }: { kind: ImportKind }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fields = fieldsFor(kind);
  const requiredFields = kind === "customers" ? ["first_name", "last_name"] : ["brand", "model", "license_plate", "year"];
  const title = kind === "customers" ? "Importer des clients" : "Importer des véhicules";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setResult(null);
    setParseError("");

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, raw: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("La première feuille est vide.");
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
      if (!rawRows.length) throw new Error("Le fichier ne contient aucune ligne.");

      const fieldsByAlias = new Map<string, string>();
      fields.forEach((field) => field.aliases.forEach((alias) => fieldsByAlias.set(normalizeHeader(alias), field.key)));
      const sourceHeaders = Object.keys(rawRows[0] ?? {});
      const recognized = new Set(sourceHeaders.map(normalizeHeader).map((header) => fieldsByAlias.get(header)).filter(Boolean));
      const missing = requiredFields.filter((field) => !recognized.has(field));
      if (missing.length) {
        const labels = fields.filter((field) => missing.includes(field.key)).map((field) => field.label);
        throw new Error(`Colonnes obligatoires manquantes : ${labels.join(", ")}.`);
      }

      const parsedRows = rawRows.map((rawRow, index) => {
        const data: Record<string, string> = {};
        Object.entries(rawRow).forEach(([header, value]) => {
          const key = fieldsByAlias.get(normalizeHeader(header));
          if (key) data[key] = formatCell(value);
        });
        return { rowNumber: index + 2, data };
      });
      setRows(parsedRows);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Impossible de lire ce fichier.");
    }
  }

  function runImport() {
    const payload = rows.map((row) => row.data);
    startTransition(() => {
      void (kind === "customers" ? importCustomers(payload) : importVehicles(payload))
        .then((nextResult) => {
          setResult(nextResult);
          if (typeof nextResult.imported === "number") {
            setRows([]);
            setFileName("");
            if (inputRef.current) inputRef.current.value = "";
            router.refresh();
          }
        })
        .catch((error) => setResult({ error: error instanceof Error ? error.message : "L'import a échoué." }));
    });
  }

  return (
    <div className="mb-6">
      <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        {open ? <X /> : <FileSpreadsheet />}
        {open ? "Fermer l'import" : "Importer Excel"}
      </Button>

      {open && (
        <Card className="mt-3">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-1">
                Formats acceptés : .xlsx, .xls et .csv · 500 lignes maximum par import.
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => downloadTemplate(kind)}>
              <Download /> Modèle
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-md border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Choisir un fichier Excel</p>
                <p className="text-xs text-muted-foreground">Les colonnes peuvent être en français ou en anglais.</p>
              </div>
              <Input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(event) => void handleFile(event.target.files?.[0])}
                className="h-auto max-w-sm py-2"
              />
            </div>

            {fileName && !parseError && <p className="text-xs text-muted-foreground">Fichier : {fileName}</p>}
            {parseError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Aperçu : {rows.length} ligne(s) détectée(s)</p>
                  <p className="text-xs text-muted-foreground">Les lignes seront validées avant insertion.</p>
                </div>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Ligne</th>
                        {fields.slice(0, 6).map((field) => <th key={field.key} className="whitespace-nowrap px-3 py-2 font-medium">{field.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row) => (
                        <tr key={row.rowNumber} className="border-t border-border">
                          <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                          {fields.slice(0, 6).map((field) => <td key={field.key} className="max-w-48 truncate px-3 py-2">{row.data[field.key] || "—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 5 && <p className="text-xs text-muted-foreground">5 premières lignes affichées.</p>}
                <Button type="button" onClick={runImport} disabled={isPending}>
                  {isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                  {isPending ? "Import en cours…" : `Importer ${rows.length} ligne(s)`}
                </Button>
              </div>
            )}

            {result?.error && (
              <div className="space-y-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{result.error}</span></div>
                {result.rowErrors?.length ? (
                  <ul className="ml-6 list-disc space-y-1 text-xs">
                    {result.rowErrors.slice(0, 8).map((item) => <li key={`${item.row}-${item.message}`}>Ligne {item.row} : {item.message}</li>)}
                  </ul>
                ) : null}
                {(result.rowErrors?.length ?? 0) > 8 && <p className="ml-6 text-xs">D’autres erreurs sont présentes dans le fichier.</p>}
              </div>
            )}
            {typeof result?.imported === "number" && (
              <div className="flex items-start gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{result.imported} {kind === "customers" ? "client(s) importé(s)" : "véhicule(s) importé(s)"} avec succès.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
