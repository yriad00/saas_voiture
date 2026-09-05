import { redirect } from "next/navigation";
import { getSessionContext, homeRouteFor } from "@/lib/auth/session";

export default async function RootPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  redirect(homeRouteFor(ctx));
}
