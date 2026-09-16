"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/services/audit";

const schema = z.object({
  accident_id: z.string().uuid(),
  media_type: z.enum(["PHOTO", "CONSTAT", "OTHER"]).default("PHOTO"),
});

export type AccidentPhotoState = { error?: string; success?: boolean };

export async function uploadAccidentPhoto(_prev: AccidentPhotoState, formData: FormData): Promise<AccidentPhotoState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse({ accident_id: formData.get("accident_id"), media_type: formData.get("media_type") || "PHOTO" });
  if (!parsed.success) return { error: "Sinistre invalide." };
  const file = formData.get("photo");
  if (!file || typeof file === "string" || file.size <= 0) return { error: "Sélectionnez une photo ou un constat." };
  if (!(file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp" || file.type === "application/pdf")) {
    return { error: "Formats acceptés : JPG, PNG, WebP ou PDF." };
  }
  if (file.size > 10 * 1024 * 1024) return { error: "Le fichier ne doit pas dépasser 10 Mo." };

  const supabase = await createClient();
  const { data: accident } = await (supabase as any)
    .from("accidents")
    .select("id,branch_id,status")
    .eq("id", parsed.data.accident_id)
    .eq("agency_id", ctx.membership.agencyId)
    .maybeSingle();
  if (!accident) return { error: "Sinistre introuvable." };
  if (accident.status === "CLOSED") return { error: "Un sinistre clos ne peut plus recevoir de document." };
  if (ctx.membership.branchId && accident.branch_id !== ctx.membership.branchId) return { error: "Agence non autorisée." };

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "document";
  const storagePath = `${ctx.membership.agencyId}/${accident.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("accident-photos").upload(storagePath, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) return { error: "Impossible d’envoyer le document. Réessayez." };

  const { data: media, error } = await (supabase as any)
    .from("accident_photos")
    .insert({
      agency_id: ctx.membership.agencyId,
      branch_id: accident.branch_id ?? ctx.membership.branchId ?? null,
      accident_id: accident.id,
      media_type: parsed.data.media_type,
      storage_path: storagePath,
      file_name: file.name,
      content_type: file.type,
      size_bytes: file.size,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error || !media) {
    await supabase.storage.from("accident-photos").remove([storagePath]);
    return { error: "Impossible d’enregistrer le document." };
  }
  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    branchId: accident.branch_id,
    actorId: ctx.user.id,
    action: "ACCIDENT_MEDIA_UPLOADED",
    entityType: "accident",
    entityId: accident.id,
    metadata: { mediaId: media.id, mediaType: parsed.data.media_type, sizeBytes: file.size },
  });
  revalidatePath("/agency/operations");
  return { success: true };
}

