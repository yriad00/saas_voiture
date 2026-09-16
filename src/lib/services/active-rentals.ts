import type { Tables } from "@/lib/database.types";
export type ActiveRentalUpdate = Tables<"active_rental_updates">;
export const activeRentalEventTypes = ["MILEAGE", "CUSTOMER_CONTACT", "GPS_ALERT", "DAMAGE_REPORT", "OTHER"] as const;
export function isActiveRentalStatus(status: string) { return status === "ACTIVE"; }
