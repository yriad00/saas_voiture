import { NextResponse } from "next/server";
import { closeContract } from "@/app/agency/contracts/actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const contractId = String(formData.get("contract_id") ?? "");
    if (!contractId) return NextResponse.json({ error: "Contrat introuvable." }, { status: 400 });
    const result = await closeContract(contractId, formData, { revalidate: false });
    return NextResponse.json(result ?? { ok: true }, { status: result?.error ? 400 : 200 });
  } catch (error) {
    console.error("contract_close_api_failed", error);
    return NextResponse.json({ error: "Impossible de clôturer la location. Réessayez." }, { status: 500 });
  }
}
