-- ============================================================
-- Gestión de Reuniones con QR — DDL + RLS
-- Ejecutado via MCP supabase apply_migration
-- Fecha: 2026-05-25
-- ============================================================

CREATE TABLE public.asistencia_reuniones_config (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text    NOT NULL,
  descripcion      text,
  fecha_evento     date,
  tipo             text    DEFAULT 'general'
                   CHECK (tipo IN ('general', 'kickoff', 'cierre', 'semanal', 'especial')),
  qr_generated_at  timestamptz,
  closes_at        timestamptz,  -- calculado por trigger: qr_generated_at + 35 min
  cerrada_manual   boolean DEFAULT false,
  archivada        boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  created_by       text,
  updated_at       timestamptz DEFAULT now()
);

-- Estado derivado (no almacenado, calculado en queries y cliente):
-- 'borrador'  : qr_generated_at IS NULL AND NOT archivada
-- 'activa'    : qr_generated_at IS NOT NULL AND closes_at > now() AND NOT cerrada_manual AND NOT archivada
-- 'cerrada'   : (closes_at <= now() OR cerrada_manual) AND NOT archivada
-- 'archivada' : archivada = true

-- Trigger: calcula closes_at al setear qr_generated_at (UPDATE)
CREATE OR REPLACE FUNCTION trg_reuniones_set_closes_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.qr_generated_at IS DISTINCT FROM OLD.qr_generated_at THEN
    NEW.closes_at = NEW.qr_generated_at + interval '35 minutes';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reuniones_config_before_update
  BEFORE UPDATE ON asistencia_reuniones_config
  FOR EACH ROW EXECUTE FUNCTION trg_reuniones_set_closes_at();

-- Trigger: calcula closes_at en INSERT si qr_generated_at viene seteado
CREATE OR REPLACE FUNCTION trg_reuniones_set_closes_at_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.qr_generated_at IS NOT NULL THEN
    NEW.closes_at = NEW.qr_generated_at + interval '35 minutes';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reuniones_config_before_insert
  BEFORE INSERT ON asistencia_reuniones_config
  FOR EACH ROW EXECUTE FUNCTION trg_reuniones_set_closes_at_insert();

-- Registros de asistencia (una fila por asesor por reunión)
CREATE TABLE public.asistencia_registros (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reunion_id    uuid NOT NULL REFERENCES asistencia_reuniones_config(id) ON DELETE CASCADE,
  email         text NOT NULL,
  nombre        text,
  bp_slug       text,
  equipo_id     int,
  equipo_label  text,
  modalidad     text NOT NULL CHECK (modalidad IN ('Presencial', 'Online')),
  registrado_en timestamptz DEFAULT now(),
  UNIQUE (reunion_id, email)
);

-- Vista de conteos por equipo (sin emails, safe para anon)
CREATE OR REPLACE VIEW public.asistencia_conteo_por_equipo AS
  SELECT
    reunion_id, equipo_id, equipo_label, modalidad, count(*) AS total
  FROM asistencia_registros
  GROUP BY reunion_id, equipo_id, equipo_label, modalidad;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE asistencia_reuniones_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon lee reuniones"
  ON asistencia_reuniones_config FOR SELECT TO anon USING (true);

CREATE POLICY "admin crud reuniones"
  ON asistencia_reuniones_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE asistencia_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon inserta asistencia"
  ON asistencia_registros FOR INSERT TO anon WITH CHECK (
    EXISTS (
      SELECT 1 FROM asistencia_reuniones_config r
      WHERE r.id = reunion_id
        AND r.qr_generated_at IS NOT NULL
        AND r.closes_at > now()
        AND NOT r.cerrada_manual
    )
  );

CREATE POLICY "anon bloqueado lectura registros"
  ON asistencia_registros FOR SELECT TO anon USING (false);

CREATE POLICY "admin lee registros"
  ON asistencia_registros FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin delete registros"
  ON asistencia_registros FOR DELETE TO authenticated USING (true);

GRANT SELECT ON asistencia_conteo_por_equipo TO anon;
GRANT SELECT ON asistencia_conteo_por_equipo TO authenticated;
