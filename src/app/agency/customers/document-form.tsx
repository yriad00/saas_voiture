"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, Loader2 } from "lucide-react";
import { uploadCustomerDocument, type CustomerDocumentState } from "./document-actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : <FileUp />} Ajouter le document</Button>;
}

export function CustomerDocumentForm({ customerId }: { customerId: string }) {
  const [state, action] = useActionState<CustomerDocumentState, FormData>(uploadCustomerDocument.bind(null, customerId), {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1.5"><Label htmlFor="document_type">Type</Label><Select id="document_type" name="document_type" defaultValue="CIN_RECTO"><option value="CIN_RECTO">CIN recto</option><option value="CIN_VERSO">CIN verso</option><option value="DRIVER_LICENSE_RECTO">Permis recto</option><option value="DRIVER_LICENSE_VERSO">Permis verso</option><option value="PASSPORT">Passeport</option><option value="COMPANY">Document société</option><option value="OTHER">Autre</option></Select></div>
        <div className="space-y-1.5"><Label htmlFor="customer_document_expires">Expire le</Label><Input id="customer_document_expires" name="expires_at" type="date" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="customer_document_file">Fichier</Label><Input id="customer_document_file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">Document ajouté.</p>}
      <Submit />
    </form>
  );
}
