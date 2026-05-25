# PRD — Refactorización hoja Resumen (Dashboard Overview)

| Campo | Valor |
|-------|--------|
| **Versión** | 0.1 (borrador para revisión) |
| **Fecha** | 18 mayo 2026 |
| **Estado** | Implementado (fases 1–3) — mayo 2026 |
| **Alcance** | Pestaña `Resumen` del dashboard Capital Open |
| **Archivos actuales** | `src/components/DashboardOverview.jsx` (~900 LOC), `DashboardOverview.module.css` (~680 LOC) |

---

## 1. Resumen ejecutivo

La hoja **Resumen** es la primera pantalla del dashboard y concentra KPIs, rankings y gráficos de reservas/UF. Tras un rediseño reciente tiene buena estética (tarjetas blancas, hero azul, grid analítico), pero sufre **sobrecarga cognitiva**, **inconsistencia con el resto de la app**, **controles no funcionales** y **deuda técnica** (monolito, utilidades duplicadas). Este PRD define una refactorización por fases que mejora claridad, confianza en los datos y mantenibilidad **sin cambiar el origen de datos ni las reglas de negocio de UF**.

---

## 2. Contexto y usuarios

### 2.1 Usuarios objetivo

| Persona | Necesidad en Resumen |
|---------|----------------------|
| **Gerencia comercial** | Vista rápida: volumen, UF, salud de cartera, tendencia mes vs mes |
| **Operaciones / BI interno** | Desglose por inmobiliaria, comuna, tipología, estado |
| **Coordinación Cyber** | Alinear métricas con ventana Capital Open y competencia |

### 2.2 Flujo actual

```
App → CapitalOpenHero (totales competencia, dataset completo)
    → DateRangeFilter (solo informativo: X de Y en ventana Cyber)
    → DashboardOverview(reservasEnRango)  ← solo filtro por fechas Cyber
```

**Otras pestañas** (`Reservas`, `Conteos`) aplican además `Filters` (estado, proyecto, búsqueda, equipo interno, etc.). **Resumen no.**

### 2.3 Objetivos del producto (post-refactor)

1. Responder en **< 10 s** “¿cómo vamos en el Cyber?” sin scroll excesivo.
2. Que cada número indique **qué filtro aplica** (fechas, estado, etc.).
3. Permitir **profundizar** (drill-down) hacia Reservas/Conteos cuando tenga sentido.
4. Reducir el archivo principal a **módulos testeables** y reutilizar utilidades compartidas.

### 2.4 No objetivos (v1 refactor)

- Nuevas fuentes de datos o cambios en API ored.
- Rediseño global del sidebar / shell de la app.
- Reemplazar Recharts por otra librería.
- Metas de salud configurables por admin (evaluar v2).

---

## 3. Auditoría UI/UX

### 3.1 Fortalezas actuales

| Área | Observación |
|------|-------------|
| **Identidad visual** | Coherente con tokens (`--color-primary`, tarjetas, sombras) y con `RankingsTab` |
| **Jerarquía en hero KPI** | Tarjeta destacada “Total reservas” + sparkline comunica volumen y tendencia |
| **Densidad de información** | Cubre dimensiones clave: UF, temporal, inmobiliaria, geo, producto, estado |
| **Gráficos** | Tooltips, pies por mes y área UF son legibles; animaciones desactivadas (rendimiento) |
| **Responsive** | Breakpoints 1200px / 768px evitan roturas graves |

### 3.2 Hallazgos críticos (P0)

