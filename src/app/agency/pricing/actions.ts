"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAgency } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { logAudit } from "@/lib/services/audit";

const ruleSchema = z.object({
  name: z.string().min(2).max(160),
  branch_id: z.string().uuid().optional().or(z.literal("")),
  vehicle_id: z.string().uuid().optional().or(z.literal("")),
  category: z.string().optional(),
  daily_rate: z.coerce.number().min(0),
  weekly_rate: z.coerce.number().min(0),
  monthly_rate: z.coerce.number().min(0),
  minimum_daily_rate: z.coerce.number().min(0),
  valid_from: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
  valid_to: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
});
const promotionSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(2).max(160),
  branch_id: z.string().uuid().optional().or(z.literal("")),
  discount_type: z.enum(["PERCENT", "FIXED"]),
  discount_value: z.coerce.number().min(0),
  minimum_days: z.coerce.number().int().min(1),
  valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function managerOnly(role: string) {
  return role === "AGENCY_OWNER" || role === "MANAGER";
}

export type PricingState = { error?: string; success?: boolean };

export async function createPricingRule(_prev: PricingState, formData: FormData): Promise<PricingState> {
  const ctx = await requireAgency();
  if (!managerOnly(ctx.membership.roleKey)) return { error: "Seul un propriétaire ou gérant peut modifier les tarifs." };
  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez les tarifs et la période." };
  if (parsed.data.valid_from && parsed.data.valid_to && parsed.data.valid_to < parsed.data.valid_from) return { error: "La fin doit être postérieure au début." };
  if (parsed.data.minimum_daily_rate > parsed.data.daily_rate) return { error: "Le minimum ne peut pas dépasser le tarif journalier." };
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "pricing.rules.create", 30, 3600))) return { error: "Trop de modifications tarifaires." };
  const { data: rule, error } = await supabase.from("pricing_rules").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: parsed.data.branch_id || ctx.membership.branchId || null,
    vehicle_id: parsed.data.vehicle_id || null,
    category: parsed.data.category || null,
    name: parsed.data.name,
    daily_rate: parsed.data.daily_rate,
    weekly_rate: parsed.data.weekly_rate,
    monthly_rate: parsed.data.monthly_rate,
    minimum_daily_rate: parsed.data.minimum_daily_rate,
    valid_from: parsed.data.valid_from || null,
    valid_to: parsed.data.valid_to || null,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error || !rule) return { error: error?.message ?? "Impossible de créer la règle." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: parsed.data.branch_id || ctx.membership.branchId, action: "PRICING_RULE_CREATED", entityType: "pricing_rule", entityId: rule.id, metadata: { name: parsed.data.name } });
  revalidatePath("/agency/pricing");
  return { success: true };
}

export async function createPromotion(_prev: PricingState, formData: FormData): Promise<PricingState> {
  const ctx = await requireAgency();
  if (!managerOnly(ctx.membership.roleKey)) return { error: "Seul un propriétaire ou gérant peut modifier les promotions." };
  const parsed = promotionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez la promotion et sa période." };
  if (parsed.data.valid_to < parsed.data.valid_from || (parsed.data.discount_type === "PERCENT" && parsed.data.discount_value > 100)) return { error: "Valeur ou période de promotion invalide." };
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "pricing.promotions.create", 30, 3600))) return { error: "Trop de modifications promotionnelles." };
  const { data: promotion, error } = await supabase.from("promotions").insert({
    agency_id: ctx.membership.agencyId,
    branch_id: parsed.data.branch_id || ctx.membership.branchId || null,
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    discount_type: parsed.data.discount_type,
    discount_value: parsed.data.discount_value,
    minimum_days: parsed.data.minimum_days,
    valid_from: parsed.data.valid_from,
    valid_to: parsed.data.valid_to,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error || !promotion) return { error: error?.message ?? "Impossible de créer la promotion." };
  await logAudit(supabase, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, branchId: parsed.data.branch_id || ctx.membership.branchId, action: "PROMOTION_CREATED", entityType: "promotion", entityId: promotion.id, metadata: { code: parsed.data.code } });
  revalidatePath("/agency/pricing");
  return { success: true };
}
