-- Restore the logical relationships that the app and PostgREST use for
-- embedded reads. NOT VALID keeps existing legacy rows deployable while
-- enforcing every new or updated reference.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reservations_customer_id_fkey') then
    alter table public.reservations add constraint reservations_customer_id_fkey foreign key (customer_id) references public.customers(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_vehicle_id_fkey') then
    alter table public.reservations add constraint reservations_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_pickup_branch_id_fkey') then
    alter table public.reservations add constraint reservations_pickup_branch_id_fkey foreign key (pickup_branch_id) references public.branches(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reservations_return_branch_id_fkey') then
    alter table public.reservations add constraint reservations_return_branch_id_fkey foreign key (return_branch_id) references public.branches(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_reservation_id_fkey') then
    alter table public.contracts add constraint contracts_reservation_id_fkey foreign key (reservation_id) references public.reservations(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_customer_id_fkey') then
    alter table public.contracts add constraint contracts_customer_id_fkey foreign key (customer_id) references public.customers(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_vehicle_id_fkey') then
    alter table public.contracts add constraint contracts_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_pickup_branch_id_fkey') then
    alter table public.contracts add constraint contracts_pickup_branch_id_fkey foreign key (pickup_branch_id) references public.branches(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_return_branch_id_fkey') then
    alter table public.contracts add constraint contracts_return_branch_id_fkey foreign key (return_branch_id) references public.branches(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_payer_customer_id_fkey') then
    alter table public.contracts add constraint contracts_payer_customer_id_fkey foreign key (payer_customer_id) references public.customers(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contracts_principal_driver_customer_id_fkey') then
    alter table public.contracts add constraint contracts_principal_driver_customer_id_fkey foreign key (principal_driver_customer_id) references public.customers(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_contract_id_fkey') then
    alter table public.payments add constraint payments_contract_id_fkey foreign key (contract_id) references public.contracts(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_customer_id_fkey') then
    alter table public.payments add constraint payments_customer_id_fkey foreign key (customer_id) references public.customers(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_reservation_id_fkey') then
    alter table public.payments add constraint payments_reservation_id_fkey foreign key (reservation_id) references public.reservations(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_vehicle_id_fkey') then
    alter table public.expenses add constraint expenses_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_contract_id_fkey') then
    alter table public.invoices add constraint invoices_contract_id_fkey foreign key (contract_id) references public.contracts(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agency_members_profile_id_fkey') then
    alter table public.agency_members add constraint agency_members_profile_id_fkey foreign key (profile_id) references public.profiles(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'agency_members_role_id_fkey') then
    alter table public.agency_members add constraint agency_members_role_id_fkey foreign key (role_id) references public.roles(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_permissions_role_id_fkey') then
    alter table public.role_permissions add constraint role_permissions_role_id_fkey foreign key (role_id) references public.roles(id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_permissions_permission_id_fkey') then
    alter table public.role_permissions add constraint role_permissions_permission_id_fkey foreign key (permission_id) references public.permissions(id) not valid;
  end if;
end $$;

create index if not exists reservations_customer_fk_idx on public.reservations(customer_id);
create index if not exists reservations_vehicle_fk_idx on public.reservations(vehicle_id);
create index if not exists contracts_customer_fk_idx on public.contracts(customer_id);
create index if not exists contracts_vehicle_fk_idx on public.contracts(vehicle_id);
create index if not exists contracts_reservation_fk_idx on public.contracts(reservation_id);
create index if not exists payments_contract_fk_idx on public.payments(contract_id);
create index if not exists payments_customer_fk_idx on public.payments(customer_id);
create index if not exists payments_reservation_fk_idx on public.payments(reservation_id);
create index if not exists invoices_contract_fk_idx on public.invoices(contract_id);
create index if not exists agency_members_profile_fk_idx on public.agency_members(profile_id);
create index if not exists role_permissions_role_fk_idx on public.role_permissions(role_id);
create index if not exists role_permissions_permission_fk_idx on public.role_permissions(permission_id);
