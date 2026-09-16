"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadDamagePhoto, type DamagePhotoState } from "./damage-photo-actions";

export function DamagePhotoForm({ damageId }: { damageId: string }) {
  const [state, action] = useActionState<DamagePhotoState, FormData>(uploadDamagePhoto, {});
  return <form action={action} className="mt-2 flex flex-wrap items-center gap-2"><input type="text" className="hidden" name="damage_id" value={damageId}  readOnly /><Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="h-8 max-w-[220px] text-xs" /><Button size="sm" variant="outline">Photo</Button>{state.error && <span className="text-xs text-destructive">{state.error}</span>}{state.success && <span className="text-xs text-green-700">Photo ajoutée</span>}</form>;
}
