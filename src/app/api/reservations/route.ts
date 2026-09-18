import { NextResponse } from "next/server";
import { createReservation } from "@/app/agency/reservations/actions";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";

/**
 * Reliable multipart transport for the reservation form on hosted runtimes.
 * All authentication, tenant, branch, pricing and availability checks remain
 * in the existing server action.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Requête non autorisée." }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const result = await createReservation({}, await request.formData());
    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible de créer la réservation. Réessayez." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
