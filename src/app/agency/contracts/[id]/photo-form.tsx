'use client';
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PhotoFormState = { error?: string; success?: boolean };

function Submit({ hydrated, pending }: { hydrated: boolean; pending: boolean }) {
  return <Button type="submit" size="sm" variant="outline" disabled={!hydrated || pending}>{pending ? <Loader2 className="animate-spin" /> : <ImagePlus />} Ajouter</Button>;
}

export function PhotoForm({ contractId, inspectionType, photoType = "OTHER" }: { contractId: string; inspectionType: "PICKUP" | "RETURN"; photoType?: "FRONT" | "REAR" | "LEFT" | "RIGHT" | "INTERIOR" | "DASHBOARD" | "OTHER" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PhotoFormState>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    if (!state.success) return;
    if (inputRef.current) inputRef.current.value = "";
    queueMicrotask(() => setPreview(null));
  }, [state.success]);

  const removeSelection = () => {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hydrated || pending) return;
    const formData = new FormData(event.currentTarget);
    setState({});
    setPending(true);
    void fetch("/api/contracts/photo", { method: "POST", body: formData, credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const next = await response.json().catch(() => ({}));
        setState(response.ok ? next : { error: next.error ?? "Impossible d’enregistrer la photo. Réessayez." });
      })
      .catch(() => setState({ error: "Impossible d’enregistrer la photo. Réessayez." }))
      .finally(() => setPending(false));
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input type="text" className="hidden" name="contract_id" value={contractId} readOnly />
      <input type="text" className="hidden" name="inspection_type" value={inspectionType} readOnly />
      <input type="text" className="hidden" name="photo_type" value={photoType} readOnly />
      <Input ref={inputRef} name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="h-9 max-w-xs text-xs" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        setPreview(file ? URL.createObjectURL(file) : null);
      }} />
      <Submit hydrated={hydrated} pending={pending} />
      {preview && <div className="basis-full space-y-1"><span role="img" aria-label="Aperçu de la photo avant envoi" className="block h-24 w-32 rounded-md border bg-cover bg-center" style={{ backgroundImage: `url("${preview}")` }} /><button type="button" onClick={removeSelection} className="text-xs text-primary underline">Retirer / remplacer</button></div>}
      {state.error && <p className="basis-full text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700 dark:text-green-300">Photo enregistrée.</p>}
    </form>
  );
}
