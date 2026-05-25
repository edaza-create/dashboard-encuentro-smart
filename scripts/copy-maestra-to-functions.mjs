#!/usr/bin/env node
/** Copia maestra de asesores al bundle de la Edge Function (ejecutar tras sync:asesores). */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const destDir = join(root, 'supabase/functions/forms-asistencia')
mkdirSync(destDir, { recursive: true })
copyFileSync(
  join(root, 'src/data/asesores-bp.json'),
  join(destDir, 'asesores-bp.json')
)
console.log('[copy-maestra] OK → supabase/functions/forms-asistencia/asesores-bp.json')
