"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { recordContractSignature } from "@/lib/services/signatures";

const schema = z.object({
  contract_id: z.string().uuid(),
  signer_type: z.enum(["CUSTOMER", "EMPLOYEE"]),
  signer_name: z.string().trim().min(2).max(160),
  signature_data: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Signature invalide.").max(3_000_000),
});

export type SignatureState = { error?: string; success?: boolean };

export async function saveContractSignature(_prev: SignatureState, formData: FormData): Promise<SignatureState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Signature invalide." };
  const s = await createClient();
  const { data: contract } = await s.from("contracts").select("id,branch_id,status").eq("id", parsed.data.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  if (!["ACTIVE", "CLOSED"].includes(contract.status)) return { error: "Le contrat doit être démarré avant la signature." };

  const saved = await recordContractSignature(s, {
    agencyId: ctx.membership.agencyId,
    branchId: contract.branch_id ?? ctx.membership.branchId ?? null,
    contractId: contract.id,
    signerType: parsed.data.signer_type,
    signerId: parsed.data.signer_type === "EMPLOYEE" ? ctx.user.id : null,
    actorId: ctx.user.id,
    signerName: parsed.data.signer_name,
    signatureData: parsed.data.signature_data,
  });
  if (saved.error) return { error: saved.error };
  revalidatePath(`/agency/contracts/${contract.id}`);
  return { success: true };
}
