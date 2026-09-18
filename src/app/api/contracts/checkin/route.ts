import { NextResponse } from "next/server";
import { saveCheckin } from "@/app/agency/contracts/[id]/checkin-actions";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";

/**
 * Reliable multipart transport for the two-step return workflow. The action
 * remains the single authority for permission checks, validation, charges,
 * photo requirements and the finalization RPC.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Requête non autorisée." }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const result = await saveCheckin({}, await request.formData(), { revalidate: false });
    return NextResponse.json(result, {
      status: result?.error ? 400 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer le retour. Réessayez." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
