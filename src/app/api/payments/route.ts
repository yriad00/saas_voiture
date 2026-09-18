import { NextResponse } from "next/server";
import { createPayment } from "@/app/agency/payments/actions";

export const runtime = "nodejs";

/**
 * Reliable multipart transport for hosted payment forms. The existing action
 * remains the single authority for auth, permissions, idempotency, financial
 * RPCs and audit logging.
 */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json(
        { error: "Requête non autorisée." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    const result = await createPayment({}, await request.formData(), { revalidate: false });
    return NextResponse.json(result, {
      status: result.error ? 400 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible d’enregistrer le paiement. Réessayez." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
