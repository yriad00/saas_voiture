"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { consumeRateLimit } from "@/lib/services/rate-limit";

const documentSchema = z.object({
  document_type: z.enum(["CIN_RECTO", "CIN_VERSO", "DRIVER_LICENSE_RECTO", "DRIVER_LICENSE_VERSO", "PASSPORT", "COMPANY", "OTHER"]),
  expires_at: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).optional(),
});

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type CustomerDocumentState = { error?: string; success?: boolean };

export async function uploadCustomerDocument(
  customerId: string,
  _prev: CustomerDocumentState,
  formData: FormData,
): Promise<CustomerDocumentState> {
  const ctx = await requireAgencyPermission("customers.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  if (!z.string().uuid().safeParse(customerId).success) return { error: "Client invalide." };
  const parsed = documentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Sélectionnez le type de document." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Sélectionnez un fichier." };
  if (file.size > MAX_FILE_SIZE) return { error: "Le fichier ne doit pas dépasser 10 Mo." };
  if (!ALLOWED_TYPES.has(file.type)) return { error: "Format accepté : PDF, JPG, PNG ou WEBP." };

  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "customer_documents.upload", 30, 3600))) {
    return { error: "Trop de téléversements. Réessayez dans quelques minutes." };
  }
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("agency_id", ctx.membership.agencyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!customer) return { error: "Client introuvable dans cette agence." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "document";
  const storagePath = `${ctx.membership.agencyId}/${customerId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("customer-documents")
    .upload(storagePath, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { data: document, error } = await supabase
    .from("customer_documents")
    .insert({
      agency_id: ctx.membership.agencyId,
      customer_id: customerId,
      document_type: parsed.data.document_type,
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
    await supabase.storage.from("customer-documents").remove([storagePath]);
    return { error: error?.message ?? "Impossible d'enregistrer le document." };
  }

  await logAudit(supabase, {
    agencyId: ctx.membership.agencyId,
    actorId: ctx.user.id,
    action: "CUSTOMER_DOCUMENT_UPLOADED",
    entityType: "customer",
    entityId: customerId,
    metadata: { documentId: document.id, documentType: parsed.data.document_type, sizeBytes: file.size },
  });
  revalidatePath(`/agency/customers/${customerId}`);
  return { success: true };
}
