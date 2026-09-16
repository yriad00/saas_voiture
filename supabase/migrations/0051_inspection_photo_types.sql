alter table public.contract_inspection_photos
  add column if not exists photo_type text not null default 'OTHER';

update public.contract_inspection_photos
set photo_type = 'OTHER'
where photo_type is null;

alter table public.contract_inspection_photos
  drop constraint if exists contract_inspection_photos_photo_type_check;
alter table public.contract_inspection_photos
  add constraint contract_inspection_photos_photo_type_check
  check (photo_type in ('FRONT','REAR','LEFT','RIGHT','INTERIOR','DASHBOARD','OTHER'));

create index if not exists contract_inspection_photos_type_idx
  on public.contract_inspection_photos (agency_id, contract_id, inspection_type, photo_type);