| ID | Problema | Impacto | Evidencia |
|----|----------|---------|-----------|
| **UX-01** | **Filtros inconsistentes**: Resumen usa `reservasEnRango` (fechas); no hereda `Filters` de otras pestañas | Usuario compara números con Conteos y no cuadran | `App.jsx` L103 vs L107–117 |
| **UX-02** | **Botón “Ampliar” (Maximize2) en todas las tarjetas sin acción** | Expectativa rota, mala accesibilidad (control falso) | `MetricCard` L132–134, `GoalHealthCard` L205–207 |
| **UX-03** | **Hero + DateRangeFilter duplican mensaje de periodo Cyber** | Ruido visual arriba del fold | `CapitalOpenHero`, `DateRangeFilter` |
| **UX-04** | **Sin estado vacío global** cuando `reservas.length === 0` | Pantalla de tarjetas en cero sin guía | `DashboardOverview` export |
| **UX-05** | **Métricas duplicadas**: mismo `monthTrend` en “Total reservas” y “Mes en curso” | Redundancia, desperdicio de espacio | L727–748 |

### 3.3 Hallazgos importantes (P1)

| ID | Problema | Impacto |
|----|----------|---------|
| **UX-06** | **Scroll muy largo** (~12 widgets + gráfico ancho completo) | Fatiga; KPIs secundarios lejos del hero |
| **UX-07** | **Texto de tendencia engañoso**: `WeekdayActivity` muestra fijo “↗ Distribución histórica” | Implica crecimiento sin calcularlo |
| **UX-08** | **KPIs ambiguos en tarjetas de ranking** | Ej.: “Ranking inmobiliaria” muestra `metric={items.length}` (cantidad de inmobiliarias), no reservas del líder |
| **UX-09** | **Delta del ranking** (`share - 100`) muestra “-40%” vs líder de forma poco intuitiva | Confusión analítica |
| **UX-10** | **Sin drill-down**: no se puede clicar inmobiliaria/comuna/estado para ver detalle en Reservas | Flujo muerto |
| **UX-11** | **Redundancia gráfica**: dos pies (reservas/UF por mes) + área UF grande comparten la misma serie | Posible consolidación |
| **UX-12** | **DateRangeFilter no es interactivo** | Usuario cree que puede cambiar fechas ahí; solo `capitalOpenConfig` |

### 3.4 Hallazgos menores (P2)

| ID | Problema |
|----|----------|
| **UX-13** | Inline styles dispersos (`style={{ ... }}`) rompen consistencia con CSS modules |
| **UX-14** | Gráficos sin `aria-label` / tabla alternativa para lectores de pantalla |
| **UX-15** | “Salud de cartera” usa umbral fijo 70% sin explicar origen |
| **UX-16** | `Comunas` metric = número de comunas distintas, no volumen del top |
| **UX-17** | Pills 3m/6m/12m solo visibles en gráfico inferior; pies no indican ventana activa |
| **UX-18** | Carga: múltiples `.filter()` sobre `reservas` en cada `useMemo` (rendimiento con datasets grandes) |

### 3.5 Auditoría técnica (deuda)

| ID | Problema |
|----|----------|
| **TECH-01** | Monolito ~900 LOC: mezcla presentación, agregación y subcomponentes |
| **TECH-02** | Duplicación con `RankingsTab`: `countBy`, `shortLabel`, paletas, tooltips |
| **TECH-03** | Sin tests de agregaciones (tendencias, healthyPct, monthlyBars) |
| **TECH-04** | Sin contrato de props documentado (`reservas` shape implícito) |

### 3.6 Mapa de contenido actual (inventario)

| Fila | Widgets |
|------|---------|
| **topRow** | Total reservas (featured), Cartera UF, Mes en curso, Entrega futura |
| **midRow** | Pie reservas/mes, Pie UF/mes, Ranking inmobiliaria top 5 |
| **goalRow** | Salud cartera (donut), Actividad semanal, Top proyectos |
| **bottomRow** | Comunas, Tipologías, Estado reservas |
| **full width** | Evolución cartera UF (área + pills 3/6/12m) |

---

## 4. Oportunidades de mejora (priorizadas)

### 4.1 Quick wins (Fase 1 — confianza y limpieza)

