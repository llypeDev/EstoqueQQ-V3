-- Tabela para auditoria de pecas escaneadas
create table if not exists public.audit_entries (
  id text primary key,
  code text not null,
  product_name text not null,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists audit_entries_scanned_at_idx
  on public.audit_entries (scanned_at desc);

-- Mantem simples e compativel com app cliente usando anon key.
alter table public.audit_entries disable row level security;
