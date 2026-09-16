"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveCheckin, type CheckinState } from "./checkin-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SignaturePad } from "./signature-pad";
import { PhotoForm } from "./photo-form";
import { toMoroccoDateTimeLocal } from "@/lib/morocco-time";

function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : label}</Button>; }

export function CheckinForm({ contractId, branchId, branches = [], showReturnPhotos = false }: { contractId: string; branchId: string; branches?: Array<{ id: string; name: string }>; showReturnPhotos?: boolean }) {
  const [state, action] = useActionState<CheckinState, FormData>(saveCheckin, {});
  const draft = state.review?.draft;
  const value = (key: string, fallback = "") => String(draft?.[key] ?? fallback);
  return <div className="space-y-4"><form action={action} className="space-y-3 rounded-md border border-dashed p-4">
    <input type="text" className="hidden" name="contract_id" value={contractId} readOnly />
    {state.review ? <input type="hidden" name="branch_id" value={value("branch_id", branchId)}  readOnly /> : branches.length > 1 ? <div><Label htmlFor="return-branch">Agence de retour</Label><select id="return-branch" name="branch_id" defaultValue={branchId} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div> : <input type="hidden" name="branch_id" value={branchId}  readOnly />}
    {state.review ? <>
      <input type="text" className="hidden" name="actual_return_at" value={value("actual_return_at")} readOnly /><input type="text" className="hidden" name="return_mileage" value={value("return_mileage")} readOnly /><input type="text" className="hidden" name="fuel_level" value={value("fuel_level")} readOnly /><input type="text" className="hidden" name="cleanliness" value={value("cleanliness")} readOnly /><input type="text" className="hidden" name="signature_name" value={value("signature_name")} readOnly /><input type="text" className="hidden" name="signature_data" value={value("signature_data")} readOnly /><input type="text" className="hidden" name="missing_items" value={value("missing_items")} readOnly /><input type="text" className="hidden" name="exterior_condition" value={value("exterior_condition")} readOnly /><input type="text" className="hidden" name="interior_condition" value={value("interior_condition")} readOnly />
      <div className="rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/30">Revue : {state.review.lateDays} jour(s) de retard · {state.review.extraMileage} km supplémentaires · carburant manquant {state.review.fuelDelta} niveau(x) · charges automatiques {state.review.charges.toFixed(2)} MAD.</div>
      {state.review.mileageRuleNeedsReview && <p className="rounded-md bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950/30 dark:text-orange-100">La règle kilométrique n’était pas enregistrée dans ce contrat. Aucun kilomètre n’est facturé automatiquement ; confirmez la revue après vérification.</p>}
      <p className="text-sm text-muted-foreground">Ajoutez les six photos de retour dans ce même parcours avant de finaliser. Le retour reste modifiable si un envoi échoue.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="review_confirmed" value="true" required/> J’ai vérifié les éléments du retour</label><input type="hidden" className="hidden" name="finalize" defaultValue="true" />
    </> : <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><Label htmlFor="return-at">Date/heure retour</Label><Input id="return-at" name="actual_return_at" type="datetime-local" defaultValue={toMoroccoDateTimeLocal(new Date())} required/></div><div><Label htmlFor="return-mileage">Kilométrage</Label><Input id="return-mileage" name="return_mileage" type="number" min={0} required/></div><div><Label htmlFor="return-fuel">Carburant (0–8)</Label><Input id="return-fuel" name="fuel_level" type="number" min={0} max={8} defaultValue={8} required/></div></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><Label>Propreté</Label><select name="cleanliness" defaultValue="ACCEPTABLE" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="CLEAN">Propre</option><option value="ACCEPTABLE">Acceptable</option><option value="DIRTY">Sale</option></select></div><div><Label htmlFor="signature-name">Signature</Label><Input id="signature-name" name="signature_name" required/></div><div><Label htmlFor="missing-items">Éléments manquants</Label><Input id="missing-items" name="missing_items" placeholder="GPS, clé…"/></div></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label htmlFor="exterior">État extérieur</Label><Textarea id="exterior" name="exterior_condition" rows={3}/></div><div><Label htmlFor="interior">État intérieur / notes</Label><Textarea id="interior" name="interior_condition" rows={3}/></div></div><input type="hidden" className="hidden" name="finalize" defaultValue="false" />
      <div><Label>Signature client au retour</Label><SignaturePad required /></div>
    </>}
    {state.error && <p className="text-sm text-destructive">{state.error}</p>}<Submit label={state.review ? "Finaliser le retour" : "Enregistrer et revoir"}/>
  </form>{(state.review || showReturnPhotos) && <div className="rounded-md border border-dashed p-3"><p className="mb-3 text-sm font-medium">Photos du retour</p><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{([['FRONT','Avant'],['REAR','Arrière'],['LEFT','Côté gauche'],['RIGHT','Côté droit'],['INTERIOR','Intérieur'],['DASHBOARD','Tableau de bord']] as const).map(([value, label]) => <div key={value} className="space-y-1"><p className="text-xs font-medium text-muted-foreground">{label}</p><PhotoForm contractId={contractId} inspectionType="RETURN" photoType={value} /></div>)}</div></div>}</div>;
}
