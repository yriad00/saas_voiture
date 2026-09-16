"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { consumeRateLimit } from "@/lib/services/rate-limit";

const documentSchema = z.object({
  document_type: z.enum(["REGISTRATION", "INSURANCE", "TECHNICAL_INSPECTION", "LEASE", "PURCHASE", "OTHER"]),
  document_number: z.string().max(120).optional(),
  issued_at: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).optional(),
  expires_at: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).optional(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type VehicleDocumentState = { error?: string; success?: boolean };

export async function uploadVehicleDocument(
  vehicleId: string,
  _prev: VehicleDocumentState,
  formData: FormData,
): Promise<VehicleDocumentState> {
  const ctx = await requireAgencyPermission("fleet:write", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  if (!z.string().uuid().safeParse(vehicleId).success) return { error: "Véhicule invalide." };
  const parsed = documentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez le type et les dates du document." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Sélectionnez un fichier." };
  if (file.size > MAX_FILE_SIZE) return { error: "Le fichier ne doit pas dépasser 10 Mo." };
  if (!ALLOWED_TYPES.has(file.type)) return { error: "Format accepté : PDF, JPG, PNG ou WEBP." };

  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "vehicle_documents.upload", 30, 3600))) {
    return { error: "Trop de téléversements. Réessayez dans quelques minutes." };
  }
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle) return { error: "Véhicule introuvable dans cette agence ou cette branche." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "document";
  const storagePath = `${ctx.membership.agencyId}/${vehicleId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("vehicle-documents")
    .upload(storagePath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { data: document, error } = await supabase
    .from("vehicle_documents")
    .insert({
      agency_id: ctx.membership.agencyId,
      vehicle_id: vehicleId,
      document_type: parsed.data.document_type,
      document_number: parsed.data.document_number || null,
      issued_at: parsed.data.issued_at || null,
      expires_at: parsed.data.expires_at || null,
      storage_path: storagePath,
      file_name: file.name,
      content_type: file.type,
      size_bytes: file.size,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error || !document) {
    await supabase.storage.from("vehicle-documents").remove([storagePath]);
    return { error: error?.message ?? "Impossible d'enregistrer le document." };
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    branchId: ctx.membership.branchId,
    action: "VEHICLE_DOCUMENT_UPLOADED",
    entityType: "vehicle",
    entityId: vehicleId,
    metadata: { documentId: document.id, documentType: parsed.data.document_type, sizeBytes: file.size },
  });
  revalidatePath(`/agency/fleet/${vehicleId}`);
  return { success: true };
}

export async function deleteVehicleDocument(vehicleId: string, documentId: string) {
  const ctx = await requireAgencyPermission("fleet:write", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("vehicle_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("vehicle_id", vehicleId)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!document) return { error: "Document introuvable." };
  const { error } = await supabase.from("vehicle_documents").delete().eq("id", documentId);
  if (error) return { error: error.message };
  await supabase.storage.from("vehicle-documents").remove([document.storage_path]);
  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    branchId: ctx.membership.branchId,
    action: "VEHICLE_DOCUMENT_DELETED",
    entityType: "vehicle",
    entityId: vehicleId,
    metadata: { documentId },
  });
  revalidatePath(`/agency/fleet/${vehicleId}`);
  return { ok: true };
}
