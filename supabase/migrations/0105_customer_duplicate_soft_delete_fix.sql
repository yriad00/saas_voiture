-- Soft-deleting a customer must remain possible even if legacy duplicate data
-- exists. Active records are still protected by the guard from 0104.
create or replace function private.prevent_customer_duplicates()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.deleted_at is null and new.id_number is not null and btrim(new.id_number) <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text || ':customer-id:' || upper(btrim(new.id_number)), 0));
    if exists (
      select 1 from public.customers c
      where c.agency_id = new.agency_id and c.id <> new.id and c.deleted_at is null
        and upper(btrim(c.id_number)) = upper(btrim(new.id_number))
    ) then
      raise exception 'customer_duplicate_id_number' using errcode = '23505';
    end if;
  end if;
  if new.deleted_at is null and new.email is not null and btrim(new.email) <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text || ':customer-email:' || lower(btrim(new.email)), 0));
    if exists (
      select 1 from public.customers c
      where c.agency_id = new.agency_id and c.id <> new.id and c.deleted_at is null
        and lower(btrim(c.email)) = lower(btrim(new.email))
    ) then
      raise exception 'customer_duplicate_email' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_customer_duplicates() from public, anon, authenticated;
