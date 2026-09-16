import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { roundMoney } from "@/lib/utils";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type RentalQuote = {
  days: number;
  baseDailyRate: number;
  dailyRate: number;
  subtotal: number;
  promotionDiscount: number;
  manualDiscount: number;
  total: number;
  minimumDailyRate: number;
  ruleId: string | null;
  promotionCode: string | null;
};

function daysBetween(start: string, end: string) {
  const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return Math.max(1, diff);
}

function dateMatches(date: string, from: string | null, to: string | null) {
  return (!from || date >= from) && (!to || date <= to);
}

export async function calculateRentalQuote(
  supabase: SupabaseClient,
  input: {
    agencyId: string;
    branchId: string | null;
    vehicleId: string;
    startDate: string;
    endDate: string;
    manualDailyRate?: number;
    manualDiscount?: number;
    promotionCode?: string;
    canOverrideMinimum?: boolean;
  },
): Promise<RentalQuote> {
  const days = daysBetween(input.startDate, input.endDate);
  const [{ data: vehicle, error: vehicleError }, { data: rules, error: rulesError }, { data: promotions, error: promotionsError }] = await Promise.all([
    supabase.from("vehicles").select("daily_rate, category, branch_id").eq("id", input.vehicleId).eq("agency_id", input.agencyId).maybeSingle(),
    supabase.from("pricing_rules").select("id, branch_id, vehicle_id, category, daily_rate, weekly_rate, monthly_rate, minimum_daily_rate, valid_from, valid_to").eq("agency_id", input.agencyId).eq("active", true),
    input.promotionCode ? supabase.from("promotions").select("code, branch_id, discount_type, discount_value, minimum_days, valid_from, valid_to").eq("agency_id", input.agencyId).eq("active", true).eq("code", input.promotionCode.toUpperCase()).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (vehicleError) throw vehicleError;
  if (rulesError) throw rulesError;
  if (promotionsError) throw promotionsError;
  if (!vehicle) throw new Error("Véhicule introuvable.");

  const validRules = (rules ?? []).filter((rule) =>
    dateMatches(input.startDate, rule.valid_from, rule.valid_to) &&
    (!rule.branch_id || rule.branch_id === input.branchId) &&
    (!rule.vehicle_id || rule.vehicle_id === input.vehicleId) &&
    (!rule.category || rule.category === vehicle.category),
  ).sort((a, b) => {
    const score = (rule: typeof a) => (rule.vehicle_id ? 4 : 0) + (rule.category ? 2 : 0) + (rule.branch_id ? 1 : 0);
    return score(b) - score(a);
  });
  const rule = validRules[0] ?? null;
  const baseDaily = Number(rule?.daily_rate ?? vehicle.daily_rate ?? 0);
  const minimumDailyRate = Number(rule?.minimum_daily_rate ?? 0);
  const dailyRate = input.manualDailyRate && input.manualDailyRate > 0 ? input.manualDailyRate : baseDaily;
  if (!input.canOverrideMinimum && dailyRate < minimumDailyRate) throw new Error(`Le tarif minimum autorisé est ${minimumDailyRate.toFixed(2)} MAD/jour.`);

  const weeklyRate = Number(rule?.weekly_rate ?? dailyRate * 7);
  const monthlyRate = Number(rule?.monthly_rate ?? dailyRate * 30);
  const months = Math.floor(days / 30);
  const weeks = Math.floor((days - months * 30) / 7);
  const remaining = days - months * 30 - weeks * 7;
  const subtotal = roundMoney(months * monthlyRate + weeks * weeklyRate + remaining * dailyRate);
  const promotion = promotions && dateMatches(input.startDate, promotions.valid_from, promotions.valid_to) && days >= promotions.minimum_days && (!promotions.branch_id || promotions.branch_id === input.branchId) ? promotions : null;
  const promotionDiscount = promotion ? roundMoney(promotion.discount_type === "PERCENT" ? subtotal * Number(promotion.discount_value) / 100 : Number(promotion.discount_value)) : 0;
  const manualDiscount = roundMoney(Math.max(0, input.manualDiscount ?? 0));
  const total = roundMoney(Math.max(0, subtotal - promotionDiscount - manualDiscount));
  return { days, baseDailyRate: roundMoney(baseDaily), dailyRate: roundMoney(dailyRate), subtotal, promotionDiscount, manualDiscount, total, minimumDailyRate, ruleId: rule?.id ?? null, promotionCode: promotion?.code ?? null };
}
