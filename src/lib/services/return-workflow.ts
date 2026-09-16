import { roundMoney } from "@/lib/utils";

export type ReturnFacts = {
  lateHours: number;
  lateDays: number;
  drivenMileage: number;
  extraMileage: number;
  fuelDelta: number;
  mileageRuleNeedsReview: boolean;
};

export function calculateReturnFacts(input: {
  checkoutMileage: number | null;
  returnMileage: number;
  checkoutFuel: number | null;
  returnFuel: number;
  plannedEnd: string;
  actualReturn: string;
  mileagePolicy?: "UNLIMITED" | "LIMITED" | "UNSPECIFIED";
  mileageAllowance?: number | null;
}): ReturnFacts {
  const lateMs = Math.max(0, new Date(input.actualReturn).getTime() - new Date(input.plannedEnd).getTime());
  const lateHours = Math.ceil(lateMs / 3_600_000);
  const lateDays = Math.ceil(lateHours / 24);
  const driven = input.checkoutMileage === null ? 0 : Math.max(0, input.returnMileage - input.checkoutMileage);
  const policy = input.mileagePolicy ?? (input.mileageAllowance === null || input.mileageAllowance === undefined ? "UNSPECIFIED" : "LIMITED");
  const hasAllowance = policy === "LIMITED" && input.mileageAllowance !== null && input.mileageAllowance !== undefined;
  return {
    lateHours,
    lateDays,
    drivenMileage: driven,
    extraMileage: hasAllowance ? Math.max(0, driven - Math.max(0, input.mileageAllowance ?? 0)) : 0,
    fuelDelta: Math.max(0, (input.checkoutFuel ?? input.returnFuel) - input.returnFuel),
    mileageRuleNeedsReview: policy === "UNSPECIFIED" || (policy === "LIMITED" && !hasAllowance),
  };
}

export function calculateReturnCharges(facts: ReturnFacts, prices: {
  dailyRate: number;
  mileageRate?: number;
  fuelRate?: number;
  cleaningFee?: number;
}, cleanliness?: string) {
  const rows: Array<{ charge_type: string; quantity: number; unit_price: number; amount: number; reason: string }> = [];
  if (facts.lateDays > 0) rows.push({ charge_type: "LATE_RETURN", quantity: facts.lateDays, unit_price: roundMoney(prices.dailyRate), amount: roundMoney(facts.lateDays * prices.dailyRate), reason: `${facts.lateDays} jour(s) de retard` });
  if (facts.extraMileage > 0 && (prices.mileageRate ?? 0) > 0) rows.push({ charge_type: "EXTRA_MILEAGE", quantity: facts.extraMileage, unit_price: roundMoney(prices.mileageRate ?? 0), amount: roundMoney(facts.extraMileage * (prices.mileageRate ?? 0)), reason: `${facts.extraMileage} km supplémentaires` });
  if (facts.fuelDelta > 0 && (prices.fuelRate ?? 0) > 0) rows.push({ charge_type: "FUEL", quantity: facts.fuelDelta, unit_price: roundMoney(prices.fuelRate ?? 0), amount: roundMoney(facts.fuelDelta * (prices.fuelRate ?? 0)), reason: `${facts.fuelDelta} niveau(x) de carburant manquant(s)` });
  if (cleanliness === "DIRTY" && (prices.cleaningFee ?? 0) > 0) rows.push({ charge_type: "CLEANING", quantity: 1, unit_price: roundMoney(prices.cleaningFee ?? 0), amount: roundMoney(prices.cleaningFee ?? 0), reason: "Nettoyage nécessaire au retour" });
  return rows;
}
