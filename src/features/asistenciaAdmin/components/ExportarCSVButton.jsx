import { Download } from 'lucide-react'
import styles from '../AsistenciaAdminPage.module.css'

/**
 * @param {{ registros: Array<{ nombre: string, email: string, bp_slug: string, equipo_label: string, modalidad: string, registrado_en: string }>, filename?: string }} props
 */
export default function ExportarCSVButton({ registros, filename = 'asistencia' }) {
  const handleExport = () => {
    const headers = ['nombre', 'email', 'bp_slug', 'equipo_label', 'modalidad', 'registrado_en']
    const rows = registros.map((r) =>
      headers.map((h) => {
        const val = String(r[h] ?? '')
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" className={styles.actionBtnMuted} onClick={handleExport} disabled={registros.length === 0}>
      <Download size={14} /> Exportar CSV
    </button>
  )
}
