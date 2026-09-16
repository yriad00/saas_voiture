"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { updateAccident } from "./actions";

type AccidentFollowupState = { error?: string; success?: boolean };
type Accident = {
  id: string;
  status: string;
  insurance_company?: string | null;
  police_reference?: string | null;
  claim_reference?: string | null;
  deductible?: number | null;
  estimated_repair_cost?: number | null;
  final_cost?: number | null;
  customer_liability?: number | null;
  insurance_reimbursement?: number | null;
  notes?: string | null;
};

export function AccidentFollowupForm({ accident }: { accident: Accident }) {
  const [state, action] = useActionState<AccidentFollowupState, FormData>(updateAccident, {});
  return <form action={action} className="mt-2 grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-2">
    <input type="hidden" name="accident_id" value={accident.id} readOnly />
    <Select name="status" defaultValue={accident.status}><option value="REPORTED">Signalé</option><option value="UNDER_REVIEW">À examiner</option><option value="CLAIM_OPEN">Dossier assurance ouvert</option><option value="REPAIRING">En réparation</option><option value="RESOLVED">Résolu</option><option value="CLOSED">Clos</option></Select>
    <Input name="insurance_company" placeholder="Assureur" defaultValue={accident.insurance_company ?? ""} />
    <Input name="police_reference" placeholder="Référence police / constat" defaultValue={accident.police_reference ?? ""} />
    <Input name="claim_reference" placeholder="Référence assurance" defaultValue={accident.claim_reference ?? ""} />
    <Input name="deductible" type="number" min={0} step="0.01" placeholder="Franchise MAD" defaultValue={accident.deductible ?? 0} />
    <Input name="estimated_repair_cost" type="number" min={0} step="0.01" placeholder="Coût estimé MAD" defaultValue={accident.estimated_repair_cost ?? 0} />
    <Input name="final_cost" type="number" min={0} step="0.01" placeholder="Coût final MAD" defaultValue={accident.final_cost ?? 0} />
    <Input name="customer_liability" type="number" min={0} step="0.01" placeholder="Part client MAD" defaultValue={accident.customer_liability ?? 0} />
    <Input name="insurance_reimbursement" type="number" min={0} step="0.01" placeholder="Remboursement assureur MAD" defaultValue={accident.insurance_reimbursement ?? 0} />
    <Textarea name="notes" placeholder="Suivi du sinistre" className="sm:col-span-2" rows={2} defaultValue={accident.notes ?? ""} />
    <Button type="submit" size="sm" variant="outline" className="sm:col-span-2">Enregistrer le suivi</Button>
    {state.error && <p className="text-xs text-destructive sm:col-span-2">{state.error}</p>}
    {state.success && <p className="text-xs text-emerald-600 sm:col-span-2">Suivi du sinistre enregistré.</p>}
  </form>;
}
