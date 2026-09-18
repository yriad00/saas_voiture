import { NextResponse } from "next/server";
import { uploadContractPhoto } from "@/app/agency/contracts/photo-actions";

export const runtime = "nodejs";

/**
 * Multipart transport for inspection photos. The action keeps all existing
 * permission, tenant, branch, storage and audit checks; this route only avoids
 * the hosted React Server Action queue for file uploads mounted after review.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Requête non autorisée." }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const result = await uploadContractPhoto({}, await request.formData());
    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer la photo. Réessayez." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
