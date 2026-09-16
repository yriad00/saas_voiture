"use client";
 /* eslint-disable @typescript-eslint/no-explicit-any */
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createDamage, createAccident, createFine, resolveFine, recordDepositTransaction, openCashSession, createMission, createTransfer } from "./actions";

type Branch = { id: string; name: string; code: string | null };
type Vehicle = { id: string; brand: string; model: string; license_plate: string };
type Customer = { id: string; first_name: string; last_name: string };
type Contract = { id: string; contract_number: string; customer_id: string; vehicle_id: string; branch_id: string | null };
type Driver = { id: string; name: string };
type Fine = { id: string; amount: number; status: string; violation_at: string; reference: string | null; vehicle_id?: string | null };
type Deposit = { id: string; contract_id: string; status: string; held_amount: number };

const DEPOSIT_STATUS_LABEL: Record<string, string> = {
  EXPECTED: "À recevoir",
  RECEIVED: "Reçue",
  HELD: "Détenue",
  PARTIALLY_DEDUCTED: "Partiellement déduite",
  PARTIALLY_REFUNDED: "Partiellement remboursée",
  REFUNDED: "Remboursée",
  CLOSED: "Clôturée",
};

function Form({ action, children }: { action: any; children: React.ReactNode }) {
  const [state, submit] = useActionState<any, FormData>(action, {});
  return <form action={submit} className="space-y-3 rounded-2xl border border-border/70 bg-card/50 p-4">{children}{state?.error && <p className="text-sm text-destructive">{state.error}</p>}{state?.success && <p className="text-sm text-emerald-600">Enregistré.</p>}</form>;
}

const Field = ({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) => <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;

function BranchField({ name, label, branches, fixedBranchId }: { name: string; label: string; branches: Branch[]; fixedBranchId?: string | null }) {
  const selected = fixedBranchId ?? branches[0]?.id ?? "";
  if (fixedBranchId || branches.length <= 1) return <input type="hidden" name={name} value={selected} readOnly />;
  return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Select id={name} name={name} defaultValue={selected} required><option value="">Sélectionner une agence</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? ` (${branch.code})` : ""}</option>)}</Select></div>;
}

function VehicleField({ vehicles, required = true }: { vehicles: Vehicle[]; required?: boolean }) {
  return <div className="space-y-1"><Label htmlFor="vehicle_id">Véhicule</Label><Select id="vehicle_id" name="vehicle_id" required={required} defaultValue=""><option value="">Sélectionner un véhicule…</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.license_plate}</option>)}</Select></div>;
}

function CustomerField({ customers, name = "customer_id" }: { customers: Customer[]; name?: string }) {
  return <div className="space-y-1"><Label htmlFor={name}>Client (optionnel)</Label><Select id={name} name={name} defaultValue=""><option value="">Non renseigné</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}</Select></div>;
}

function ContractField({ contracts, label = "Location (optionnel)" }: { contracts: Contract[]; label?: string }) {
  return <div className="space-y-1"><Label htmlFor="contract_id">{label}</Label><Select id="contract_id" name="contract_id" defaultValue=""><option value="">Recherche automatique</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.contract_number}</option>)}</Select></div>;
}