1. Eliminar u ocultar botones **Ampliar** hasta existir modal/expansión real.
2. Añadir **banner de contexto** en Resumen: “Mostrando N reservas · Cyber {desde}–{hasta}” + enlace a ajustar (si en v2 hay filtro de fechas editable).
3. **Estado vacío** y **estado cargando** local si `reservas` llega vacío tras filtro.
4. Corregir **métricas primarias** de tarjetas (ranking, comunas) y quitar texto trend falso en actividad semanal.
5. Deduplicar **monthTrend** (mantener en hero; en “Mes en curso” mostrar solo conteo + fecha).

### 4.2 Mejoras estructurales (Fase 2 — información y navegación)

1. Reorganizar layout en **3 zonas**:
   - **Zona A — Pulse** (4 KPIs + 1 mini tendencia UF/reservas).
   - **Zona B — Composición** (estado, tipologías, comunas, inmobiliaria).
   - **Zona C — Tiempo** (un solo bloque temporal con toggle: Reservas | UF | ambos).
2. **Drill-down**: clic en fila ranking → cambiar tab a Reservas con filtro preaplicado (callback vía `App`).
3. Alinear **filtros**: decisión de producto (ver §5.2).

### 4.3 Refactor técnico (Fase 3 — mantenibilidad)

1. Extraer `src/features/resumen/`:
   - `useResumenMetrics.js` — todas las agregaciones.
   - `components/` — una tarjeta por archivo.
   - `ResumenPage.jsx` — composición del layout.
2. Mover `countBy`, `shortLabel` a `src/utils/reservaAggregates.js`.
3. Tests unitarios de hooks de métricas con fixtures JSON pequeños.

---

## 5. Decisiones de producto (requieren confirmación)

### 5.1 Alcance de filtros en Resumen

| Opción | Descripción | Recomendación |
|--------|-------------|---------------|
| **A** | Solo ventana Cyber (actual) + banner explícito | Mínimo cambio; menos confusión si se comunica bien |
| **B** | Heredar mismos `Filters` que Conteos cuando el usuario los definió | Consistencia numérica entre pestañas |
| **C** | Filtros ligeros propios en Resumen (estado, inmobiliaria) sin panel completo | Balance UX / complejidad |

**Recomendación:** **A en Fase 1** + banner; **B en Fase 2** si stakeholders confirman que comparan con Conteos a diario.

### 5.2 Gráficos temporales

| Opción | Descripción |
|--------|-------------|
| **Consolidar** | Un card “Tendencia” con tabs Reservas / UF y pills 3m-6m-12m |
| **Mantener** | Dos pies + área (actual) con leyenda de ventana unificada |

**Recomendación:** Consolidar en Fase 2 para reducir scroll ~30%.

### 5.3 Hero Capital Open en Resumen

| Opción | Descripción |
|--------|-------------|
| **Mantener** | Hero siempre visible (marca + puntos competencia) |
| **Compactar en Resumen** | Variante reducida solo KPIs competencia |
| **Ocultar en Resumen** | Resumen tiene su propio hero de métricas |

**Recomendación:** Compactar en Fase 2; eliminar duplicación con `DateRangeFilter` (fusionar en un solo componente de periodo).

---

## 6. Plan de refactorización por fases

### Fase 0 — Preparación (0.5 día)

- [ ] Aprobar este PRD y decisiones §5.
- [ ] Capturas “antes” (desktop 1440px, tablet 768px, móvil 390px).
- [ ] Definir fixtures de prueba (50–200 reservas representativas).

### Fase 1 — Confianza y correcciones (1–2 días)

**Objetivo:** Mejor UX sin re-arquitectura grande.

| Tarea | UX ID | Entregable |
|-------|-------|------------|
| Banner de contexto de datos | UX-01, UX-12 | `ResumenContextBar.jsx` |
| Empty / skeleton states | UX-04 | Estados en `DashboardOverview` |
| Quitar o deshabilitar Ampliar | UX-02 | Sin botones huérfanos |
| Corregir métricas y labels | UX-07–09, UX-16 | Copy y valores KPI |
| Deduplicar monthTrend | UX-05 | Una sola tarjeta con delta % |
| Tests hook métricas básicas | TECH-03 | `useResumenMetrics.test.js` |

