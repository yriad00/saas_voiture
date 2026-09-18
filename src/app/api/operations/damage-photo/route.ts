import { NextResponse } from "next/server";
import { uploadDamagePhoto } from "@/app/agency/operations/damage-photo-actions";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";

/** Reliable multipart transport; authorization and storage/RLS checks remain
 * inside the existing damage photo action. */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Requête non autorisée." }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const result = await uploadDamagePhoto({}, await request.formData());
    return NextResponse.json(result, { status: result?.error ? 400 : 200, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Impossible d’envoyer la photo. Réessayez." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
