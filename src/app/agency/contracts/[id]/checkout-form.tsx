"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { saveCheckout, type CheckoutState } from "./checkout-actions";
import { SignaturePad } from "./signature-pad";
import { PhotoForm } from "./photo-form";
import type { Tables } from "@/lib/database.types";
import { toMoroccoDateTimeLocal } from "@/lib/morocco-time";

function Submit({ hydrated }: { hydrated: boolean }) { const { pending } = useFormStatus(); return <Button type="submit" disabled={!hydrated || pending}>{pending && <Loader2 className="animate-spin" />}Valider le check-out</Button>; }
export function CheckoutForm({ contractId, checkout }: { contractId: string; checkout?: Tables<"contract_checkouts"> | null }) {
  const [state, action] = useActionState<CheckoutState, FormData>(saveCheckout, {});
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const accessories = Array.isArray(checkout?.accessories) ? checkout?.accessories.join(", ") : "";
  return <div className="space-y-4"><form action={action} className="space-y-4"><input type="text" className="hidden" name="contract_id" value={contractId}  readOnly />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="checkout_at">Date et heure</Label><Input id="checkout_at" name="checkout_at" type="datetime-local" defaultValue={toMoroccoDateTimeLocal(checkout?.checkout_at ?? new Date())} required /></div><div className="space-y-1.5"><Label htmlFor="checkout_mileage">Kilométrage</Label><Input id="checkout_mileage" name="mileage" type="number" min="0" defaultValue={checkout?.mileage ?? ""} required /></div><div className="space-y-1.5"><Label htmlFor="checkout_fuel">Carburant</Label><Input id="checkout_fuel" name="fuel_level" type="number" min="0" max="8" defaultValue={checkout?.fuel_level ?? 8} required /></div><div className="space-y-1.5"><Label htmlFor="checkout_clean">Propreté</Label><Select id="checkout_clean" name="cleanliness" defaultValue={checkout?.cleanliness ?? "CLEAN"}><option value="CLEAN">Propre</option><option value="ACCEPTABLE">Acceptable</option><option value="DIRTY">À nettoyer</option></Select></div><div className="space-y-1.5"><Label htmlFor="checkout_keys">Clés remises</Label><Input id="checkout_keys" name="keys_count" type="number" min="0" max="10" defaultValue={checkout?.keys_count ?? 1} required /></div><div className="space-y-1.5"><Label htmlFor="checkout_signature">Signature (nom)</Label><Input id="checkout_signature" name="signature_name" defaultValue={checkout?.signature_name ?? ""} required /></div></div>
    <div className="space-y-1.5"><Label htmlFor="checkout_accessories">Accessoires (séparés par virgule)</Label><Input id="checkout_accessories" name="accessories" defaultValue={accessories} placeholder="Gilet, triangle, roue de secours" /></div>
    <div className="space-y-1.5"><Label>Signature client</Label>{checkout?.signature_data ? <><img src={checkout.signature_data} alt="Signature client au départ" className="h-28 w-full rounded border bg-white object-contain" /><p className="text-xs text-muted-foreground">Signature déjà enregistrée. Utilisez le bloc Signatures ci-dessous pour la refaire.</p></> : <SignaturePad required />}</div>
    <div className="space-y-1.5"><Label htmlFor="checkout_notes">Notes</Label><Textarea id="checkout_notes" name="notes" defaultValue={checkout?.notes ?? ""} placeholder="État au départ, observations…" /></div>
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600">Check-out enregistré. Ajoutez maintenant les photos de départ ci-dessous.</p>}<Submit hydrated={hydrated} />
  </form>{(checkout || state.success) && <div className="rounded-md border border-dashed p-3"><p className="mb-3 text-sm font-medium">Photos de départ</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['FRONT','Avant'],['REAR','Arrière'],['LEFT','Côté gauche'],['RIGHT','Côté droit'],['INTERIOR','Intérieur'],['DASHBOARD','Tableau de bord']] as const).map(([value, label]) => <div key={value} className="space-y-1"><p className="text-xs font-medium text-muted-foreground">{label}</p><PhotoForm contractId={contractId} inspectionType="PICKUP" photoType={value} /></div>)}</div></div>}</div>;
}
