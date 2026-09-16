-- 0067 security parity: restore baseline RLS that was present in production
-- Idempotent so it can be applied to a project that already has the policies.
ALTER TABLE public."accident_damages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."active_rental_updates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agency_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."agency_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cash_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cash_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_checkouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_extras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_inspection_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_inspections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contract_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."customer_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."customer_risk_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."damage_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."damage_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."delivery_missions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deposit_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deposits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."extras_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."fines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."maintenance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pricing_override_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."pricing_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."promotions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rental_extensions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."rental_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reservation_extras" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."return_charge_override_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."return_charges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicle_blocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicle_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicle_owner_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicle_preparations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicle_swaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicle_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."vehicles" ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agencies' AND policyname = 'agencies_select') THEN
    CREATE POLICY "agencies_select" ON public."agencies" AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin() OR (id IN ( SELECT get_user_agency_ids() AS get_user_agency_ids))));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agencies' AND policyname = 'agencies_write') THEN
    CREATE POLICY "agencies_write" ON public."agencies" AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agency_members' AND policyname = 'members_delete') THEN
    CREATE POLICY "members_delete" ON public."agency_members" AS PERMISSIVE FOR DELETE TO public USING ((is_super_admin() OR user_has_permission(agency_id, 'users.disable'::text)));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agency_settings' AND policyname = 'agency_settings_insert') THEN
    CREATE POLICY "agency_settings_insert" ON public."agency_settings" AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agency_settings' AND policyname = 'agency_settings_select') THEN
    CREATE POLICY "agency_settings_select" ON public."agency_settings" AS PERMISSIVE FOR SELECT TO public USING (is_agency_member(agency_id));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agency_settings' AND policyname = 'agency_settings_update') THEN
    CREATE POLICY "agency_settings_update" ON public."agency_settings" AS PERMISSIVE FOR UPDATE TO public USING ((is_super_admin() OR user_has_permission(agency_id, 'settings.update'::text))) WITH CHECK ((is_super_admin() OR user_has_permission(agency_id, 'settings.update'::text)));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contracts' AND policyname = 'sa_all') THEN
    CREATE POLICY "sa_all" ON public."contracts" AS PERMISSIVE FOR ALL TO public USING (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'member_delete') THEN
    CREATE POLICY "member_delete" ON public."customers" AS PERMISSIVE FOR DELETE TO public USING ((is_agency_member(agency_id) AND user_has_permission(agency_id, 'customers:write'::text)));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'member_select') THEN
    CREATE POLICY "member_select" ON public."customers" AS PERMISSIVE FOR SELECT TO public USING (is_agency_member(agency_id));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'sa_all') THEN
    CREATE POLICY "sa_all" ON public."customers" AS PERMISSIVE FOR ALL TO public USING (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'maintenance_records' AND policyname = 'sa_all') THEN
    CREATE POLICY "sa_all" ON public."maintenance_records" AS PERMISSIVE FOR ALL TO public USING (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'sa_all') THEN
    CREATE POLICY "sa_all" ON public."payments" AS PERMISSIVE FOR ALL TO public USING (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permissions' AND policyname = 'perms_select') THEN
    CREATE POLICY "perms_select" ON public."permissions" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permissions' AND policyname = 'perms_write') THEN
    CREATE POLICY "perms_write" ON public."permissions" AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plans' AND policyname = 'plans_select') THEN
    CREATE POLICY "plans_select" ON public."plans" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'plans' AND policyname = 'plans_write') THEN
    CREATE POLICY "plans_write" ON public."plans" AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete') THEN
    CREATE POLICY "profiles_delete" ON public."profiles" AS PERMISSIVE FOR DELETE TO public USING (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert') THEN
    CREATE POLICY "profiles_insert" ON public."profiles" AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select') THEN
    CREATE POLICY "profiles_select" ON public."profiles" AS PERMISSIVE FOR SELECT TO public USING (((id = auth.uid()) OR is_super_admin() OR shares_agency_with(id)));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update') THEN
    CREATE POLICY "profiles_update" ON public."profiles" AS PERMISSIVE FOR UPDATE TO public USING (((id = auth.uid()) OR is_super_admin())) WITH CHECK (((id = auth.uid()) OR is_super_admin()));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reservations' AND policyname = 'sa_all') THEN
    CREATE POLICY "sa_all" ON public."reservations" AS PERMISSIVE FOR ALL TO public USING (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'rp_select') THEN
    CREATE POLICY "rp_select" ON public."role_permissions" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'role_permissions' AND policyname = 'rp_write') THEN
    CREATE POLICY "rp_write" ON public."role_permissions" AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'roles_select') THEN
    CREATE POLICY "roles_select" ON public."roles" AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'roles' AND policyname = 'roles_write') THEN
    CREATE POLICY "roles_write" ON public."roles" AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subs_select') THEN
    CREATE POLICY "subs_select" ON public."subscriptions" AS PERMISSIVE FOR SELECT TO public USING ((is_super_admin() OR (agency_id IN ( SELECT get_user_agency_ids() AS get_user_agency_ids))));
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'subs_write') THEN
    CREATE POLICY "subs_write" ON public."subscriptions" AS PERMISSIVE FOR ALL TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
  END IF;
END
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'super_admin_all') THEN
    CREATE POLICY "super_admin_all" ON public."vehicles" AS PERMISSIVE FOR ALL TO public USING (is_super_admin());
  END IF;
END
$policy$;
