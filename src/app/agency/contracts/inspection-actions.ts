"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const optionalInteger = z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().int().min(0).optional(),
);

const schema = z.object({
  inspection_type: z.enum(["PICKUP", "RETURN"]),
  mileage: optionalInteger,
  fuel_level: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int().min(0).max(8).optional(),
  ),
  signature_name: z.string().trim().min(2, "Nom de signature requis"),
  notes: z.string().trim().max(2000).optional(),
  damage_notes: z.string().trim().max(2000).optional(),
});

export type InspectionFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
};

export async function recordInspection(
  _prev: InspectionFormState,
  formData: FormData,
): Promise<InspectionFormState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { error: "Veuillez corriger les champs.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status, branch_id")
    .eq("id", formData.get("contract_id")?.toString() ?? "")
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();

  const contractId = formData.get("contract_id")?.toString();
  if (!contractId || !contract) return { error: "Contrat introuvable dans cette agence." };

  if (parsed.data.inspection_type === "PICKUP" && contract.status !== "ACTIVE") {
    return { error: "Le constat de remise est disponible après l'activation du contrat." };
  }
  if (parsed.data.inspection_type === "RETURN" && contract.status !== "CLOSED") {
    return { error: "Clôturez le contrat avant d'enregistrer le constat de restitution." };
  }

  const { data: existing } = await (supabase as any)
    .from("contract_inspections")
    .select("id,status")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("contract_id", contractId)
    .eq("inspection_type", parsed.data.inspection_type)
    .maybeSingle();
  if (existing?.status === "FINALIZED") return { error: "Ce constat finalisé est immuable." };

  const { error } = await (supabase as any).from("contract_inspections").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: contract.branch_id ?? ctx.membership.branchId ?? null,
    contract_id: contractId,
    inspection_type: parsed.data.inspection_type,
    mileage: parsed.data.mileage ?? null,
    fuel_level: parsed.data.fuel_level ?? null,
    signature_name: parsed.data.signature_name,
    notes: parsed.data.notes || null,
    damage_notes: parsed.data.damage_notes || null,
    created_by: ctx.user.id,
    status: parsed.data.inspection_type === "RETURN" ? "FINALIZED" : "DRAFT",
    finalized_at: parsed.data.inspection_type === "RETURN" ? new Date().toISOString() : null,
    finalized_by: parsed.data.inspection_type === "RETURN" ? ctx.user.id : null,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ce constat existe déjà pour ce contrat." };
    return { error: error.message };
  }

  revalidatePath(`/agency/contracts/${contractId}`);
  return { success: true };
}
