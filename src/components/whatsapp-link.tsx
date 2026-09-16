import { MessageCircle } from "lucide-react";

export function WhatsAppLink({ phone, message = "Bonjour, FleetHub vous contacte au sujet de votre location." }: { phone?: string | null; message?: string }) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return <a className="inline-flex items-center gap-1.5 rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-300 dark:hover:bg-green-950/30" href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-3.5" /> WhatsApp</a>;
}
