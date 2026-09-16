-- Prevent role-mutable search_path resolution in trigger functions.
alter function public.update_updated_at() set search_path = public;
alter function public.set_lead_updated_at() set search_path = public;
