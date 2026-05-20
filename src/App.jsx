import { useState, useMemo, useCallback } from 'react'
import styles from './App.module.css'
import AppSidebar from './components/layout/AppSidebar'
import MainHeader from './components/layout/MainHeader'
import CapitalOpenHero from './components/CapitalOpenHero'
import ResumenPage from './features/resumen/ResumenPage.jsx'
import DateRangeFilter from './components/DateRangeFilter'
import Filters from './components/Filters'
import CompetenciaCapitalOneTab from './components/CompetenciaCapitalOneTab'
import CompetenciaCapitalOpenIndividualTab from './components/CompetenciaCapitalOpenIndividualTab'
import AsistenciaPage from './features/asistencia/AsistenciaPage.jsx'
import RankingsTab from './components/RankingsTab'
import ReservasTable from './components/ReservasTable'
import { capitalOpenConfig } from './config/capitalOpen'
import { useCompetenciaManualRemoteSync } from './hooks/useCompetenciaManualRemoteSync.js'
import { useReservas } from './hooks/useReservas'
import { filtrarReservasPorFecha } from './utils/reservaFecha'
import { isReservaEquipoComercialInterno } from './utils/equipoComercialInterno'

export default function App() {
  useCompetenciaManualRemoteSync()
  const { reservas, loading, error, lastUpdated, refetch, isLive, dataSource } = useReservas()
  const [tab, setTab] = useState('Resumen')
  const [filters, setFilters] = useState({
    search: '',
    estado: '',
    proyecto: '',
    tipologia: '',
    tipo_entrega: '',
    equipoInterno: '',
    fechaDesde: capitalOpenConfig.cyberDesde,
    fechaHasta: capitalOpenConfig.cyberHasta,
  })

  const reservasEnRango = useMemo(
    () => filtrarReservasPorFecha(reservas, filters.fechaDesde, filters.fechaHasta),
    [reservas, filters.fechaDesde, filters.fechaHasta]
  )

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase()
    return reservasEnRango.filter((r) => {
      if (filters.estado && r.estado !== filters.estado) return false
      if (filters.proyecto && r.proyecto !== filters.proyecto) return false
      if (filters.tipologia && r.tipologia !== filters.tipologia) return false
      if (filters.tipo_entrega && r.tipo_entrega !== filters.tipo_entrega) return false
      if (filters.equipoInterno === '__equipo_interno__') {
        if (!isReservaEquipoComercialInterno(r)) return false
      } else if (filters.equipoInterno) {
        if (r.miembro_equipo_interno_id !== filters.equipoInterno) return false
      }
      if (q) {
        const haystack = [
          r.nombre_cliente,
          r.user_email,
          r.proyecto,
          r.cliente_rut,
          r.nivel_jerarquia_nombre,
          r.nombre_asesor,
          r.miembro_equipo_interno,
          r.unidad,
          r.tipologia,
          r.comuna,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [reservasEnRango, filters])

  const logoTag = capitalOpenConfig.logoAbrev?.trim() || 'ES'

  const handleResumenDrillDown = useCallback(({ type, value }) => {
    setTab('Reservas')
    setFilters((f) => {
      const base = {
        ...f,
        estado: '',
        proyecto: '',
        tipologia: '',
        tipo_entrega: '',
        equipoInterno: '',
        search: '',
      }
      if (type === 'proyecto') return { ...base, proyecto: value }
      if (type === 'estado') return { ...base, estado: value }
      if (type === 'tipologia') return { ...base, tipologia: value }
      if (type === 'search') return { ...base, search: value }
      return base
    })
  }, [])

  return (
    <div className={styles.app}>
      <AppSidebar
        tab={tab}
        onTab={setTab}
        workspaceName={capitalOpenConfig.nombre}
        workspaceTag={logoTag}
        workspaceLogoUrl={capitalOpenConfig.logoUrl}
      />

      <div className={styles.main}>
        <MainHeader
          tab={tab}
          lastUpdated={lastUpdated}
          onRefresh={refetch}
          loading={loading}
          isLive={isLive}
          dataSource={dataSource}
        />

        {loading && <div className={styles.loadingBar} />}

        {error && <div className={styles.error}>Error al cargar datos: {error}</div>}

        {!loading && !error && (
          <div className={styles.mainScroll}>
            <div className={styles.shell}>
              {tab !== 'Resumen' ? <CapitalOpenHero reservas={reservas} /> : null}
              {tab !== 'Resumen' ? (
                <div className={styles.panel}>
                  <DateRangeFilter total={reservas.length} filtradas={reservasEnRango.length} />
                </div>
              ) : null}
              {tab === 'Resumen' && (
                <ResumenPage
                  reservas={reservasEnRango}
                  totalEnApi={reservas.length}
                  lastUpdated={lastUpdated}
                  onDrillDown={handleResumenDrillDown}
                />
              )}
              {tab === 'Reservas' && (
                <>
                  <div className={styles.panel}>
                    <Filters filters={filters} onChange={setFilters} reservas={reservasEnRango} />
                  </div>
                  <ReservasTable reservas={filtered} />
                </>
              )}
              {tab === 'Conteos' && (
                <>
                  <div className={styles.panel}>
                    <Filters filters={filters} onChange={setFilters} reservas={reservasEnRango} />
                  </div>
                  <RankingsTab reservas={filtered} />
                </>
              )}
              {tab === 'Asistencia reuniones' && <AsistenciaPage />}
              {tab === 'Competencia Capital Open Equipos' && (
                <CompetenciaCapitalOneTab reservas={reservasEnRango} />
              )}
              {tab === 'Competencia Capital Open Individual' && (
                <CompetenciaCapitalOpenIndividualTab reservas={reservasEnRango} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
