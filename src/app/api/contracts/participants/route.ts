import { NextResponse } from "next/server";
import { saveRentalParticipants } from "@/app/agency/contracts/[id]/participant-actions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const result = await saveRentalParticipants({}, formData, { revalidate: false });
    return NextResponse.json(result, { status: result?.error ? 400 : 200 });
  } catch (error) {
    console.error("rental_participants_api_failed", error);
    return NextResponse.json({ error: "Impossible d'enregistrer les rôles. Réessayez." }, { status: 500 });
  }
}
