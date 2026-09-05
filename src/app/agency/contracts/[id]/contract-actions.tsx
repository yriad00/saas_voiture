"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Ban } from "lucide-react";
import { closeContract, setContractStatus } from "../actions";
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
  const [showClose, setShowClose] = useState(false);
  const router = useRouter();

  const cancel = () => {
    if (!window.confirm("Annuler ce contrat ?")) return;
    startTransition(async () => {
      const res = await setContractStatus(contractId, "CANCELLED");
      if (res?.error) return window.alert(res.error);
      router.refresh();
    });
  };

  const submitClose = (formData: FormData) => {
    startTransition(async () => {
      const res = await closeContract(contractId, formData);
      if (res?.error) return window.alert(res.error);
      setShowClose(false);
      router.refresh();
    });
  };

  if (status === "CLOSED" || status === "CANCELLED") return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm" disabled={pending} onClick={() => setShowClose((v) => !v)}>
          <CheckCircle2 /> Clôturer le contrat
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={cancel}>
          <Ban /> Annuler
        </Button>
      </div>

      {showClose && (
        <Card className="mt-2">
          <CardHeader><CardTitle className="text-base">Clôture — restitution du véhicule</CardTitle></CardHeader>
          <CardContent>
            <form action={submitClose} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