**Criterios de aceptación Fase 1:**
- Usuario entiende qué N reservas ve y por qué fechas.
- Cero controles interactivos que no hagan nada.
- Build y tests pasan.

### Fase 2 — Layout y navegación (2–3 días)

**Objetivo:** Menos scroll, más acción.

| Tarea | Entregable |
|-------|------------|
| Nuevo layout 3 zonas (wireframe abajo) | CSS grid revisado |
| Card temporal unificado (tabs Reservas/UF) | Reemplaza 2 pies + simplifica área |
| Drill-down a Reservas | `onDrillDown({ tab, filters })` en `App` |
| Hero/periodo compacto | Fusionar hero + date strip en Resumen |
| (Opcional) Filtros alineados con Conteos | Según decisión 5.1 B |

**Criterios de aceptación Fase 2:**
- Above-the-fold: KPIs principales + 1 gráfico temporal.
- Clic en top inmobiliaria abre Reservas filtrada.
- Lighthouse: sin regresión notable de CLS.

### Fase 3 — Arquitectura modular (2 días)

**Objetivo:** Mantenibilidad.

```
src/features/resumen/
  ResumenPage.jsx
  ResumenPage.module.css
  hooks/useResumenMetrics.js
  components/
    ResumenContextBar.jsx
    KpiHeroCard.jsx
    KpiMetricCard.jsx
    TrendChartCard.jsx
    RankingInmobiliariaCard.jsx
    ...
  utils/aggregations.js   # o import desde utils global
```

| Tarea | Entregable |
|-------|------------|
| Extraer hook de métricas | `useResumenMetrics` |
| Dividir componentes | ≤ 200 LOC por archivo |
| Unificar utils con RankingsTab | `reservaAggregates.js` |
| Deprecar `DashboardOverview.jsx` monolito | Re-export o rename |

**Criterios de aceptación Fase 3:**
- Paridad funcional 100% con pre-refactor (mismos números en fixture).
- `DashboardOverview.jsx` eliminado o < 100 LOC re-export.

### Fase 4 — Pulido (1 día, opcional)

- Accesibilidad: `aria-label` en charts, contraste WCAG AA en deltas.
- Export PNG/CSV del gráfico temporal (si negocio lo pide).
- Documentación en README para desarrolladores.

---

## 7. Wireframe objetivo (Fase 2)

