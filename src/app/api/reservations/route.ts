import { NextResponse } from "next/server";
import { createReservation } from "@/app/agency/reservations/actions";

export const runtime = "nodejs";

/**
 * Reliable multipart transport for the reservation form on hosted runtimes.
 * All authentication, tenant, branch, pricing and availability checks remain
 * in the existing server action.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
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
