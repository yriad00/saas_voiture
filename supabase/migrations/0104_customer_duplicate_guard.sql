-- Prevent active customer duplicates without rewriting existing records.
-- The application also gives a friendly pre-insert message; this trigger is
-- the final authority for concurrent requests and soft-deleted customers are
-- intentionally ignored.
create index if not exists customers_agency_active_id_number_idx
  on public.customers (agency_id, upper(btrim(id_number)))
  where id_number is not null and btrim(id_number) <> '' and deleted_at is null;

create index if not exists customers_agency_active_email_idx
  on public.customers (agency_id, lower(btrim(email)))
  where email is not null and btrim(email) <> '' and deleted_at is null;

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
      where c.agency_id = new.agency_id
        and c.id <> new.id
        and c.deleted_at is null
        and upper(btrim(c.id_number)) = upper(btrim(new.id_number))
    ) then
      raise exception 'customer_duplicate_id_number' using errcode = '23505';
    end if;
  end if;

  if new.deleted_at is null and new.email is not null and btrim(new.email) <> '' then
    perform pg_advisory_xact_lock(hashtextextended(new.agency_id::text || ':customer-email:' || lower(btrim(new.email)), 0));
    if exists (
      select 1 from public.customers c
      where c.agency_id = new.agency_id
        and c.id <> new.id
        and c.deleted_at is null
        and lower(btrim(c.email)) = lower(btrim(new.email))
    ) then
      raise exception 'customer_duplicate_email' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_customer_duplicates() from public, anon, authenticated;
drop trigger if exists customers_duplicate_guard on public.customers;
create trigger customers_duplicate_guard
before insert or update of agency_id, id_number, email, deleted_at on public.customers
for each row execute function private.prevent_customer_duplicates();
