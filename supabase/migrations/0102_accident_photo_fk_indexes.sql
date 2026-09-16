-- Cover the three foreign keys on private accident media. These indexes are
-- additive and do not change row visibility or application behaviour.
create index if not exists accident_photos_accident_id_idx
  on public.accident_photos (accident_id);

create index if not exists accident_photos_branch_id_idx
  on public.accident_photos (branch_id);

create index if not exists accident_photos_created_by_idx
  on public.accident_photos (created_by);
