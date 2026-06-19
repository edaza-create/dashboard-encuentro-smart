/**
 * POST /functions/v1/forms-asistencia
 * Google Forms → asistencia → recálculo actividades (+15 pts equipos).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import maestraBundle from './maestra-index.json' with { type: 'json' }

const PTS_LIDER = 15

type MaestraEntry = {
  asesor_id: string
  nombre: string | null
  subgrupo: string
  equipo_id: string | null
  equipo: string | null
}

type Payload = {
  timestamp?: string
  email?: string
  nombre?: string
  modalidad?: string
  reunion?: string
}

const index = maestraBundle.index as Record<string, MaestraEntry>
const roster = maestraBundle.roster as Record<string, string[]>

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const DOMAIN_CL = '@capitalinteligente.cl'
const DOMAIN_ME = '@capitalinteligente.me'

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const t = email.trim().toLowerCase()
  return t.includes('@') ? t : null
}

function canonicalAsesorEmail(email: unknown): string | null {
  const n = normalizeEmail(email)
  if (!n) return null
  if (n.endsWith(DOMAIN_ME)) return n.slice(0, -DOMAIN_ME.length) + DOMAIN_CL
  return n
}

function parseModalidad(modalidad: unknown): 'online' | 'presencial' | null {
  const t = String(modalidad ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (!t) return null
  if (/online|virtual|remot|zoom|meet|remoto/.test(t)) return 'online'
  if (/presencial|presencia|sala|oficina|terreno/.test(t)) return 'presencial'
  return null
}

function parseTimestamp(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/)
  if (m) {
    const [, d, mo, y, h, mi, se] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se))
    if (!Number.isNaN(dt.getTime())) return dt.toISOString()
  }
  const iso = new Date(s)
  if (!Number.isNaN(iso.getTime())) return iso.toISOString()
  return null
}

function log(event: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', event, ...extra }))
}

function todayISOChile(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date())
}

function isoDateChile(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(d)
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()
  const t0 = Date.now()

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
      },
    })
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  const secret = Deno.env.get('FORMS_WEBHOOK_SECRET')
  const headerSecret = req.headers.get('X-Webhook-Secret') ?? req.headers.get('x-webhook-secret')
  if (!secret || headerSecret !== secret) {
    log('forms.unauthorized', { requestId })
    return json(401, { ok: false, error: 'unauthorized' })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }

  const email = canonicalAsesorEmail(payload.email)
  const reunion = String(payload.reunion ?? '').trim()
  const modalidad = parseModalidad(payload.modalidad)

  if (!email || !reunion || !modalidad) {
    return json(400, {
      ok: false,
      error: 'validation',
      fields: { email: !!email, reunion: !!reunion, modalidad: !!modalidad },
    })
  }

  const asesor = index[email]
  if (!asesor) {
    log('forms.asesor_not_found', { requestId, email, reunion })
    return json(404, { ok: false, error: 'asesor_not_found', email })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const row = {
    asesor_id: asesor.asesor_id,
    nombre: asesor.nombre ?? payload.nombre ?? null,
    email,
    subgrupo: asesor.subgrupo,
    equipo_id: asesor.equipo_id,
    equipo: asesor.equipo,
    modalidad,
    reunion,
    registrado_en: parseTimestamp(payload.timestamp),
    raw_payload: payload,
  }

  const { data: inserted, error: insErr } = await supabase
    .from('encuentro_asistencia_reunion')
    .insert(row)
    .select('id')
    .maybeSingle()

  const isDuplicate = insErr?.code === '23505'
  if (insErr && !isDuplicate) {
    log('forms.insert_error', { requestId, message: insErr.message })
    return json(500, { ok: false, error: 'insert_failed' })
  }
  if (isDuplicate) {
    log('forms.duplicate', { requestId, email, reunion })
  }

  const { data: asistencias, error: listErr } = await supabase
    .from('encuentro_asistencia_reunion')
    .select('email, modalidad, equipo_id')
    .eq('reunion', reunion)

  if (listErr) {
    return json(500, { ok: false, error: 'list_failed' })
  }

  const awardsGranted: { equipo_id: string; actividad_tipo: string }[] = []
  const registradoIso = row.registrado_en ?? new Date().toISOString()
  const cuentaParaPuntos = (isoDateChile(registradoIso) ?? '') >= todayISOChile()

  const equipoIds = Object.keys(roster)
  const countsByEquipo = new Map<string, { online: number; presencial: number; roster: number }>()

  for (const equipoId of equipoIds) {
    const emailsRoster = roster[equipoId] ?? []
    const rosterTotal = emailsRoster.length
    if (rosterTotal === 0) continue

    let online = 0
    let presencial = 0
    for (const a of asistencias ?? []) {
      if (String(a.equipo_id) !== equipoId) continue
      if (a.modalidad === 'online') online += 1
      if (a.modalidad === 'presencial') presencial += 1
    }
    countsByEquipo.set(equipoId, { online, presencial, roster: rosterTotal })
  }

  let maxTotal = 0
  for (const c of countsByEquipo.values()) {
    maxTotal = Math.max(maxTotal, c.online + c.presencial)
  }

  const winners =
    maxTotal > 0
      ? [...countsByEquipo.entries()]
          .filter(([, c]) => c.online + c.presencial === maxTotal)
          .map(([id]) => id)
      : []

  if (!cuentaParaPuntos) {
    log('forms.skip_awards_before_cutoff', { requestId, reunion, registradoIso })
  }

  for (const equipoId of cuentaParaPuntos ? winners : []) {
    const counts = countsByEquipo.get(equipoId)!
    const onlinePct = counts.roster > 0 ? counts.online / counts.roster : 0
    const presencialPct = counts.roster > 0 ? counts.presencial / counts.roster : 0
    const tipo = 'lider_asistencia'

    const { data: existingAward } = await supabase
      .from('encuentro_reunion_actividad_award')
      .select('id')
      .eq('reunion', reunion)
      .eq('equipo_id', equipoId)
      .eq('actividad_tipo', tipo)
      .maybeSingle()

    if (existingAward) continue

    const { data: teamRow } = await supabase
      .from('encuentro_competencia_manual')
      .select('data')
      .eq('scope', 'team')
      .maybeSingle()

    const teams =
      teamRow?.data && typeof teamRow.data === 'object' && 'teams' in teamRow.data
        ? (teamRow.data as { teams: Record<string, Record<string, number>> }).teams
        : {}

    const prev = teams[equipoId] ?? {
      promesasCount: 0,
      escriturasCount: 0,
      actividadOnlineCount: 0,
      actividadPresencialCount: 0,
    }

    const next = { ...teams }
    next[equipoId] = {
      ...prev,
      actividadOnlineCount: (prev.actividadOnlineCount || 0) + 1,
    }

    const { error: upsertErr } = await supabase.from('encuentro_competencia_manual').upsert(
      {
        scope: 'team',
        data: { version: 1, teams: next },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'scope' }
    )

    if (upsertErr) {
      log('forms.team_upsert_error', { requestId, equipoId, tipo, message: upsertErr.message })
      continue
    }

    await supabase.from('encuentro_reunion_actividad_award').insert({
      reunion,
      equipo_id: equipoId,
      actividad_tipo: tipo,
      online_pct: onlinePct,
      presencial_pct: presencialPct,
      roster_total: counts.roster,
    })

    awardsGranted.push({ equipo_id: equipoId, actividad_tipo: tipo })
    log('forms.award_granted', {
      requestId,
      reunion,
      equipoId,
      tipo,
      asistentes: counts.online + counts.presencial,
      pts: PTS_LIDER,
    })
  }

  log('forms.ok', {
    requestId,
    email,
    reunion,
    duplicate: isDuplicate,
    duration_ms: Date.now() - t0,
    awardsGranted,
  })

  return json(isDuplicate ? 200 : 201, {
    ok: true,
    id: inserted?.id ?? null,
    duplicate: isDuplicate,
    asesor,
    awardsGranted,
  })
})
