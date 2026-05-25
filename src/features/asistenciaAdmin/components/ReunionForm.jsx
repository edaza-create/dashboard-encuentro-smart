import { useState } from 'react'
import { X } from 'lucide-react'
import styles from '../AsistenciaAdminPage.module.css'

const TIPOS = ['general', 'kickoff', 'cierre', 'semanal', 'especial']
const TIPO_LABEL = { general: 'General', kickoff: 'Kick-off', cierre: 'Cierre', semanal: 'Semanal', especial: 'Especial' }

export default function ReunionForm({ reunion, onSave, onCancel, saving }) {
  const isEdit = Boolean(reunion)
  const isActiva = reunion?.estado === 'activa'

  const [nombre, setNombre] = useState(reunion?.nombre ?? '')
  const [tipo, setTipo] = useState(reunion?.tipo ?? 'general')
  const [fechaEvento, setFechaEvento] = useState(reunion?.fecha_evento ?? '')
  const [descripcion, setDescripcion] = useState(reunion?.descripcion ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    const fields = { nombre: nombre.trim() }
    if (!isActiva) {
      fields.tipo = tipo
      fields.fecha_evento = fechaEvento || null
      fields.descripcion = descripcion.trim() || null
    }
    onSave(fields, reunion?.id)
  }

  const valid = nombre.trim().length >= 3 && nombre.trim().length <= 60

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEdit ? 'Editar reunión' : 'Nueva reunión'}</h2>
          <button type="button" className={styles.modalClose} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <form className={styles.modalBody} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Nombre *</span>
            <input
              className={styles.fieldInput}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              placeholder="Kick-off Norte Verde"
              autoFocus
            />
            <span className={styles.fieldHint}>{nombre.length}/60 — aparece en el formulario del asesor</span>
          </label>

          <fieldset className={styles.field} disabled={isActiva}>
            <span className={styles.fieldLabel}>Tipo de reunión</span>
            <div className={styles.radioGroup}>
              {TIPOS.map((t) => (
                <label key={t} className={styles.radio}>
                  <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
                  {TIPO_LABEL[t]}
                </label>
              ))}
            </div>
            {isActiva && <span className={styles.fieldHint}>No editable mientras la reunión está activa</span>}
          </fieldset>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Fecha del evento</span>
            <input
              className={styles.fieldInput}
              type="date"
              value={fechaEvento}
              onChange={(e) => setFechaEvento(e.target.value)}
              disabled={isActiva}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Descripción (opcional)</span>
            <textarea
              className={styles.fieldTextarea}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Reunión de apertura del período junio…"
              disabled={isActiva}
            />
            <span className={styles.fieldHint}>{descripcion.length}/200</span>
          </label>

          {!isEdit && (
            <p className={styles.formHint}>
              El QR se genera en un paso separado. Esta reunión quedará en estado BORRADOR.
            </p>
          )}

          <div className={styles.modalFooter}>
            <button type="button" className={styles.actionBtnMuted} onClick={onCancel}>Cancelar</button>
            <button type="submit" className={styles.actionBtn} disabled={!valid || saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear reunión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
