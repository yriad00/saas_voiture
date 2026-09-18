import { NextResponse } from "next/server";
import { recordDepositTransaction } from "@/app/agency/operations/actions";

export const runtime = "nodejs";

/** Keep deposit authorization, validation, idempotency and audit logic in the
 * existing action while using a reliable multipart transport on hosted pages. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Requête non autorisée." }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const result = await recordDepositTransaction({}, await request.formData());
    return NextResponse.json(result, {
      status: result?.error ? 400 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer l’opération de caution. Réessayez." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
