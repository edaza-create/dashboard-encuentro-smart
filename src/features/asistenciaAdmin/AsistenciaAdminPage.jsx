import { useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { useReunionesAdmin } from '../../hooks/useReunionesAdmin.js'
import { createReunion, updateReunion, generateQR, closeReunion, archiveReunion, unarchiveReunion, deleteReunion } from '../../api/reunionesAdmin.js'
import ReunionCard from './components/ReunionCard.jsx'
import ReunionForm from './components/ReunionForm.jsx'
import QRGenerarConfirm from './components/QRGenerarConfirm.jsx'
import QRActivoPanel from './components/QRActivoPanel.jsx'
import ReunionEnVivoPanel from './components/ReunionEnVivoPanel.jsx'
import ReunionReporte from './components/ReunionReporte.jsx'
import styles from './AsistenciaAdminPage.module.css'

export default function AsistenciaAdminPage() {
  const { reuniones, loading, error, refetch } = useReunionesAdmin()
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [qrConfirmTarget, setQrConfirmTarget] = useState(null)
  const [qrViewTarget, setQrViewTarget] = useState(null)
  const [liveViewTarget, setLiveViewTarget] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showArchivadas, setShowArchivadas] = useState(false)

  const sections = useMemo(() => {
    const activas = reuniones.filter((r) => r.estado === 'activa')
    const borradores = reuniones.filter((r) => r.estado === 'borrador')
    const cerradas = reuniones.filter((r) => r.estado === 'cerrada').slice(0, 10)
    const archivadas = reuniones.filter((r) => r.estado === 'archivada')
    return { activas, borradores, cerradas, archivadas }
  }, [reuniones])

  const handleSave = async (fields, id) => {
    setSaving(true)
    const res = id
      ? await updateReunion(id, fields)
      : await createReunion(fields)
    setSaving(false)
    if (res.ok) {
      setShowForm(false)
      setEditTarget(null)
      refetch()
    } else {
      alert(res.reason)
    }
  }

  const handleGenerateQR = async (reunion) => {
    setSaving(true)
    const res = await generateQR(reunion.id)
    setSaving(false)
    if (res.ok) {
      setQrConfirmTarget(null)
      refetch()
      setQrViewTarget(res.reunion)
    } else {
      alert(res.reason)
    }
  }

  const handleClose = async (reunion) => {
    if (!confirm(`¿Cerrar "${reunion.nombre}"? No se aceptarán más registros.`)) return
    await closeReunion(reunion.id)
    refetch()
  }

  const handleArchive = async (reunion) => {
    await archiveReunion(reunion.id)
    refetch()
  }

  const handleUnarchive = async (reunion) => {
    await unarchiveReunion(reunion.id)
    refetch()
  }

  const handleDelete = async (reunion) => {
    if (!confirm(`¿Eliminar "${reunion.nombre}"? Esta acción no se puede deshacer.`)) return
    const res = await deleteReunion(reunion.id)
    if (!res.ok) alert(res.reason)
    refetch()
  }

  const handleReopen = async (reunion) => {
    if (!confirm(`¿Reabrir "${reunion.nombre}"? Se generará un nuevo período de 35 minutos.`)) return
    setSaving(true)
    const res = await generateQR(reunion.id)
    setSaving(false)
    if (res.ok) {
      refetch()
      setQrViewTarget(res.reunion)
    } else {
      alert(res.reason)
    }
  }

  const handleEdit = (reunion) => {
    setEditTarget(reunion)
    setShowForm(true)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Asistencia Reuniones</h1>
          <p className={styles.pageLede}>Gestiona reuniones, genera QR y monitorea asistencia en tiempo real.</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => { setEditTarget(null); setShowForm(true) }}>
          <Plus size={16} /> Nueva reunión
        </button>
      </div>

      {error && <p className={styles.errorBanner}>{error}</p>}

      {loading ? (
        <p className={styles.loadingText}>Cargando reuniones...</p>
      ) : (
        <>
          {sections.activas.length > 0 && (
            <Section title="Activas" count={sections.activas.length} defaultOpen>
              {sections.activas.map((r) => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  onGenerateQR={() => {}}
                  onClose={handleClose}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onViewQR={() => setQrViewTarget(r)}
                  onViewLive={() => setLiveViewTarget(r)}
                  onViewReport={() => setReportTarget(r)}
                  onReopen={handleReopen}
                />
              ))}
            </Section>
          )}

          {sections.borradores.length > 0 && (
            <Section title="Borrador" count={sections.borradores.length} defaultOpen>
              {sections.borradores.map((r) => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  onGenerateQR={(reu) => setQrConfirmTarget(reu)}
                  onClose={handleClose}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onViewQR={() => setQrViewTarget(r)}
                  onViewLive={() => setLiveViewTarget(r)}
                  onViewReport={() => setReportTarget(r)}
                  onReopen={handleReopen}
                />
              ))}
            </Section>
          )}

          {sections.cerradas.length > 0 && (
            <Section title="Cerradas" count={sections.cerradas.length} defaultOpen={false}>
              {sections.cerradas.map((r) => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  onGenerateQR={() => {}}
                  onClose={handleClose}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onViewQR={() => setQrViewTarget(r)}
                  onViewLive={() => setLiveViewTarget(r)}
                  onViewReport={() => setReportTarget(r)}
                  onReopen={handleReopen}
                />
              ))}
            </Section>
          )}

          {sections.archivadas.length > 0 && (
            <Section title="Archivadas" count={sections.archivadas.length} defaultOpen={false}>
              {sections.archivadas.map((r) => (
                <ReunionCard
                  key={r.id}
                  reunion={r}
                  onGenerateQR={() => {}}
                  onClose={() => {}}
                  onArchive={() => {}}
                  onUnarchive={handleUnarchive}
                  onDelete={() => {}}
                  onEdit={() => {}}
                  onViewQR={() => {}}
                  onViewLive={() => {}}
                  onViewReport={() => setReportTarget(r)}
                  onReopen={() => {}}
                />
              ))}
            </Section>
          )}

          {reuniones.length === 0 && !loading && (
            <div className={styles.emptyState}>
              <p>No hay reuniones creadas.</p>
              <button type="button" className={styles.primaryBtn} onClick={() => { setEditTarget(null); setShowForm(true) }}>
                <Plus size={16} /> Crear primera reunión
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <ReunionForm
          reunion={editTarget}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
          saving={saving}
        />
      )}

      {qrConfirmTarget && (
        <QRGenerarConfirm
          reunion={qrConfirmTarget}
          onConfirm={handleGenerateQR}
          onCancel={() => setQrConfirmTarget(null)}
          saving={saving}
        />
      )}

      {qrViewTarget && (
        <QRActivoPanel
          reunion={qrViewTarget}
          onClose={() => setQrViewTarget(null)}
          onCloseReunion={(r) => { handleClose(r); setQrViewTarget(null) }}
        />
      )}

      {liveViewTarget && (
        <ReunionEnVivoPanel
          reunion={liveViewTarget}
          onClose={() => setLiveViewTarget(null)}
        />
      )}

      {reportTarget && (
        <ReunionReporte
          reunion={reportTarget}
          onClose={() => setReportTarget(null)}
          onReopen={(r) => { handleReopen(r); setReportTarget(null) }}
          onArchive={(r) => { handleArchive(r); setReportTarget(null) }}
        />
      )}
    </div>
  )
}

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.section}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen((o) => !o)}>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.sectionCount}>{count}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  )
}
