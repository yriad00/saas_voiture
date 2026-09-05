"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";
import { nextContractNumber } from "@/lib/services/contracts";
import type { Enums } from "@/lib/database.types";

const schema = z.object({
  reservation_id: z.string().uuid().optional().or(z.literal("")),
  customer_id: z.string().uuid("Sélectionnez un client"),
  vehicle_id: z.string().uuid("Sélectionnez un véhicule"),
  start_date: z.string().min(1, "Date de début requise"),
  end_date: z.string().min(1, "Date de fin requise"),
  daily_rate: z.coerce.number().min(0).default(0),
  deposit_amount: z.coerce.number().min(0).default(0),
  total_amount: z.coerce.number().min(0).default(0),
  start_mileage: z.coerce.number().int().min(0).optional(),
  fuel_level_start: z.coerce.number().int().min(0).max(8).optional(),
  terms: z.string().optional(),
});

export type ContractFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: { id: string };
};

export async function createContract(
  _prev: ContractFormState,
  formData: FormData,
): Promise<ContractFormState> {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
    return { error: "Veuillez corriger les champs.", fieldErrors: fe };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const contractNumber = await nextContractNumber(ctx.membership.agencyId);

  const { data: created, error } = await supabase
    .from("contracts")
    .insert({
      agency_id: ctx.membership.agencyId,
      reservation_id: d.reservation_id || null,
      customer_id: d.customer_id,
      vehicle_id: d.vehicle_id,
      contract_number: contractNumber,
      start_date: d.start_date,
      end_date: d.end_date,
      daily_rate: d.daily_rate,
      deposit_amount: d.deposit_amount,
      total_amount: d.total_amount,
      start_mileage: d.start_mileage ?? null,
      fuel_level_start: d.fuel_level_start ?? null,
      terms: d.terms || null,
      status: "ACTIVE",
      signed_at: new Date().toISOString(),
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Impossible de créer le contrat." };

  // Mark the vehicle as rented and reservation as ongoing.
  await supabase.from("vehicles").update({ status: "RENTED" }).eq("id", d.vehicle_id);
  if (d.reservation_id) {
    await supabase.from("reservations").update({ status: "ONGOING" }).eq("id", d.reservation_id);
  }

  revalidatePath("/agency/contracts");
  return { success: { id: created.id } };
}

/** Close a contract: record end mileage/fuel, set vehicle available, reservation completed. */
const closeSchema = z.object({
  end_mileage: z.coerce.number().int().min(0).optional(),
  fuel_level_end: z.coerce.number().int().min(0).max(8).optional(),
});

export async function closeContract(contractId: string, formData: FormData) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = closeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Valeurs invalides." };

  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("vehicle_id, reservation_id")
    .eq("id", contractId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "CLOSED",
      end_mileage: parsed.data.end_mileage ?? null,
      fuel_level_end: parsed.data.fuel_level_end ?? null,
    })
    .eq("id", contractId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  await supabase.from("vehicles").update({ status: "AVAILABLE" }).eq("id", contract.vehicle_id);
  if (parsed.data.end_mileage) {
    await supabase.from("vehicles").update({ mileage: parsed.data.end_mileage }).eq("id", contract.vehicle_id);
  }
  if (contract.reservation_id) {
    await supabase.from("reservations").update({ status: "COMPLETED" }).eq("id", contract.reservation_id);
  }

  revalidatePath("/agency/contracts");
  revalidatePath(`/agency/contracts/${contractId}`);
  return { ok: true };
}

export async function setContractStatus(contractId: string, status: Enums<"contract_status">) {
  const ctx = await requireAgency(["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contractId)
    .eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };

  revalidatePath("/agency/contracts");
  revalidatePath(`/agency/contracts/${contractId}`);
  return { ok: true };
}
