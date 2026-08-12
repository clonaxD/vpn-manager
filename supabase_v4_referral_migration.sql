-- VPN MANAGER k1t0 v4 — REFERRAL
-- Выполнить ОДИН РАЗ в Supabase -> SQL Editor

alter table public.clients
add column if not exists referrer_id bigint null;

-- Внешний ключ на клиента, который пригласил.
-- ON DELETE SET NULL: если пригласившего когда-нибудь удалить вручную,
-- приглашённый клиент останется в базе.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_referrer_id_fkey'
  ) then
    alter table public.clients
    add constraint clients_referrer_id_fkey
    foreign key (referrer_id)
    references public.clients(id)
    on delete set null;
  end if;
end $$;

create index if not exists clients_referrer_id_idx on public.clients(referrer_id);
