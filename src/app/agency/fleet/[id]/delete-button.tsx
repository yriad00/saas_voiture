"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { deleteVehicle } from "../actions";
import { Button } from "@/components/ui/button";

export function DeleteVehicleButton({ vehicleId }: { vehicleId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (!window.confirm("Supprimer ce véhicule ? Cette action peut être annulée par un administrateur.")) return;
    startTransition(async () => {
      const res = await deleteVehicle(vehicleId);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      router.push("/agency/fleet");
    });
  };

  return (
    <Button variant="destructive" size="sm" disabled={pending} onClick={handleDelete}>
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      Supprimer
    </Button>
  );
}
