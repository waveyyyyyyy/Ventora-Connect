-- Store member-submitted crypto payment details for manual administrator verification.
alter table public.subscription_requests
 add column if not exists payment_method text,
 add column if not exists payment_coin text,
 add column if not exists payment_network text,
 add column if not exists payment_amount numeric(30,12),
 add column if not exists payment_address text,
 add column if not exists payment_tx_hash text,
 add column if not exists payment_inr_amount numeric(12,2),
 add column if not exists exchange_rate_inr numeric(24,8);
alter table public.subscription_requests
 drop constraint if exists subscription_requests_payment_method_check;
alter table public.subscription_requests
 add constraint subscription_requests_payment_method_check
 check(payment_method is null or payment_method in ('crypto'));
create unique index if not exists subscription_requests_payment_tx_hash_uidx
 on public.subscription_requests(payment_tx_hash)
 where payment_tx_hash is not null and length(trim(payment_tx_hash))>0;
