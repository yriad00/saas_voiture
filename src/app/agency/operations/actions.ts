"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { can, requireAgency, requireAgencyPermission } from "@/lib/auth/session";
import { logAudit } from "@/lib/services/audit";
import { syncVehicleStatus } from "@/lib/services/availability";

const uuid = z.string().uuid();
const optionalUuid = z.preprocess((value) => value === "" || value === null ? undefined : value, uuid.optional());
const money = z.coerce.number().min(0);

async function branchAllowed(supabase: any, ctx: { membership: { agencyId: string; branchId: string | null } }, branchId: string) {
  if (ctx.membership.branchId && ctx.membership.branchId !== branchId) return false;
  const { data } = await supabase.from("branches").select("id").eq("id", branchId).eq("agency_id", ctx.membership.agencyId).eq("active", true).maybeSingle();
  return Boolean(data);
}

export async function createDamage(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const p = z.object({ vehicle_id: uuid, branch_id: uuid, customer_id: optionalUuid, contract_id: optionalUuid, body_area: z.string().min(1), damage_type: z.string().min(1), severity: z.enum(["MINOR","MODERATE","MAJOR","CRITICAL"]), description: z.string().min(2), estimated_repair_cost: money.default(0), customer_charge: money.default(0) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Données invalides" };
  const s = await createClient();
  if (!(await branchAllowed(s, ctx, p.data.branch_id))) return { error: "Agence non autorisée." };
  const { data, error } = await (s as any).from("damage_records").insert({ ...p.data, agency_id: ctx.membership.agencyId, created_by: ctx.user.id }).select("id").single();
  if (error) return { error: error.message };
  await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: p.data.branch_id, actorId: ctx.user.id, action: "DAMAGE_REPORTED", entityType: "damage", entityId: data.id, metadata: { severity: p.data.severity } });
  revalidatePath("/agency/operations"); return { success: true };
}

export async function createAccident(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const p = z.object({ vehicle_id: uuid, branch_id: uuid, contract_id: optionalUuid, customer_id: optionalUuid, damage_id: optionalUuid, occurred_at: z.string().min(1), location: z.string().min(1), description: z.string().min(2), insurance_company: z.string().optional(), claim_reference: z.string().optional(), deductible: money.default(0), estimated_repair_cost: money.default(0) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Données invalides" };
  const s = await createClient(); if (!(await branchAllowed(s, ctx, p.data.branch_id))) return { error: "Agence non autorisée." }; const { damage_id, ...accident } = p.data; const { data, error } = await (s as any).from("accidents").insert({ ...accident, agency_id: ctx.membership.agencyId, created_by: ctx.user.id }).select("id").single();
  if (error) return { error: error.message };
  if (damage_id) {
    const { error: linkError } = await (s as any).from("accident_damages").insert({ agency_id: ctx.membership.agencyId, branch_id: p.data.branch_id, accident_id: data.id, damage_id });
    if (linkError) {
      // The accident and its optional damage link form one business operation.
      // Remove the just-created parent if the link cannot be persisted so a
      // retry never leaves an orphaned accident behind.
      await (s as any).from("accidents").delete().eq("id", data.id).eq("agency_id", ctx.membership.agencyId);
      return { error: linkError.message };
    }
  }
  await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: p.data.branch_id, actorId: ctx.user.id, action: "ACCIDENT_REPORTED", entityType: "accident", entityId: data.id, metadata: { damageId: damage_id ?? null } }); revalidatePath("/agency/operations"); return { success: true };
}

