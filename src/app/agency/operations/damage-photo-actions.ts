"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAgencyPermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/services/audit";

const schema = z.object({ damage_id: z.string().uuid() });
export type DamagePhotoState = { error?: string; success?: boolean };

export async function uploadDamagePhoto(_prev: DamagePhotoState, formData: FormData): Promise<DamagePhotoState> {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const parsed = schema.safeParse({ damage_id: formData.get("damage_id") });
  if (!parsed.success) return { error: "Dommage invalide." };
  const file = formData.get("photo");
  if (!file || typeof file === "string" || file.size <= 0) return { error: "Sélectionnez une photo." };
  if (!("image/jpeg" === file.type || "image/png" === file.type || "image/webp" === file.type)) return { error: "Format accepté : JPG, PNG ou WebP." };
  if (file.size > 10 * 1024 * 1024) return { error: "La photo ne doit pas dépasser 10 Mo." };
  const supabase = await createClient();
  const { data: damage } = await (supabase as any).from("damage_records").select("id,branch_id").eq("id", parsed.data.damage_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!damage) return { error: "Dommage introuvable." };
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "photo";
  const storagePath = `${ctx.membership.agencyId}/${damage.id}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("damage-photos").upload(storagePath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) return { error: uploadError.message };
  const { data: photo, error } = await (supabase as any).from("damage_photos").insert({ agency_id: ctx.membership.agencyId, branch_id: damage.branch_id ?? ctx.membership.branchId ?? null, damage_id: damage.id, storage_path: storagePath, file_name: file.name, content_type: file.type, size_bytes: file.size, created_by: ctx.user.id }).select("id").single();
  if (error || !photo) { await supabase.storage.from("damage-photos").remove([storagePath]); return { error: error?.message ?? "Impossible d'enregistrer la photo." }; }
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: "DAMAGE_PHOTO_UPLOADED", entityType: "damage", entityId: damage.id, metadata: { photoId: photo.id, sizeBytes: file.size } });
  revalidatePath("/agency/operations");
  return { success: true };
}
