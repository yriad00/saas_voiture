"use client";

import { useActionState } from "react";
import { assignMission } from "./actions";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";

type Driver = { id: string; name: string };
type MissionAssignmentState = { error?: string; success?: boolean };

export function MissionAssignmentForm({ missionId, drivers }: { missionId: string; drivers: Driver[] }) {
  const [state, action] = useActionState<MissionAssignmentState, FormData>(assignMission, {});
  return <form action={action} className="mt-3 space-y-2 border-t border-border/60 pt-3">
    <input type="hidden" name="mission_id" value={missionId} readOnly />
    <Label htmlFor={`mission-driver-${missionId}`}>Affecter un chauffeur</Label>
    <div className="flex flex-wrap gap-2">
      <Select id={`mission-driver-${missionId}`} name="assigned_employee" defaultValue="" required className="min-w-0 flex-1">
        <option value="">Choisir un chauffeur…</option>
        {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
      </Select>
      <Button type="submit" size="sm" disabled={drivers.length === 0}>Affecter</Button>
    </div>
    {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
    {state?.success && <p className="text-xs text-emerald-600">Mission affectée.</p>}
  </form>;
}
