"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { saveContractSignature, type SignatureState } from "./signature-actions";
import { SignaturePad } from "./signature-pad";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Enregistrer la signature</Button>; }

export function SignatureForm({ contractId, signerType, defaultName }: { contractId: string; signerType: "CUSTOMER" | "EMPLOYEE"; defaultName?: string }) {
  const [state, action] = useActionState<SignatureState, FormData>(saveContractSignature, {});
  return <form action={action} className="space-y-3"><input type="text" className="hidden" name="contract_id" value={contractId} readOnly /><input type="text" className="hidden" name="signer_type" value={signerType} readOnly /><div className="space-y-1"><Label htmlFor={`signer_${signerType}`}>{signerType === "CUSTOMER" ? "Nom du client" : "Nom de l'employé"}</Label><Input id={`signer_${signerType}`} name="signer_name" defaultValue={defaultName ?? ""} required /></div><SignaturePad /><Submit />{state.error && <p className="text-xs text-destructive">{state.error}</p>}{state.success && <p className="text-xs text-emerald-700">Signature enregistrée.</p>}</form>;
}
