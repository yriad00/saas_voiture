/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAgency } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OperationsForms } from "./forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DamagePhotoForm } from "./damage-photo-form";
import { DamageRepairForm } from "./damage-repair-form";
import { TransferStatusForm } from "./transfer-status-form";
import { MissionAssignmentForm } from "./mission-assignment-form";
import { AccidentFollowupForm } from "./accident-followup-form";
import { AccidentPhotoForm } from "./accident-photo-form";

export default async function OperationsPage() {
  const ctx = await requireAgency();
  const s = await createClient();
  const [{ data: branches }, { data: damages }, { data: accidents }, { data: fines }, { data: missions }, { data: transfers }, { data: vehicles }, { data: customers }, { data: contracts }, { data: members }, { data: deposits }] = await Promise.all([
    (s as any).from("branches").select("id,name,code").eq("agency_id", ctx.membership.agencyId).eq("active", true).order("name"),
    (s as any).from("damage_records").select("id,body_area,severity,status,description,detected_at,garage_name,final_repair_cost").eq("agency_id", ctx.membership.agencyId).order("detected_at", { ascending: false }).limit(10),
    (s as any).from("accidents").select("id,location,status,occurred_at,insurance_company,police_reference,claim_reference,deductible,estimated_repair_cost,final_cost,customer_liability,insurance_reimbursement,notes").eq("agency_id", ctx.membership.agencyId).order("occurred_at", { ascending: false }).limit(10),
    (s as any).from("fines").select("id,amount,status,violation_at,reference,vehicle_id").eq("agency_id", ctx.membership.agencyId).order("violation_at", { ascending: false }).limit(30),
    (s as any).from("delivery_missions").select("id,mission_type,status,scheduled_at,address,assigned_employee,branch_id").eq("agency_id", ctx.membership.agencyId).order("scheduled_at", { ascending: true }).limit(10),
    (s as any).from("vehicle_transfers").select("id,status,planned_departure,vehicle_id,from_branch_id,to_branch_id,mileage_departure,fuel_departure,mileage_arrival,fuel_arrival").eq("agency_id", ctx.membership.agencyId).order("planned_departure", { ascending: true }).limit(10),
    s.from("vehicles").select("id,brand,model,license_plate,branch_id").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).order("brand"),
    s.from("customers").select("id,first_name,last_name").eq("agency_id", ctx.membership.agencyId).is("deleted_at", null).order("last_name").limit(200),
    s.from("contracts").select("id,contract_number,customer_id,vehicle_id,branch_id").eq("agency_id", ctx.membership.agencyId).in("status", ["DRAFT", "ACTIVE"]).order("created_at", { ascending: false }).limit(100),
    s.from("agency_members").select("profile_id,branch_id,profiles!inner(full_name),roles!inner(key)").eq("agency_id", ctx.membership.agencyId).eq("status", "active").eq("roles.key", "DRIVER"),
    (s as any).from("deposits").select("id,contract_id,status,held_amount").eq("agency_id", ctx.membership.agencyId).in("status", ["RECEIVED", "HELD", "PARTIALLY_DEDUCTED"]).limit(100),
  ]);
  const visibleBranches = ctx.membership.branchId ? (branches ?? []).filter((branch: any) => branch.id === ctx.membership.branchId) : (branches ?? []);
  const allowedVehicles = ctx.membership.branchId ? (vehicles ?? []).filter((vehicle) => vehicle.branch_id === ctx.membership.branchId) : (vehicles ?? []);
  const allowedContracts = ctx.membership.branchId ? (contracts ?? []).filter((contract) => contract.branch_id === ctx.membership.branchId) : (contracts ?? []);
  const drivers = (members ?? []).map((member: any) => ({ id: member.profile_id, name: member.profiles?.full_name ?? "Chauffeur" })).filter((driver) => !ctx.membership.branchId || (members ?? []).find((m: any) => m.profile_id === driver.id)?.branch_id === ctx.membership.branchId);
  const financialAccess = ["AGENCY_OWNER", "MANAGER", "ACCOUNTANT"].includes(ctx.membership.roleKey);
  const managerAccess = ["AGENCY_OWNER", "MANAGER"].includes(ctx.membership.roleKey);
  const statusLabel: Record<string, string> = { REPORTED: "Signalé", UNDER_REVIEW: "À examiner", APPROVED: "Approuvé", REPAIRING: "En réparation", REPAIRED: "Réparé", CLOSED: "Clos", CLAIM_OPEN: "Dossier ouvert", RESOLVED: "Résolu", UNRESOLVED: "À résoudre", LINKED: "Rattachée", PLANNED: "Planifié", PREPARING: "Préparation", READY: "Prêt", ACCEPTED: "Acceptée", ON_THE_WAY: "En route", ARRIVED: "Arrivée", COMPLETED: "Terminée", IN_TRANSIT: "En transit", CANCELLED: "Annulé" };
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">Plus d’opérations</h1><p className="text-sm text-muted-foreground">Gérez les dommages, missions, contraventions et transferts quand ils se présentent.</p></div>{visibleBranches.length ? <OperationsForms branchId={ctx.membership.branchId} branches={visibleBranches} vehicles={allowedVehicles} customers={customers ?? []} contracts={allowedContracts} drivers={drivers} fines={fines ?? []} deposits={deposits ?? []} financialAccess={financialAccess} managerAccess={managerAccess}/> : <p className="rounded-md border p-4 text-sm">Aucune agence active accessible.</p>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{[["Dommages",damages], ["Sinistres",accidents], ["Contraventions",fines], ["Missions",missions], ["Transferts",transfers]].map(([title,rows])=><Card key={title as string}><CardHeader><CardTitle className="text-base">{title as string}</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{(rows as any[] ?? []).length ? (rows as any[]).map((row:any)=><div key={row.id} className="rounded-xl border border-border/70 p-3"><p className="font-medium">{statusLabel[row.status] ?? "Enregistré"}</p><p className="text-xs text-muted-foreground">{row.description ?? row.location ?? row.reference ?? row.address ?? "Donnée enregistrée"}</p>{title === "Dommages" && <><DamagePhotoForm damageId={row.id} /><DamageRepairForm damageId={row.id} status={row.status} /></>}{title === "Sinistres" && <><AccidentPhotoForm accidentId={row.id} />{managerAccess && <AccidentFollowupForm accident={row} />}</>}{title === "Missions" && !row.assigned_employee && managerAccess && <MissionAssignmentForm missionId={row.id} drivers={drivers} />}{title === "Transferts" && <TransferStatusForm transfer={row} />}</div>) : <p className="text-muted-foreground">Aucun élément.</p>}</CardContent></Card>)}</div></div>;
}
