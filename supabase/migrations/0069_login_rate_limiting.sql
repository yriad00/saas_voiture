-- Anonymous login protection. The application passes one-way hashes of the
-- request IP and normalized email; raw identifiers are never stored.
create table if not exists public.login_rate_limit_buckets (
  bucket_key text primary key check (char_length(bucket_key) between 64 and 160),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.login_rate_limit_buckets enable row level security;
revoke all on table public.login_rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_login_rate_limit(
  p_ip_hash text,
  p_email_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if p_ip_hash is null
     or p_email_hash is null
     or char_length(p_ip_hash) < 64
     or char_length(p_email_hash) < 64
     or p_limit < 1
     or p_window_seconds < 1 then
    return false;
  end if;

  with keys(bucket_key) as (
    values ('ip:' || p_ip_hash), ('email:' || p_email_hash)
  ),
  buckets as (
    insert into public.login_rate_limit_buckets (bucket_key, window_started_at, request_count)
    select bucket_key, now(), 1 from keys
    on conflict (bucket_key) do update
      set window_started_at = case
        when public.login_rate_limit_buckets.window_started_at
          + make_interval(secs => p_window_seconds) <= now()
          then now()
        else public.login_rate_limit_buckets.window_started_at
      end,
      request_count = case
        when public.login_rate_limit_buckets.window_started_at
          + make_interval(secs => p_window_seconds) <= now()
          then 1
        else public.login_rate_limit_buckets.request_count + 1
      end
    returning request_count
  )
  select bool_and(request_count <= p_limit)
    into allowed
    from buckets;

  return coalesce(allowed, false);
end;
$$;

revoke execute on function public.consume_login_rate_limit(text, text, integer, integer)
  from public;
grant execute on function public.consume_login_rate_limit(text, text, integer, integer)
  to anon, authenticated;

create index if not exists login_rate_limit_window_idx
  on public.login_rate_limit_buckets (window_started_at);
