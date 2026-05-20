#!/usr/bin/env node
/**
 * Prueba local del webhook forms-asistencia (Supabase Edge Function).
 *
 * Uso:
 *   set WEBHOOK_URL=https://xxx.supabase.co/functions/v1/forms-asistencia
 *   set WEBHOOK_SECRET=tu-secreto
 *   node scripts/test-forms-asistencia.mjs
 */
const url = process.env.WEBHOOK_URL
const secret = process.env.WEBHOOK_SECRET

if (!url || !secret) {
  console.error('Faltan WEBHOOK_URL y WEBHOOK_SECRET en el entorno.')
  process.exit(1)
}

const payload = {
  timestamp: new Date().toLocaleString('es-CL'),
  email: process.argv[2] || 'klettich@capitalinteligente.cl',
  nombre: 'Prueba QA',
  modalidad: process.argv[3] || 'Online',
  reunion: process.argv[4] || `QA ${Date.now()}`,
}

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': secret,
  },
  body: JSON.stringify(payload),
})

const text = await res.text()
console.log('HTTP', res.status)
console.log(text)

if (!res.ok) process.exit(1)
