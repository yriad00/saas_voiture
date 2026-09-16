"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { recordActiveRentalUpdate, type ActiveRentalState } from "./active-rental-actions";
function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Ajouter l&apos;événement</Button>; }
export function ActiveRentalForm({ contractId }: { contractId: string }) {
  const [state, action] = useActionState<ActiveRentalState, FormData>(recordActiveRentalUpdate, {});
  return <form action={action} className="space-y-3"><input type="text" className="hidden" name="contract_id" value={contractId}  readOnly /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="rental_event">Type</Label><Select id="rental_event" name="event_type" defaultValue="MILEAGE"><option value="MILEAGE">Kilométrage</option><option value="CUSTOMER_CONTACT">Contact client</option><option value="GPS_ALERT">Alerte GPS</option><option value="DAMAGE_REPORT">Dégât signalé</option><option value="OTHER">Autre</option></Select></div><div className="space-y-1"><Label htmlFor="rental_when">Date et heure</Label><Input id="rental_when" name="occurred_at" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} required /></div><div className="space-y-1"><Label htmlFor="rental_mileage">Kilométrage (optionnel)</Label><Input id="rental_mileage" name="mileage" type="number" min="0" /></div><div className="space-y-1"><Label htmlFor="rental_fuel">Carburant (optionnel)</Label><Input id="rental_fuel" name="fuel_level" type="number" min="0" max="8" /></div></div><div className="space-y-1"><Label htmlFor="rental_location">Lieu</Label><Input id="rental_location" name="location" placeholder="Casablanca, aéroport…" /></div><div className="space-y-1"><Label htmlFor="rental_notes">Notes</Label><Textarea id="rental_notes" name="notes" placeholder="Détail de l'événement…" required /></div>{state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600">Événement enregistré.</p>}<Submit /></form>;
}
