"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Ban, Play } from "lucide-react";
import { setContractStatus } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { Enums } from "@/lib/database.types";

export function ContractActions({
  contractId,
  status,
}: {
  contractId: string;
  status: Enums<"contract_status">;
}) {
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const router = useRouter();

  // These controls are client actions rather than native forms. Keep them
  // disabled until React has attached the handlers so a fast click during a
  // hosted cold render cannot be silently dropped before hydration.
  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const cancel = () => {
    if (!window.confirm("Annuler ce contrat ?")) return;
    startTransition(async () => {
      const res = await setContractStatus(contractId, "CANCELLED");
      if (res?.error) return window.alert(res.error);
      router.refresh();
    });
  };

  const activate = () => {
    startTransition(async () => {
      const res = await setContractStatus(contractId, "ACTIVE");
      if (res?.error) return window.alert(res.error);
      router.refresh();
    });
  };

  const submitClose = (formData: FormData) => {
    startTransition(async () => {
      const payload = formData;
      payload.set("contract_id", contractId);
      const response = await fetch("/api/contracts/close", { method: "POST", body: payload, cache: "no-store" });
      const res = await response.json().catch(() => ({ error: "Impossible de clôturer la location. Réessayez." }));
      if (res?.error) return window.alert(res.error);
      setShowClose(false);
      router.refresh();
    });
  };

  if (status === "CLOSED" || status === "CANCELLED") return null;

  if (status === "DRAFT") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm" disabled={pending || !hydrated} onClick={activate}>
          {pending && <Loader2 className="animate-spin" />}
          <Play /> Démarrer la location
        </Button>
        <Button variant="outline" size="sm" disabled={pending || !hydrated} onClick={cancel}>
          <Ban /> Annuler
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm" disabled={pending || !hydrated} onClick={() => setShowClose((v) => !v)}>
          <CheckCircle2 /> Clôturer le contrat
        </Button>
        <Button variant="outline" size="sm" disabled={pending || !hydrated} onClick={cancel}>
          <Ban /> Annuler
        </Button>
      </div>

      {showClose && (
        <Card className="mt-2">
          <CardHeader><CardTitle className="text-base">Clôture — restitution du véhicule</CardTitle></CardHeader>
          <CardContent>
            <form action={submitClose} onSubmit={(event) => { event.preventDefault(); submitClose(new FormData(event.currentTarget)); }} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="end_mileage">Kilométrage au retour</Label>
                <Input id="end_mileage" name="end_mileage" type="number" min={0} placeholder="Ex. 45500" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fuel_level_end">Niveau carburant au retour (0–8)</Label>
                <Input id="fuel_level_end" name="fuel_level_end" type="number" min={0} max={8} placeholder="8 = plein" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  Confirmer la clôture
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
}