export async function updateAccident(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER"]);
  const p = z.object({ accident_id: uuid, status: z.enum(["REPORTED", "UNDER_REVIEW", "CLAIM_OPEN", "REPAIRING", "RESOLVED", "CLOSED"]), police_reference: z.string().max(160).optional(), claim_reference: z.string().max(160).optional(), insurance_company: z.string().max(160).optional(), deductible: money.default(0), estimated_repair_cost: money.default(0), final_cost: money.default(0), customer_liability: money.default(0), insurance_reimbursement: money.default(0), notes: z.string().max(2000).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "Données de sinistre invalides." };
  const s = await createClient();
  const { data: accident } = await (s as any).from("accidents").select("id,agency_id,branch_id,vehicle_id,status").eq("id", p.data.accident_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!accident) return { error: "Sinistre introuvable." };
  if (!(await branchAllowed(s, ctx, accident.branch_id))) return { error: "Agence non autorisée." };
  const { error } = await (s as any).from("accidents").update({ status: p.data.status, police_reference: p.data.police_reference || null, claim_reference: p.data.claim_reference || null, insurance_company: p.data.insurance_company || null, deductible: p.data.deductible, estimated_repair_cost: p.data.estimated_repair_cost, final_cost: p.data.final_cost, customer_liability: p.data.customer_liability, insurance_reimbursement: p.data.insurance_reimbursement, notes: p.data.notes || null, updated_at: new Date().toISOString() }).eq("id", accident.id).eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };
  if (["RESOLVED", "CLOSED"].includes(p.data.status)) await syncVehicleStatus(s, ctx.membership.agencyId, accident.vehicle_id);
  await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: accident.branch_id, actorId: ctx.user.id, action: "ACCIDENT_UPDATED", entityType: "accident", entityId: accident.id, metadata: { from: accident.status, to: p.data.status, finalCost: p.data.final_cost, customerLiability: p.data.customer_liability, insuranceReimbursement: p.data.insurance_reimbursement } });
  revalidatePath("/agency/operations"); revalidatePath(`/agency/fleet/${accident.vehicle_id}`);
  return { success: true };
}

export async function createFine(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER", "AGENT"]);
  const p = z.object({ vehicle_id: uuid, branch_id: uuid, violation_at: z.string().min(1), amount: money, reference: z.string().optional(), notes: z.string().optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Données invalides" };
  const s = await createClient();
  if (!(await branchAllowed(s, ctx, p.data.branch_id))) return { error: "Agence non autorisée." };
  const { data: matches } = await s.from("contracts").select("id, customer_id, start_date, end_date").eq("agency_id", ctx.membership.agencyId).eq("vehicle_id", p.data.vehicle_id).lte("start_date", p.data.violation_at).gte("end_date", p.data.violation_at).in("status", ["ACTIVE", "CLOSED"]);
  const linked = matches?.length === 1 ? matches[0] : null;
  const { data, error } = await (s as any).from("fines").insert({ ...p.data, agency_id: ctx.membership.agencyId, contract_id: linked?.id ?? null, customer_id: linked?.customer_id ?? null, status: linked ? "LINKED" : "UNRESOLVED", created_by: ctx.user.id }).select("id").single();
  if (error) return { error: error.message }; await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: p.data.branch_id, actorId: ctx.user.id, action: "FINE_CREATED", entityType: "fine", entityId: data.id, metadata: { matches: matches?.length ?? 0 } }); revalidatePath("/agency/operations"); return { success: true, linked: Boolean(linked), ambiguous: (matches?.length ?? 0) > 1 };
}

export async function resolveFine(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER"]);
  const p = z.object({ fine_id: uuid, contract_id: uuid }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "Fine et contrat requis." };
  const s = await createClient();
  const { data: contract } = await s.from("contracts").select("id,customer_id").eq("id", p.data.contract_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!contract) return { error: "Contrat introuvable." };
  const { error } = await (s as any).from("fines").update({ contract_id: contract.id, customer_id: contract.customer_id, status: "LINKED", updated_at: new Date().toISOString() }).eq("id", p.data.fine_id).eq("agency_id", ctx.membership.agencyId).eq("status", "UNRESOLVED");
  if (error) return { error: error.message };
  await logAudit(s, { agencyId: ctx.membership.agencyId, actorId: ctx.user.id, action: "FINE_MANUALLY_RESOLVED", entityType: "fine", entityId: p.data.fine_id, metadata: { contractId: contract.id } }); revalidatePath("/agency/operations"); return { success: true };
}

