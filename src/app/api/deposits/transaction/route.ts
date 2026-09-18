import { NextResponse } from "next/server";
import { recordDepositTransaction } from "@/app/agency/operations/actions";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const runtime = "nodejs";

/** Keep deposit authorization, validation, idempotency and audit logic in the
 * existing action while using a reliable multipart transport on hosted pages. */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Requête non autorisée." }, { status: 403, headers: { "cache-control": "no-store" } });
    }
    const result = await recordDepositTransaction({}, await request.formData(), { revalidate: false });
    return NextResponse.json(result, {
      status: result?.error ? 400 : 200,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Impossible d’enregistrer l’opération de caution. Réessayez." }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