export function OperationsForms({
  branchId,
  branches,
  vehicles,
  customers,
  contracts,
  drivers,
  fines,
  deposits,
  financialAccess,
  managerAccess,
}: {
  branchId?: string | null;
  branches: Branch[];
  vehicles: Vehicle[];
  customers: Customer[];
  contracts: Contract[];
  drivers: Driver[];
  fines: Fine[];
  deposits: Deposit[];
  financialAccess: boolean;
  managerAccess: boolean;
}) {
  const idempotencyKey = useId().replace(/:/g, "");
  return <div className="grid gap-4 lg:grid-cols-2">
    <Form action={createDamage}><BranchField name="branch_id" label="Agence" branches={branches} fixedBranchId={branchId}/><VehicleField vehicles={vehicles}/><CustomerField customers={customers}/><ContractField contracts={contracts}/><Field name="body_area" label="Zone concernée" required/><Field name="damage_type" label="Type de dommage" required/><Field name="description" label="Description" required/><div className="space-y-1"><Label htmlFor="severity">Gravité</Label><Select id="severity" name="severity" defaultValue="MINOR" required><option value="MINOR">Légers</option><option value="MODERATE">Modérés</option><option value="MAJOR">Importants</option><option value="CRITICAL">Critiques</option></Select></div><Field name="estimated_repair_cost" label="Coût estimé (MAD)" type="number"/><Button>Signaler le dommage</Button></Form>
    <Form action={createAccident}><BranchField name="branch_id" label="Agence" branches={branches} fixedBranchId={branchId}/><VehicleField vehicles={vehicles}/><CustomerField customers={customers}/><ContractField contracts={contracts}/><Field name="occurred_at" label="Date et heure" type="datetime-local" required/><Field name="location" label="Lieu" required/><div><Label>Description</Label><Textarea name="description" required/></div><Field name="insurance_company" label="Assureur (optionnel)"/><Field name="police_reference" label="Référence police / constat"/><Field name="claim_reference" label="Référence assurance"/><Field name="deductible" label="Franchise (MAD)" type="number"/><Field name="estimated_repair_cost" label="Coût estimé (MAD)" type="number"/><Button>Déclarer le sinistre</Button></Form>
    <Form action={createFine}><BranchField name="branch_id" label="Agence" branches={branches} fixedBranchId={branchId}/><VehicleField vehicles={vehicles}/><Field name="violation_at" label="Date et heure" type="datetime-local" required/><Field name="amount" label="Montant (MAD)" type="number" required/><Field name="reference" label="Référence (optionnel)"/><Button>Enregistrer la contravention</Button></Form>
    {managerAccess && <Form action={resolveFine}><div className="space-y-1"><Label htmlFor="fine_id">Contravention à rattacher</Label><Select id="fine_id" name="fine_id" required defaultValue=""><option value="">Choisir une contravention…</option>{fines.filter((fine) => fine.status === "UNRESOLVED").map((fine) => <option key={fine.id} value={fine.id}>{fine.reference ?? "Sans référence"} · {new Date(fine.violation_at).toLocaleDateString("fr-MA")} · {Number(fine.amount).toLocaleString("fr-MA")} MAD</option>)}</Select></div><ContractField contracts={contracts} label="Location correspondante"/><Button>Rattacher au dossier</Button></Form>}
    {financialAccess && <><Form action={openCashSession}><BranchField name="branch_id" label="Agence" branches={branches} fixedBranchId={branchId}/><Field name="opening_balance" label="Solde d’ouverture (MAD)" type="number" required/><Button>Ouvrir la caisse</Button></Form>
      <Form action={recordDepositTransaction}><BranchField name="branch_id" label="Agence" branches={branches} fixedBranchId={branchId}/><div className="space-y-1"><Label htmlFor="deposit_id">Caution à traiter</Label><Select id="deposit_id" name="deposit_id" required defaultValue=""><option value="">Choisir une caution…</option>{deposits.map((deposit) => <option key={deposit.id} value={deposit.id}>{contracts.find((contract) => contract.id === deposit.contract_id)?.contract_number ?? "Location"} · {DEPOSIT_STATUS_LABEL[deposit.status] ?? "Caution"} · {Number(deposit.held_amount).toLocaleString("fr-MA")} MAD</option>)}</Select></div><div className="space-y-1"><Label htmlFor="transaction_type">Opération</Label><Select id="transaction_type" name="transaction_type" defaultValue="DEDUCTION"><option value="DEDUCTION">Déduire des frais</option><option value="REFUND">Rembourser le reliquat</option><option value="RECEIVED">Enregistrer la réception</option></Select></div><div className="space-y-1"><Label htmlFor="payment_method">Mode de caution</Label><Select id="payment_method" name="payment_method" defaultValue="CASH"><option value="CASH">Espèces</option><option value="CARD">Carte bancaire</option><option value="TRANSFER">Virement bancaire</option><option value="CHECK">Chèque</option></Select></div><div className="space-y-1"><Label htmlFor="cheque_status">État du chèque (si chèque)</Label><Select id="cheque_status" name="cheque_status" defaultValue=""><option value="">Non applicable</option><option value="RECEIVED">Reçu</option><option value="HELD">Détenu</option><option value="RETURNED">Retourné au client</option><option value="DEPOSITED_USED">Déposé / utilisé</option><option value="CANCELLED_PROBLEM">Annulé / problème</option></Select></div><Field name="amount" label="Montant (MAD)" type="number" required/><Field name="reason" label="Motif" required/><input type="hidden" name="idempotency_key" value={idempotencyKey} readOnly/><Button>Régler la caution</Button></Form></>}
    <Form action={createMission}><BranchField name="branch_id" label="Agence" branches={branches} fixedBranchId={branchId}/><VehicleField vehicles={vehicles} required={false}/><CustomerField customers={customers}/><ContractField contracts={contracts}/><div className="space-y-1"><Label htmlFor="mission_type">Type de mission</Label><Select id="mission_type" name="mission_type" defaultValue="DELIVERY" required><option value="DELIVERY">Livraison</option><option value="COLLECTION">Collecte</option><option value="AIRPORT_DELIVERY">Livraison aéroport</option><option value="HOTEL_DELIVERY">Livraison hôtel</option><option value="CUSTOMER_ADDRESS">Adresse client</option><option value="GARAGE">Garage</option><option value="OTHER">Autre</option></Select></div><Field name="scheduled_at" label="Date et heure" type="datetime-local" required/><Field name="address" label="Adresse"/><div className="space-y-1"><Label htmlFor="assigned_employee">Chauffeur</Label><Select id="assigned_employee" name="assigned_employee" defaultValue=""><option value="">À affecter plus tard</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</Select></div><Field name="fee" label="Frais (MAD)" type="number"/><Button>Planifier la mission</Button></Form>
    <Form action={createTransfer}><VehicleField vehicles={vehicles}/><BranchField name="from_branch_id" label="Agence de départ" branches={branches} fixedBranchId={branchId}/><BranchField name="to_branch_id" label="Agence d’arrivée" branches={branches}/><Field name="planned_departure" label="Départ prévu" type="datetime-local" required/><Field name="cost" label="Coût (MAD)" type="number"/><Button>Planifier le transfert</Button></Form>
  </div>;
}

