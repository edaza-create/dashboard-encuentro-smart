/**
 * GET /functions/v1/reservas-privado?desde=<ISO>&hasta=<ISO>
 *
 * Proxy autenticado al endpoint privado de ranking de ORED, que ademas de las
 * reservas entrega datos de contacto del cliente (nombre, correo, RUT, telefono).
 *
 * Por que existe:
 *  - El endpoint privado de ORED no tiene CORS y es maquina-a-maquina a proposito.
 *    Llamarlo desde el navegador expondria la API key en las DevTools.
 *  - La respuesta lleva PII, asi que este proxy NO puede ser publico: exige sesion
 *    de Supabase Y que el correo este en la lista de administradores.
 *
 * Diferencia con `reservas-atlas`: aquella es publica y descarta los datos de
 * cliente; esta los entrega, pero solo a administradores autenticados.
 *
 * Secretos requeridos (Supabase → Edge Functions → Secrets):
 *   ORED_API_KEY    key del endpoint privado de ORED
 *   ADMIN_EMAILS    correos autorizados, separados por coma
 *
 * `verify_jwt = true` en config.toml: Supabase valida el JWT antes de invocar.
 * Aca ademas se resuelve el usuario y se compara su correo con ADMIN_EMAILS.
 *
 * Ver docs/DEPLOY-reservas-privado.md
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const ORED_BASE = 'https://ored.cl/api/encuentro-smart/ranking-privado'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // La respuesta lleva PII: no debe quedar en caches intermedias.
      'Cache-Control': 'no-store',
      ...CORS,
      ...extra,
    },
  })
}

function parseAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set()
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  )
}

/** Resuelve el correo del usuario a partir del JWT de la peticion. */
async function emailDeLaSesion(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return null

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user?.email) return null
  return data.user.email.trim().toLowerCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return json(405, { error: 'Metodo no permitido' })

  const oredKey = Deno.env.get('ORED_API_KEY')
  if (!oredKey) {
    return json(500, { error: 'ORED_API_KEY no configurado en los secretos de la funcion' })
  }

  // 1. Sesion valida
  const email = await emailDeLaSesion(req)
  if (!email) return json(401, { error: 'Se requiere sesion iniciada' })

  // 2. Correo autorizado
  const admins = parseAdminEmails(Deno.env.get('ADMIN_EMAILS'))
  if (admins.size === 0) {
    return json(500, { error: 'ADMIN_EMAILS no configurado: nadie tiene acceso' })
  }
  if (!admins.has(email)) {
    return json(403, { error: 'Tu cuenta no tiene acceso a datos de cliente' })
  }

  // 3. Parametros
  const url = new URL(req.url)
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  if (!desde || !hasta) {
    return json(400, { error: 'Faltan los parametros desde y hasta (ISO 8601)' })
  }
  if (Number.isNaN(Date.parse(desde)) || Number.isNaN(Date.parse(hasta))) {
    return json(400, { error: 'desde y hasta deben ser ISO 8601 con offset' })
  }
  if (Date.parse(desde) > Date.parse(hasta)) {
    return json(400, { error: 'desde debe ser menor o igual que hasta' })
  }

  const params = new URLSearchParams({ desde, hasta })
  const limit = url.searchParams.get('limit')
  if (limit) params.set('limit', limit)

  // 4. Llamada server-to-server a ORED
  try {
    const res = await fetch(`${ORED_BASE}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${oredKey}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      // Nunca propagar el detalle de un 401: podria filtrar informacion de la key.
      if (res.status === 401) {
        return json(502, { error: 'ORED rechazo la credencial del proxy' })
      }
      const detalle = await res.text().catch(() => '')
      return json(502, { error: `ORED ${res.status}: ${detalle.slice(0, 200)}` })
    }

    const body = await res.json()
    return json(200, {
      ...body,
      origen: 'ored-privado',
      solicitado_por: email,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json(502, { error: `Fallo consultando ORED: ${msg}` })
  }
})
