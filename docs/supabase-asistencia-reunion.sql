-- Asistencia reuniones (Google Forms) + premios de actividad por equipo Capital Open.
-- Ejecutar en Supabase SQL Editor después de encuentro_competencia_manual.

-- 1) Registro crudo por respuesta del formulario
create table if not exists public.encuentro_asistencia_reunion (
  id uuid primary key default gen_random_uuid(),
  asesor_id text not null,
  nombre text,
  email text not null,
  subgrupo text,
  equipo_id text,
  equipo text,
  modalidad text not null,
  reunion text not null,
  registrado_en timestamptz,
  created_at timestamptz not null default now(),
  source text not null default 'google_forms',
  raw_payload jsonb
);

create unique index if not exists encuentro_asistencia_reunion_uniq
  on public.encuentro_asistencia_reunion (reunion, email);

create index if not exists encuentro_asistencia_reunion_reunion_idx
  on public.encuentro_asistencia_reunion (reunion);

alter table public.encuentro_asistencia_reunion enable row level security;

drop policy if exists "asistencia_select_anon" on public.encuentro_asistencia_reunion;
create policy "asistencia_select_anon"
  on public.encuentro_asistencia_reunion
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE solo vía service role (Edge Function forms-asistencia).

-- 2) Premios ya otorgados (evita +15 duplicado por misma reunión + equipo + tipo)
create table if not exists public.encuentro_reunion_actividad_award (
  id uuid primary key default gen_random_uuid(),
  reunion text not null,
  equipo_id text not null,
  actividad_tipo text not null check (actividad_tipo in ('online', 'presencial')),
  online_pct numeric,
  presencial_pct numeric,
  roster_total int,
  created_at timestamptz not null default now(),
  unique (reunion, equipo_id, actividad_tipo)
);

alter table public.encuentro_reunion_actividad_award enable row level security;

drop policy if exists "award_select_anon" on public.encuentro_reunion_actividad_award;
create policy "award_select_anon"
  on public.encuentro_reunion_actividad_award
  for select
  to anon, authenticated
  using (true);
