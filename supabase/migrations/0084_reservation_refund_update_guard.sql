-- A refund cannot bypass validation by attaching a reservation after insert.
drop trigger if exists payments_validate_refund on public.payments;
create trigger payments_validate_refund
  before insert or update of amount, contract_id, reservation_id, agency_id, type, status
  on public.payments
  for each row execute function public.validate_payment_refund();
