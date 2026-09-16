-- Service-role cleanup is used only by controlled staging fixture teardown;
-- authenticated users still receive immutable deposit transaction history.
create or replace function private.prevent_deposit_transaction_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return coalesce(new, old);
  end if;
  raise exception 'deposit_transaction_immutable' using errcode = '42501';
end;
$$;