```
┌─────────────────────────────────────────────────────────────────┐
│ [Periodo Cyber]  N reservas · Actualizado HH:mm    [Refrescar]  │  ← Context bar
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│ │ TOTAL RESERVAS   │ │ UF     │ │ MES    │ │ FUTURA │          │  ← Zona A Pulse
│ │ (featured)       │ │        │ │        │ │        │          │
│ └──────────────────┘ └────────┘ └────────┘ └────────┘          │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌──────────────────────────┐  │
│ │ TENDENCIA  [Res][UF] 3m6m12m│ │ RANKING INMOBILIARIA     │  │  ← Zona C + B
│ │ (área o barras)             │ │ (clic → Reservas)        │  │
│ └─────────────────────────────┘ └──────────────────────────┘  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Estado   │ │ Tipología│ │ Comunas  │ │ Proyectos│            │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
│ ┌────────────────────────┐ ┌────────────────────────┐            │
│ │ Salud cartera          │ │ Actividad semanal    │            │
│ └────────────────────────┘ └────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Requisitos funcionales

### RF-01 Contexto de datos
- Mostrar siempre: cantidad de reservas, rango de fechas Cyber, última actualización (desde `MainHeader` o barra local).
- Si `filtradas < total`, indicar que hay reservas fuera de ventana.

### RF-02 KPIs principales
| KPI | Regla de cálculo (sin cambio) |
|-----|-------------------------------|
| Total reservas | `reservas.length` |
| Cartera UF | Σ `ufMontoPlanillaReserva(r)` |
| Mes en curso | Count `fecha_reserva` mes actual |
| Entrega futura | `tipo_entrega === 'futura'` |
| Salud cartera | `(total - cancelados) / total` |
| Tendencia mes | % vs mes anterior en reservas |

### RF-03 Gráfico temporal
- Pills 3 / 6 / 12 meses aplican a **toda** la sección temporal.
- Modo Reservas vs UF con misma ventana.
- Mes actual resaltado en eje X.

### RF-04 Rankings y desgloses
- Top 5 inmobiliarias, proyectos; top 4 comunas; tipologías con barra apilada; estados con barra + leyenda.
- Tooltips con valores exactos y % donde aplique.

### RF-05 Drill-down (Fase 2)
- Al hacer clic en fila de inmobiliaria/proyecto: `setTab('Reservas')` + prefill filtro correspondiente.

### RF-06 Estados vacíos
- Sin reservas: mensaje + sugerencia revisar periodo o sincronización API.
- Sin campo (ej. sin comuna): copy “Sin dato” en tarjeta, no ocultar tarjeta.

---

## 9. Requisitos no funcionales

| ID | Requisito |
|----|-----------|
| **RNF-01** | Tiempo de render inicial Resumen < 200 ms con 2 000 reservas (medido en dev tools) |
| **RNF-02** | Una sola pasada de agregación principal vía hook memoizado |
| **RNF-03** | Responsive: 1 columna < 768px; 2 columnas 768–1200px |
| **RNF-04** | Sin regresión visual en otras pestañas |
| **RNF-05** | Textos en español (Chile), números `es-CL`, UF con `formatUF` |

---

## 10. Métricas de éxito

| Métrica | Baseline (estimado) | Objetivo |
|---------|---------------------|----------|
| Scroll hasta gráfico UF | ~2–3 viewports | ≤ 1.5 viewports |
| Controles no funcionales | ~10 botones Ampliar | 0 |
| Tickets “números no coinciden” | Qualitativo alto | Reducción tras banner + alineación filtros |
| LOC `DashboardOverview` | ~900 | < 150 en compositor + módulos |
| Tests agregaciones | 0 | ≥ 15 casos |

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Cambio de números al alinear filtros | Comunicar en release notes; fase filtros opcional |
| Regresión visual en demo Cyber | Screenshots diff manual antes de deploy |
| Scope creep (export, metas configurables) | Fuera de v1; backlog v2 |

---

## 12. Cronograma sugerido

| Fase | Duración | Dependencia |
|------|----------|-------------|
| Fase 0 | 0.5 d | Aprobación PRD |
| Fase 1 | 1–2 d | Fase 0 |
| Fase 2 | 2–3 d | Fase 1 + decisión filtros |
| Fase 3 | 2 d | Fase 2 estable |
| Fase 4 | 1 d | Opcional |

**Total estimado:** 6.5–8.5 días hábiles.

---

## 13. Checklist de aprobación

Antes de implementar, confirmar:

- [ ] **Filtros Resumen:** ¿A, B o C? (§5.1)
- [ ] **Gráficos:** ¿Consolidar temporal? (§5.2)
- [ ] **Hero:** ¿Mantener / compactar / ocultar? (§5.3)
- [ ] **Drill-down:** ¿Prioridad Fase 2 o puede esperar?
- [ ] **Ampliar / export:** ¿Eliminar o implementar modal real?

---

## 14. Anexo — Referencias de código

| Elemento | Ubicación |
|----------|-----------|
| Montaje Resumen | `src/App.jsx` |
| Componente actual | `src/components/DashboardOverview.jsx` |
| Estilos | `src/components/DashboardOverview.module.css` |
| Filtro fechas | `src/utils/reservaFecha.js`, `capitalOpenConfig` |
| UF | `src/utils/ufNormalize.js` |
| Patrón similar | `src/components/RankingsTab.jsx` |

---

*Documento generado para revisión. Siguiente paso: aprobación de §13 y arranque Fase 1.*
