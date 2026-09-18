"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { saveVehiclePreparation, type PreparationState } from "./preparation-actions";
import type { Tables } from "@/lib/database.types";

function Submit({ hydrated }: { hydrated: boolean }) { const { pending } = useFormStatus(); return <Button type="submit" disabled={!hydrated || pending}>{pending && <Loader2 className="animate-spin" />}Enregistrer la préparation</Button>; }
const checks: Array<[keyof Tables<"vehicle_preparations">, string]> = [
  ["vehicle_clean", "Véhicule nettoyé"], ["fuel_level_checked", "Carburant vérifié"], ["tires_checked", "Pneus vérifiés"],
  ["documents_checked", "Documents présents"], ["accessories_checked", "Accessoires présents"], ["photos_checked", "Photos de remise prises"],
];
export function PreparationForm({ contractId, preparation }: { contractId: string; preparation?: Tables<"vehicle_preparations"> | null }) {
  const [state, action] = useActionState<PreparationState, FormData>(saveVehiclePreparation, {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <form action={action} className="space-y-4"><input type="text" className="hidden" name="contract_id" value={contractId}  readOnly />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{checks.map(([name, label]) => <label key={name} className="flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm"><input type="checkbox" name={name} defaultChecked={Boolean(preparation?.[name])} className="size-4 accent-primary" />{label}</label>)}</div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="keys_count">Nombre de clés</Label><Input id="keys_count" name="keys_count" type="number" min="0" max="10" defaultValue={preparation?.keys_count ?? 1} required /></div><div className="space-y-1.5"><Label htmlFor="preparation_status">Statut si incomplet</Label><select id="preparation_status" name="status" defaultValue={preparation?.status === "BLOCKED" ? "BLOCKED" : "IN_PROGRESS"} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="IN_PROGRESS">En préparation</option><option value="BLOCKED">Bloqué</option></select></div></div>
    <div className="space-y-1.5"><Label htmlFor="preparation_notes">Notes</Label><Textarea id="preparation_notes" name="notes" defaultValue={preparation?.notes ?? ""} placeholder="État, accessoires manquants, remarques…" /></div>
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600">Préparation enregistrée.</p>}<Submit hydrated={hydrated} />
  </form>;
}
