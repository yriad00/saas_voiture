"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { createPricingRule, createPromotion, type PricingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

type Option = { id: string; name: string; code?: string };
function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{label}</Button>; }
function Message({ state }: { state: PricingState }) { return <>{state.error && <p className="text-sm text-destructive">{state.error}</p>}{state.success && <p className="text-sm text-emerald-600">Enregistré.</p>}</>; }

export function PricingRuleForm({ branches, vehicles }: { branches: Option[]; vehicles: Option[] }) {
  const [state, action] = useActionState<PricingState, FormData>(createPricingRule, {});
  return <form action={action} className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="rule_name">Nom</Label><Input id="rule_name" name="name" placeholder="Tarif haute saison SUV" required /></div>
    <div className="space-y-1.5"><Label htmlFor="rule_branch">Branche</Label><Select id="rule_branch" name="branch_id" defaultValue=""><option value="">Toutes</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select></div>
    <div className="space-y-1.5"><Label htmlFor="rule_vehicle">Véhicule</Label><Select id="rule_vehicle" name="vehicle_id" defaultValue=""><option value="">Par catégorie/agence</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></div>
    <div className="space-y-1.5"><Label htmlFor="rule_category">Catégorie</Label><Input id="rule_category" name="category" placeholder="SUV" /></div>
    <div className="space-y-1.5"><Label htmlFor="rule_daily">Jour (MAD)</Label><Input id="rule_daily" name="daily_rate" type="number" min="0" step="0.01" required /></div>
    <div className="space-y-1.5"><Label htmlFor="rule_weekly">Semaine (MAD)</Label><Input id="rule_weekly" name="weekly_rate" type="number" min="0" step="0.01" required /></div>
    <div className="space-y-1.5"><Label htmlFor="rule_monthly">Mois (MAD)</Label><Input id="rule_monthly" name="monthly_rate" type="number" min="0" step="0.01" required /></div>
    <div className="space-y-1.5"><Label htmlFor="rule_min">Minimum/jour</Label><Input id="rule_min" name="minimum_daily_rate" type="number" min="0" step="0.01" required /></div>
    <div className="space-y-1.5"><Label htmlFor="rule_from">Du</Label><Input id="rule_from" name="valid_from" type="date" /></div><div className="space-y-1.5"><Label htmlFor="rule_to">Au</Label><Input id="rule_to" name="valid_to" type="date" /></div>
  </div><Message state={state} /><Submit label="Ajouter la règle" /></form>;
}

export function PromotionForm({ branches }: { branches: Option[] }) {
  const [state, action] = useActionState<PricingState, FormData>(createPromotion, {});
  return <form action={action} className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="space-y-1.5"><Label htmlFor="promo_code">Code</Label><Input id="promo_code" name="code" placeholder="RAMADAN26" required /></div><div className="space-y-1.5"><Label htmlFor="promo_name">Nom</Label><Input id="promo_name" name="name" placeholder="Promotion Ramadan" required /></div>
    <div className="space-y-1.5"><Label htmlFor="promo_branch">Branche</Label><Select id="promo_branch" name="branch_id" defaultValue=""><option value="">Toutes</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select></div>
    <div className="space-y-1.5"><Label htmlFor="promo_type">Type</Label><Select id="promo_type" name="discount_type" defaultValue="PERCENT"><option value="PERCENT">Pourcentage</option><option value="FIXED">Montant fixe</option></Select></div>
    <div className="space-y-1.5"><Label htmlFor="promo_value">Valeur</Label><Input id="promo_value" name="discount_value" type="number" min="0" step="0.01" required /></div><div className="space-y-1.5"><Label htmlFor="promo_days">Jours minimum</Label><Input id="promo_days" name="minimum_days" type="number" min="1" defaultValue="1" required /></div><div className="space-y-1.5"><Label htmlFor="promo_from">Du</Label><Input id="promo_from" name="valid_from" type="date" required /></div><div className="space-y-1.5"><Label htmlFor="promo_to">Au</Label><Input id="promo_to" name="valid_to" type="date" required /></div>
  </div><Message state={state} /><Submit label="Ajouter la promotion" /></form>;
}
