-- Small, tenant-safe rate limiter for authenticated mutations.
-- The bucket owner is always auth.uid(); callers cannot choose another user.
create table if not exists public.rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (char_length(scope) between 2 and 80),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, scope)
);

alter table public.rate_limit_buckets enable row level security;

drop policy if exists rate_limit_buckets_select on public.rate_limit_buckets;
create policy rate_limit_buckets_select on public.rate_limit_buckets
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists rate_limit_buckets_insert on public.rate_limit_buckets;
create policy rate_limit_buckets_insert on public.rate_limit_buckets
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists rate_limit_buckets_update on public.rate_limit_buckets;
create policy rate_limit_buckets_update on public.rate_limit_buckets
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.consume_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  allowed boolean;
begin
  if auth.uid() is null or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  with bucket as (
    insert into public.rate_limit_buckets (user_id, scope, window_started_at, request_count)
    values (auth.uid(), p_scope, now(), 1)
    on conflict (user_id, scope) do update
      set window_started_at = case
        when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now()
          then now()
        else public.rate_limit_buckets.window_started_at
      end,
      request_count = case
        when public.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= now()
          then 1
        else public.rate_limit_buckets.request_count + 1
      end
    returning request_count
  )
  select request_count <= p_limit into allowed from bucket;

  return coalesce(allowed, false);
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

create index if not exists rate_limit_buckets_window_idx
  on public.rate_limit_buckets (window_started_at);
