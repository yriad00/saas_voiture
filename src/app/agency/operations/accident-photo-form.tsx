"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { uploadAccidentPhoto, type AccidentPhotoState } from "./accident-photo-actions";

export function AccidentPhotoForm({ accidentId }: { accidentId: string }) {
  const [state, action] = useActionState<AccidentPhotoState, FormData>(uploadAccidentPhoto, {});
  return <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
    <input type="hidden" name="accident_id" value={accidentId} readOnly />
    <Select name="media_type" defaultValue="PHOTO" aria-label="Type de document"><option value="PHOTO">Photo</option><option value="CONSTAT">Constat / PDF</option><option value="OTHER">Autre</option></Select>
    <Input name="photo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" required className="h-8 max-w-[220px] text-xs" />
    <Button size="sm" variant="outline">Ajouter</Button>
    {state.error && <span className="text-xs text-destructive">{state.error}</span>}
    {state.success && <span className="text-xs text-green-700">Document ajouté</span>}
  </form>;
}

