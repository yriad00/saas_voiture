import type { Tables } from "@/lib/database.types";

export type Preparation = Tables<"vehicle_preparations">;
export const preparationChecks = [
  "vehicle_clean",
  "fuel_level_checked",
  "tires_checked",
  "documents_checked",
  "accessories_checked",
  "photos_checked",
] as const;

export function isPreparationReady(input: Pick<Preparation, typeof preparationChecks[number]> & Pick<Preparation, "keys_count">) {
  return preparationChecks.every((field) => input[field]) && input.keys_count > 0;
}

export function preparationStatus(input: Pick<Preparation, typeof preparationChecks[number]> & Pick<Preparation, "keys_count">): "READY" | "IN_PROGRESS" {
  return isPreparationReady(input) ? "READY" : "IN_PROGRESS";
}
