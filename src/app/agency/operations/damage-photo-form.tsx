"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DamagePhotoState } from "./damage-photo-actions";

export function DamagePhotoForm({ damageId }: { damageId: string }) {
  const [state, setState] = useState<DamagePhotoState>({});
  const [pending, setPending] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setState({});
    setPending(true);
    void fetch("/api/operations/damage-photo", { method: "POST", body: new FormData(event.currentTarget), credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const next = await response.json().catch(() => ({})) as DamagePhotoState;
        setState(response.ok ? next : { error: next.error ?? "Impossible d’envoyer la photo. Réessayez." });
      })
      .catch(() => setState({ error: "Impossible d’envoyer la photo. Réessayez." }))
      .finally(() => setPending(false));
  };
  return <form onSubmit={submit} className="mt-2 flex flex-wrap items-center gap-2"><input type="text" className="hidden" name="damage_id" value={damageId} readOnly /><Input name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="h-8 max-w-[220px] text-xs" /><Button size="sm" variant="outline" disabled={pending}>{pending ? "Envoi…" : "Photo"}</Button>{state.error && <span className="text-xs text-destructive">{state.error}</span>}{state.success && <span className="text-xs text-green-700">Photo ajoutée</span>}</form>;
}
