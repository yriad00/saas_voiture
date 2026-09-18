"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { measurePerf, startPerf } from "@/lib/perf";

const schema = z.object({
  contract_id: z.string().uuid(),
  inspection_type: z.enum(["PICKUP", "RETURN"]),
  photo_type: z.enum(["FRONT", "REAR", "LEFT", "RIGHT", "INTERIOR", "DASHBOARD", "OTHER"]).default("OTHER"),
  idempotency_key: z.string().uuid().optional(),
});

export type PhotoFormState = { error?: string; success?: boolean };

export async function uploadContractPhoto(
  _prev: PhotoFormState,
  formData: FormData,
): Promise<PhotoFormState> {
  const finish = startPerf("uploadContractPhoto");
  try {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse({
    contract_id: formData.get("contract_id"),
    inspection_type: formData.get("inspection_type"),
    photo_type: formData.get("photo_type") || "OTHER",
    idempotency_key: formData.get("idempotency_key") || undefined,
  });
  if (!parsed.success) return { error: "Constat ou contrat invalide." };

  const fileValue = formData.get("photo");
  if (!fileValue || typeof fileValue === "string" || fileValue.size <= 0) return { error: "Sélectionnez une photo." };
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(fileValue.type)) return { error: "Format accepté : JPG, PNG ou WebP." };
  if (fileValue.size > 10 * 1024 * 1024) return { error: "La photo ne doit pas dépasser 10 Mo." };

  const supabase = await createClient();
  if (!(await measurePerf("photo.rateLimit", () => consumeRateLimit(supabase, "contract_photos.upload", 60, 3600)))) {
    return { error: "Trop de photos téléversées. Réessayez plus tard." };
  }
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, status, branch_id")
    .eq("id", parsed.data.contract_id)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!contract) return { error: "Contrat introuvable dans cette agence." };
  let photoBranchId = contract.branch_id ?? ctx.membership.branchId ?? null;
  if (parsed.data.inspection_type === "PICKUP" && contract.status !== "ACTIVE") return { error: "Le contrat doit être actif pour joindre une photo de remise." };
  if (parsed.data.inspection_type === "RETURN") {
    const { data: checkin } = await (supabase as any)
      .from("contract_checkins")
      .select("status, branch_id")
      .eq("contract_id", parsed.data.contract_id)
      .eq("agency_id", ctx.membership.agencyId)
      .maybeSingle();
    if (contract.status !== "CLOSED" && !["REVIEW", "FINALIZED"].includes(checkin?.status ?? "")) return { error: "Enregistrez le check-in avant les photos de restitution." };
    if (checkin?.status === "FINALIZED") return { error: "Les photos de restitution sont verrouillées après finalisation." };
    // A one-way return belongs to the destination branch for storage/RLS and
    // operational history, while pickup photos remain on the pickup branch.
    photoBranchId = checkin?.branch_id ?? photoBranchId;
  }

  const safeName = fileValue.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "photo";
  const idempotencyKey = parsed.data.idempotency_key ?? crypto.randomUUID();
  const storagePath = `${ctx.membership.agencyId}/${parsed.data.contract_id}/${parsed.data.inspection_type}/${idempotencyKey}-${safeName}`;
  const { data: existingPhoto } = await supabase
    .from("contract_inspection_photos")
    .select("id")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (existingPhoto) return { success: true };

  const { error: uploadError } = await measurePerf("photo.storage.upload", () => supabase.storage.from("contract-photos").upload(storagePath, fileValue, {
    contentType: fileValue.type,
    cacheControl: "3600",
    // The path is derived from the idempotency key. A retry may have already
    // uploaded the object while its response was lost, so replacing that same
    // object is safe and avoids creating a second path.
    upsert: true,
  }));
  if (uploadError) return { error: uploadError.message };

  const { data: photo, error: insertError } = await measurePerf("photo.metadata.insert", async () => supabase.from("contract_inspection_photos").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: photoBranchId,
    contract_id: parsed.data.contract_id,
    inspection_type: parsed.data.inspection_type,
    photo_type: parsed.data.photo_type,
    storage_path: storagePath,
    file_name: fileValue.name,
    content_type: fileValue.type,
    size_bytes: fileValue.size,
    created_by: ctx.user.id,
  }).select("id").single());
  if (insertError || !photo) {
    if (insertError?.code === "23505") {
      const { data: committedPhoto } = await supabase
        .from("contract_inspection_photos")
        .select("id")
        .eq("agency_id", ctx.membership.agencyId)
        .eq("storage_path", storagePath)
        .maybeSingle();
      if (committedPhoto) return { success: true };
    }
    await supabase.storage.from("contract-photos").remove([storagePath]);
    return { error: insertError?.message ?? "Impossible d'enregistrer la photo." };
  }

  await measurePerf("photo.audit", () => logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CONTRACT_PHOTO_UPLOADED",
    entityType: "contract",
    entityId: parsed.data.contract_id,
    metadata: { inspectionType: parsed.data.inspection_type, photoType: parsed.data.photo_type, photoId: photo.id, contentType: fileValue.type, sizeBytes: fileValue.size },
  }));
  // Keep the photo form mounted so a slow hosted Storage response cannot
  // remount the six upload controls and lose their local pending/success
  // state. The persisted row and Storage object are authoritative; the
  // dossier is refreshed naturally on the next navigation/reload.
  return { success: true };
  } finally {
    finish();
  }
}
