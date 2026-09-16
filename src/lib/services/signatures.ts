import "server-only";

import { logAudit } from "@/lib/services/audit";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SignatureParams = {
  agencyId: string;
  branchId: string | null;
  contractId: string;
  signerType: "CUSTOMER" | "EMPLOYEE";
  signerId?: string | null;
  actorId: string;
  signerName: string;
  signatureData: string;
};

/**
 * Persist a signature as an append-only, tenant-scoped contract record.
 * A second signer shares the current contract version; re-signing creates a
 * new version so the history remains auditable.
 */
export async function recordContractSignature(supabase: SupabaseClient, params: SignatureParams) {
  const { data: rows } = await supabase
    .from("contract_signatures")
    .select("signer_type,contract_version")
    .eq("agency_id", params.agencyId)
    .eq("contract_id", params.contractId)
    .order("contract_version", { ascending: false });

  const previous = (rows ?? []) as Array<{ signer_type: string; contract_version: number }>;
  const maxVersion = previous.reduce((max, row) => Math.max(max, Number(row.contract_version) || 0), 0);
  const sameSigner = previous.some((row) => row.signer_type === params.signerType);
  const version = sameSigner ? Math.max(1, maxVersion + 1) : Math.max(1, maxVersion || 1);

  const { data, error } = await supabase
    .from("contract_signatures")
    .insert({
      agency_id: params.agencyId,
      branch_id: params.branchId,
      contract_id: params.contractId,
      signer_type: params.signerType,
      signer_id: params.signerId ?? null,
      signer_name: params.signerName,
      signature_data: params.signatureData,
      contract_version: version,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Impossible d’enregistrer la signature." };

  await logAudit(supabase, {
    agencyId: params.agencyId,
    branchId: params.branchId,
    actorId: params.actorId,
    action: "CONTRACT_SIGNATURE_SAVED",
    entityType: "contract",
    entityId: params.contractId,
    metadata: { signerType: params.signerType, version, signatureId: data.id },
  });

  return { id: data.id as string, version };
}
