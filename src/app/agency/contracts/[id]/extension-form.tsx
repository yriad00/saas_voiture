"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { extendRental, type ExtensionState } from "./extension-actions";
function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="sm" variant="outline" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Prolonger</Button>; }
export function ExtensionForm({ contractId }: { contractId: string }) { const [state, action] = useActionState<ExtensionState, FormData>(extendRental, {}); return <form action={action} className="space-y-3"><input type="text" className="hidden" name="contract_id" value={contractId}  readOnly /><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="space-y-1"><Label htmlFor="extension_date">Nouvelle date de retour</Label><Input id="extension_date" name="new_end_date" type="date" required /></div><div className="space-y-1"><Label htmlFor="extension_time">Heure de retour</Label><Input id="extension_time" name="new_end_time" type="time" defaultValue="10:00" required /></div><div className="space-y-1"><Label htmlFor="extension_reason">Motif</Label><Input id="extension_reason" name="reason" placeholder="Demande client…" required /></div></div>{state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600">Prolongation enregistrée.</p>}<Submit /></form>; }