export async function updateDamageRepair(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER"]);
  const p = z.object({ damage_id: uuid, status: z.enum(["REPORTED", "UNDER_REVIEW", "APPROVED", "REPAIRING", "REPAIRED", "CLOSED"]), garage_name: z.string().max(160).optional(), final_repair_cost: money.default(0), repair_notes: z.string().max(2000).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: "Données de réparation invalides." };
  const s = await createClient();
  const { data: damage } = await (s as any).from("damage_records").select("id,vehicle_id,branch_id,status").eq("id", p.data.damage_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!damage) return { error: "Dommage introuvable." };
  const { error } = await (s as any).from("damage_records").update({ status: p.data.status, garage_name: p.data.garage_name || null, final_repair_cost: p.data.final_repair_cost, repair_notes: p.data.repair_notes || null, immobilized_to: ["REPAIRED", "CLOSED"].includes(p.data.status) ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", damage.id).eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };
  if (["REPAIRED", "CLOSED"].includes(p.data.status)) {
    // Clear the previous damage lock before recomputing other availability blockers
    // (maintenance, transfer, reservation, or another severe damage can still win).
    await (s as any).from("vehicles").update({ status: "AVAILABLE" }).eq("id", damage.vehicle_id).eq("agency_id", ctx.membership.agencyId);
    await syncVehicleStatus(s, ctx.membership.agencyId, damage.vehicle_id);
  }
  await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: damage.branch_id, actorId: ctx.user.id, action: "DAMAGE_REPAIR_UPDATED", entityType: "damage", entityId: damage.id, metadata: { from: damage.status, to: p.data.status, finalCost: p.data.final_repair_cost, garage: p.data.garage_name || null } });
  revalidatePath("/agency/operations"); revalidatePath(`/agency/fleet/${damage.vehicle_id}`); return { success: true };
}

export async function overrideReturnCharge(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("contracts.update", ["AGENCY_OWNER", "MANAGER"]);
  const p = z.object({ charge_id: uuid, branch_id: uuid, amount: money, reason: z.string().min(4) }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Données invalides" };
  const s = await createClient();
  const { data: charge } = await (s as any).from("return_charges").select("id,agency_id,amount,contract_id,reason").eq("id", p.data.charge_id).eq("agency_id", ctx.membership.agencyId).maybeSingle();
  if (!charge) return { error: "Charge introuvable." };
  const { error: historyError } = await (s as any).from("return_charge_override_history").insert({ agency_id: ctx.membership.agencyId, branch_id: p.data.branch_id, charge_id: charge.id, original_amount: Number(charge.amount), overridden_amount: p.data.amount, reason: p.data.reason, actor_id: ctx.user.id });
  if (historyError) return { error: historyError.message };
  const { error } = await (s as any).from("return_charges").update({ amount: p.data.amount, source: "OVERRIDE", reason: `${charge.reason ?? "Charge"} · override: ${p.data.reason}` }).eq("id", charge.id).eq("agency_id", ctx.membership.agencyId);
  if (error) return { error: error.message };
  await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: p.data.branch_id, actorId: ctx.user.id, action: "RETURN_CHARGE_OVERRIDDEN", entityType: "return_charge", entityId: charge.id, metadata: { originalAmount: charge.amount, overriddenAmount: p.data.amount, reason: p.data.reason } });
  revalidatePath(`/agency/contracts/${charge.contract_id}`); return { success: true };
}

