"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";

const optionalUuid = z.preprocess((value) => value === "" || value == null ? undefined : value, z.string().uuid().optional());

export async function saveRentalParticipants(_prev: { error?: string; success?: boolean }, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = z.object({ contract_id: z.string().uuid(), payer_customer_id: optionalUuid, principal_driver_customer_id: optionalUuid }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Données invalides." };
  const additionalDriverIds = formData.getAll("additional_driver_ids").map(String).filter(Boolean);
  if (additionalDriverIds.some((id) => !z.string().uuid().safeParse(id).success)) return { error: "Conducteur additionnel invalide." };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: contract } = await (supabase as any).from("contracts").select("id,branch_id,customer_id").eq("id", d.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  const customerIds = [d.payer_customer_id, d.principal_driver_customer_id, ...additionalDriverIds].filter(Boolean) as string[];
  if (customerIds.length) {
    const { data: customers } = await supabase.from("customers").select("id").eq("agency_id", ctx.membership.agencyId).in("id", customerIds).is("deleted_at", null);
    if ((customers ?? []).length !== new Set(customerIds).size) return { error: "Un participant n'appartient pas à cette agence." };
  }
  await (supabase as any).from("rental_participants").delete().eq("contract_id", contract.id).eq("agency_id", ctx.membership.agencyId);
  const rows = [
    d.payer_customer_id ? { role: "PAYER", customer_id: d.payer_customer_id } : null,
    d.principal_driver_customer_id ? { role: "PRINCIPAL_DRIVER", customer_id: d.principal_driver_customer_id } : null,
    ...additionalDriverIds.map((customer_id) => ({ role: "ADDITIONAL_DRIVER", customer_id })),
  ].filter(Boolean).map((row: any) => ({ ...row, agency_id: ctx.membership.agencyId, branch_id: contract.branch_id ?? ctx.membership.branchId ?? null, contract_id: contract.id, created_by: ctx.user.id }));
  if (rows.length) {
    const { error } = await (supabase as any).from("rental_participants").insert(rows);
    if (error) return { error: error.message };
  }
  const { error: contractError } = await (supabase as any).from("contracts").update({ payer_customer_id: d.payer_customer_id ?? null, principal_driver_customer_id: d.principal_driver_customer_id ?? contract.customer_id }).eq("id", contract.id).eq("agency_id", ctx.membership.agencyId);
  if (contractError) return { error: contractError.message };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, branchId: contract.branch_id, actorId: ctx.user.id, action: "RENTAL_PARTICIPANTS_UPDATED", entityType: "contract", entityId: contract.id, metadata: { payer: d.payer_customer_id ?? null, principalDriver: d.principal_driver_customer_id ?? contract.customer_id, additionalDrivers: additionalDriverIds } });
  revalidatePath(`/agency/contracts/${contract.id}`);
  return { success: true };
}
