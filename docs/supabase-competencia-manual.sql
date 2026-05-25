-- Puntos manuales de competencia Capital Open (promesas, escrituras, actividades).
-- La página pública /cyber lee con anon; solo admins autenticados escriben.

create table if not exists public.encuentro_competencia_manual (
  scope text primary key check (scope in ('individual', 'team')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.encuentro_competencia_manual enable row level security;

-- Lectura pública (ranking /cyber)
drop policy if exists "competencia_manual_select_anon" on public.encuentro_competencia_manual;
create policy "competencia_manual_select_anon"
  on public.encuentro_competencia_manual
  for select
  to anon, authenticated
  using (true);

-- Escritura solo usuarios autenticados (restringir correos en app con VITE_ADMIN_EMAILS)
drop policy if exists "competencia_manual_upsert_auth" on public.encuentro_competencia_manual;
create policy "competencia_manual_upsert_auth"
  on public.encuentro_competencia_manual
  for insert
  to authenticated
  with check (true);

drop policy if exists "competencia_manual_update_auth" on public.encuentro_competencia_manual;
create policy "competencia_manual_update_auth"
  on public.encuentro_competencia_manual
  for update
  to authenticated
  using (true)
  with check (true);