export async function recordDepositTransaction(_prev: any, formData: FormData) {
  const ctx = await requireAgencyPermission("payments.create", ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"]);
  const p = z.object({
    deposit_id: uuid,
    branch_id: uuid,
    transaction_type: z.enum(["RECEIVED", "DEDUCTION", "REFUND"]),
    amount: z.coerce.number().positive(),
    reason: z.string().min(2),
    payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CHECK"]).default("CASH"),
    cheque_status: z.preprocess((value) => value === "" || value === null ? undefined : value,
      z.enum(["RECEIVED", "HELD", "RETURNED", "DEPOSITED_USED", "CANCELLED_PROBLEM"]).optional()),
    idempotency_key: z.string().min(8),
  }).superRefine((value, refinement) => {
    if (value.payment_method === "CHECK" && !value.cheque_status) {
      refinement.addIssue({ code: z.ZodIssueCode.custom, path: ["cheque_status"], message: "Sélectionnez l'état du chèque." });
    }
    if (value.payment_method !== "CHECK" && value.cheque_status) {
      refinement.addIssue({ code: z.ZodIssueCode.custom, path: ["cheque_status"], message: "L'état du chèque est réservé au paiement par chèque." });
    }
  }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Données invalides" };
  const s = await createClient();
  if (!(await branchAllowed(s, ctx, p.data.branch_id))) return { error: "Agence non autorisée." };
  const { data: dep } = await (s as any).from("deposits").select("id,agency_id,contract_id,required_amount,received_amount,held_amount,refunded_amount,deducted_amount,branch_id").eq("id", p.data.deposit_id).eq("agency_id", ctx.membership.agencyId).single();
  if (!dep) return { error: "Caution introuvable." };
  const { data: priorTransaction } = await (s as any)
    .from("deposit_transactions")
    .select("id,transaction_type,amount,deposit_id,payment_method,cheque_status")
    .eq("agency_id", ctx.membership.agencyId)
    .eq("idempotency_key", p.data.idempotency_key)
    .maybeSingle();
  if (priorTransaction) {
    const samePayload = priorTransaction.deposit_id === p.data.deposit_id
      && priorTransaction.transaction_type === p.data.transaction_type
      && Number(priorTransaction.amount) === Number(p.data.amount)
      && priorTransaction.payment_method === p.data.payment_method
      && (priorTransaction.cheque_status ?? null) === (p.data.cheque_status ?? null);
    if (!samePayload) return { error: "Cette clé d'idempotence est déjà utilisée pour une autre opération." };
    return { success: true };
  }
  const available = Number(dep.held_amount) - Number(dep.refunded_amount) - Number(dep.deducted_amount);
  if (p.data.transaction_type === "RECEIVED" && p.data.amount > Number(dep.required_amount) - Number(dep.received_amount)) return { error: "La caution reçue dépasse le montant requis." };
  if (["REFUND", "DEDUCTION"].includes(p.data.transaction_type) && p.data.amount > available) return { error: "Le montant dépasse le solde détenu." };
  const { error } = await (s as any).from("deposit_transactions").insert({ ...p.data, agency_id: ctx.membership.agencyId, settles_balance: p.data.transaction_type === "DEDUCTION", created_by: ctx.user.id });
  if (error?.code === "23505") return { error: "Cette opération a déjà été traitée." }; if (error) return { error: error.message };
  await logAudit(s, { agencyId: ctx.membership.agencyId, branchId: p.data.branch_id, actorId: ctx.user.id, action: `DEPOSIT_${p.data.transaction_type}`, entityType: "deposit", entityId: dep.id, metadata: { amount: p.data.amount, settlesBalance: p.data.transaction_type === "DEDUCTION", idempotencyKey: p.data.idempotency_key } });
  if (dep.contract_id) revalidatePath(`/agency/contracts/${dep.contract_id}`);
  revalidatePath("/agency/operations");
  return { success: true };
}

export async function openCashSession(_prev: any, formData: FormData) { const ctx = await requireAgencyPermission("payments.create", ["AGENCY_OWNER","MANAGER","ACCOUNTANT"]); const p = z.object({ branch_id: uuid, opening_balance: money }).safeParse(Object.fromEntries(formData)); if (!p.success) return { error: "Données invalides" }; const s=await createClient(); if (!(await branchAllowed(s, ctx, p.data.branch_id))) return { error: "Agence non autorisée." }; const { data,error }=await (s as any).from("cash_sessions").insert({ ...p.data, agency_id:ctx.membership.agencyId, opened_by:ctx.user.id }).select("id").single(); if(error)return{error:error.message}; await logAudit(s,{agencyId:ctx.membership.agencyId,branchId:p.data.branch_id,actorId:ctx.user.id,action:"CASH_SESSION_OPENED",entityType:"cash_session",entityId:data.id,metadata:{}}); revalidatePath("/agency/operations"); return{success:true}; }
export async function addCashMovement(_prev: any, formData: FormData) { const ctx=await requireAgencyPermission("payments.create",["AGENCY_OWNER","MANAGER","ACCOUNTANT"]); const p=z.object({session_id:uuid,branch_id:uuid,movement_type:z.enum(["PAYMENT","REFUND","EXPENSE","ADJUSTMENT"]),amount:z.coerce.number().positive(),reason:z.string().min(2)}).safeParse(Object.fromEntries(formData)); if(!p.success)return{error:"Données invalides"}; const s=await createClient(); const {data:session}=await(s as any).from("cash_sessions").select("id,status").eq("id",p.data.session_id).eq("agency_id",ctx.membership.agencyId).eq("branch_id",p.data.branch_id).maybeSingle(); if(!session||session.status!=="OPEN")return{error:"Session de caisse fermée ou introuvable."}; const {error}=await(s as any).from("cash_movements").insert({...p.data,agency_id:ctx.membership.agencyId,created_by:ctx.user.id}); if(error)return{error:error.message}; await logAudit(s,{agencyId:ctx.membership.agencyId,branchId:p.data.branch_id,actorId:ctx.user.id,action:"CASH_MOVEMENT_ADDED",entityType:"cash_session",entityId:p.data.session_id,metadata:{amount:p.data.amount,type:p.data.movement_type}}); revalidatePath("/agency/operations"); return{success:true}; }
export async function closeCashSession(_prev: any, formData: FormData) { const ctx=await requireAgencyPermission("payments.create",["AGENCY_OWNER","MANAGER","ACCOUNTANT"]); const p=z.object({session_id:uuid,branch_id:uuid,actual_closing_balance:money,notes:z.string().optional()}).safeParse(Object.fromEntries(formData)); if(!p.success)return{error:"Données invalides"}; const s=await createClient(); const {data:session}=await(s as any).from("cash_sessions").select("id,status,opening_balance").eq("id",p.data.session_id).eq("agency_id",ctx.membership.agencyId).eq("branch_id",p.data.branch_id).single(); if(!session||session.status!=="OPEN")return{error:"Session déjà fermée."}; const {data:moves}=await(s as any).from("cash_movements").select("movement_type,amount").eq("session_id",session.id); const expected=Number(session.opening_balance)+(moves??[]).reduce((sum:any,m:any)=>sum+(m.movement_type==="PAYMENT"?1:-1)*Number(m.amount),0); const {error}=await(s as any).from("cash_sessions").update({status:"CLOSED",actual_closing_balance:p.data.actual_closing_balance,expected_closing_balance:expected,difference:p.data.actual_closing_balance-expected,closed_at:new Date().toISOString(),closed_by:ctx.user.id,notes:p.data.notes??null}).eq("id",session.id).eq("status","OPEN"); if(error)return{error:error.message}; await logAudit(s,{agencyId:ctx.membership.agencyId,branchId:p.data.branch_id,actorId:ctx.user.id,action:"CASH_SESSION_CLOSED",entityType:"cash_session",entityId:session.id,metadata:{expected,actual:p.data.actual_closing_balance}}); revalidatePath("/agency/operations"); return{success:true,expected}; }

export async function createMission(_prev:any,formData:FormData){const ctx=await requireAgencyPermission("contracts.update",["AGENCY_OWNER","MANAGER","AGENT"]);const p=z.object({branch_id:uuid,vehicle_id:optionalUuid,customer_id:optionalUuid,contract_id:optionalUuid,mission_type:z.enum(["DELIVERY","COLLECTION","AIRPORT_DELIVERY","HOTEL_DELIVERY","CUSTOMER_ADDRESS","GARAGE","OTHER"]),scheduled_at:z.string().min(1),address:z.string().optional(),assigned_employee:optionalUuid,fee:money.default(0),notes:z.string().optional()}).safeParse(Object.fromEntries(formData));if(!p.success)return{error:"Données invalides"};const s=await createClient();if (!(await branchAllowed(s, ctx, p.data.branch_id))) return { error: "Agence non autorisée." };if(p.data.assigned_employee){const{data:driver}=await(s as any).from("agency_members").select("profile_id,branch_id,roles!inner(key)").eq("agency_id",ctx.membership.agencyId).eq("profile_id",p.data.assigned_employee).eq("status","active").eq("roles.key","DRIVER").maybeSingle();if(!driver)return{error:"Le chauffeur sélectionné n'est pas actif dans cette agence."};if(driver.branch_id&&driver.branch_id!==p.data.branch_id)return{error:"Ce chauffeur n'est pas affecté à la branche de la mission."};}const{error}=await(s as any).from("delivery_missions").insert({...p.data,agency_id:ctx.membership.agencyId,created_by:ctx.user.id});if(error)return{error:error.message};revalidatePath("/agency/operations");return{success:true};}
export async function assignMission(_prev:any,formData:FormData){const ctx=await requireAgencyPermission("contracts.update",["AGENCY_OWNER","MANAGER","AGENT"]);const p=z.object({mission_id:uuid,assigned_employee:uuid}).safeParse(Object.fromEntries(formData));if(!p.success)return{error:"Mission et chauffeur requis."};const s=await createClient();const{data:mission}=await(s as any).from("delivery_missions").select("id,branch_id,assigned_employee").eq("id",p.data.mission_id).eq("agency_id",ctx.membership.agencyId).maybeSingle();if(!mission)return{error:"Mission introuvable dans cette agence."};if(!(await branchAllowed(s,ctx,mission.branch_id)))return{error:"Agence non autorisée."};const{data:driver}=await(s as any).from("agency_members").select("profile_id,branch_id,roles!inner(key)").eq("agency_id",ctx.membership.agencyId).eq("profile_id",p.data.assigned_employee).eq("status","active").eq("roles.key","DRIVER").maybeSingle();if(!driver)return{error:"Le chauffeur sélectionné n'est pas actif dans cette agence."};if(driver.branch_id&&driver.branch_id!==mission.branch_id)return{error:"Ce chauffeur n'est pas affecté à la branche de la mission."};const{error}=await(s as any).from("delivery_missions").update({assigned_employee:p.data.assigned_employee,updated_at:new Date().toISOString()}).eq("id",mission.id).eq("agency_id",ctx.membership.agencyId);if(error)return{error:error.message};await logAudit(s,{agencyId:ctx.membership.agencyId,branchId:mission.branch_id,actorId:ctx.user.id,action:"DELIVERY_MISSION_ASSIGNED",entityType:"delivery_mission",entityId:mission.id,metadata:{from:mission.assigned_employee??null,to:p.data.assigned_employee}});revalidatePath("/agency/operations");revalidatePath("/agency/today");revalidatePath("/driver");return{success:true};}
export type MissionStatusState = { error?: string; success?: boolean };
export async function updateMissionStatus(_prev:MissionStatusState,formData:FormData):Promise<MissionStatusState>{const ctx=await requireAgency(["AGENCY_OWNER","MANAGER","AGENT","DRIVER"]);if(ctx.membership.roleKey!=="DRIVER"&&!can(ctx,"contracts.update"))return{error:"Permission insuffisante."};const p=z.object({mission_id:uuid,status:z.enum(["PLANNED","PREPARING","READY","ACCEPTED","ON_THE_WAY","ARRIVED","COMPLETED","FAILED","CANCELLED"])}).safeParse(Object.fromEntries(formData));if(!p.success)return{error:"Données invalides"};const s=await createClient();const q=(s as any).from("delivery_missions").update({status:p.data.status,updated_at:new Date().toISOString()}).eq("id",p.data.mission_id).eq("agency_id",ctx.membership.agencyId);if(ctx.membership.roleKey==="DRIVER")q.eq("assigned_employee",ctx.user.id);const{error}=await q;if(error)return{error:error.message};await logAudit(s,{agencyId:ctx.membership.agencyId,actorId:ctx.user.id,action:"DELIVERY_MISSION_STATUS_CHANGED",entityType:"delivery_mission",entityId:p.data.mission_id,metadata:{status:p.data.status}});revalidatePath("/agency/operations");revalidatePath("/driver");return{success:true};}
export async function createTransfer(_prev:any,formData:FormData){const ctx=await requireAgencyPermission("vehicles.update",["AGENCY_OWNER","MANAGER","AGENT"]);const p=z.object({vehicle_id:uuid,from_branch_id:uuid,to_branch_id:uuid,planned_departure:z.string().min(1),assigned_driver:optionalUuid,cost:money.default(0),notes:z.string().optional()}).refine(v=>v.from_branch_id!==v.to_branch_id,"Les agences source et destination doivent être différentes").safeParse(Object.fromEntries(formData));if(!p.success)return{error:p.error.issues[0]?.message??"Données invalides"};const s=await createClient();if (!(await branchAllowed(s, ctx, p.data.from_branch_id)) || !(await branchAllowed(s, ctx, p.data.to_branch_id))) return { error: "Agence de transfert non autorisée." };const{data,error}=await(s as any).from("vehicle_transfers").insert({...p.data,agency_id:ctx.membership.agencyId,created_by:ctx.user.id}).select("id").single();if(error)return{error:error.message};await logAudit(s,{agencyId:ctx.membership.agencyId,actorId:ctx.user.id,action:"VEHICLE_TRANSFER_CREATED",entityType:"vehicle_transfer",entityId:data.id,metadata:{}});revalidatePath("/agency/operations");return{success:true};}
export async function startTransfer(_prev:any,formData:FormData){const ctx=await requireAgencyPermission("vehicles.update",["AGENCY_OWNER","MANAGER","AGENT"]);const p=z.object({transfer_id:uuid,mileage_departure:z.coerce.number().int().min(0),fuel_departure:z.coerce.number().int().min(0).max(8)}).safeParse(Object.fromEntries(formData));if(!p.success)return{error:"Kilométrage et carburant de départ requis."};const s=await createClient();const{data:t}=await(s as any).from("vehicle_transfers").select("id,vehicle_id,from_branch_id,to_branch_id,status").eq("id",p.data.transfer_id).eq("agency_id",ctx.membership.agencyId).eq("status","PLANNED").maybeSingle();if(!t)return{error:"Transfert introuvable ou déjà démarré."};if(!(await branchAllowed(s,ctx,t.from_branch_id))||!(await branchAllowed(s,ctx,t.to_branch_id)))return{error:"Agences de transfert non autorisées."};const{data:vehicle}=await(s as any).from("vehicles").select("branch_id,mileage").eq("id",t.vehicle_id).eq("agency_id",ctx.membership.agencyId).maybeSingle();if(!vehicle||vehicle.branch_id!==t.from_branch_id)return{error:"Le véhicule n'est pas dans l'agence de départ."};if(vehicle.mileage!==null&&p.data.mileage_departure<vehicle.mileage)return{error:"Le kilométrage de départ ne peut pas être inférieur au kilométrage actuel."};const{error}=await(s as any).from("vehicle_transfers").update({status:"IN_TRANSIT",actual_departure:new Date().toISOString(),mileage_departure:p.data.mileage_departure,fuel_departure:p.data.fuel_departure,updated_at:new Date().toISOString()}).eq("id",t.id).eq("status","PLANNED");if(error)return{error:error.message};await logAudit(s,{agencyId:ctx.membership.agencyId,actorId:ctx.user.id,action:"VEHICLE_TRANSFER_STARTED",entityType:"vehicle_transfer",entityId:t.id,metadata:{mileageDeparture:p.data.mileage_departure,fuelDeparture:p.data.fuel_departure}});revalidatePath("/agency/operations");revalidatePath(`/agency/fleet/${t.vehicle_id}`);return{success:true};}
export async function completeTransfer(_prev:any,formData:FormData){const ctx=await requireAgencyPermission("vehicles.update",["AGENCY_OWNER","MANAGER"]);const p=z.object({transfer_id:uuid,mileage_arrival:z.coerce.number().int().min(0),fuel_arrival:z.coerce.number().int().min(0).max(8)}).safeParse(Object.fromEntries(formData));if(!p.success)return{error:"Données invalides"};const s=await createClient();const{data:t}=await(s as any).from("vehicle_transfers").select("*").eq("id",p.data.transfer_id).eq("agency_id",ctx.membership.agencyId).eq("status","IN_TRANSIT").single();if(!t)return{error:"Transfert introuvable ou déjà terminé."};if(t.mileage_departure!==null&&p.data.mileage_arrival<t.mileage_departure)return{error:"Kilométrage d'arrivée invalide."};const{error}=await(s as any).from("vehicle_transfers").update({status:"COMPLETED",arrival_at:new Date().toISOString(),mileage_arrival:p.data.mileage_arrival,fuel_arrival:p.data.fuel_arrival}).eq("id",t.id).eq("status","IN_TRANSIT");if(error)return{error:error.message};const{error:vehicleError}=await s.from("vehicles").update({branch_id:t.to_branch_id,mileage:p.data.mileage_arrival}).eq("id",t.vehicle_id).eq("agency_id",ctx.membership.agencyId);if(vehicleError){await(s as any).from("vehicle_transfers").update({status:"IN_TRANSIT",arrival_at:null,mileage_arrival:null,fuel_arrival:null}).eq("id",t.id).eq("status","COMPLETED");return{error:vehicleError.message};}await logAudit(s,{agencyId:ctx.membership.agencyId,actorId:ctx.user.id,action:"VEHICLE_TRANSFER_COMPLETED",entityType:"vehicle_transfer",entityId:t.id,metadata:{toBranchId:t.to_branch_id}});revalidatePath("/agency/operations");revalidatePath(`/agency/fleet/${t.vehicle_id}`);return{success:true};}
