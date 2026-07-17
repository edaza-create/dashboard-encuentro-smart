import { useMemo, useState } from "react";
import { useRankingPublico } from "../hooks/useRankingPublico.js";
import { avatarUrlWithCacheBust, pickAvatarSrc } from "../utils/buildRankingCompetencia.js";
import { SCORING } from "../utils/competenciaCapitalOpenScore.js";
import { formatUF } from "../utils/format.js";
import { EQUIPOS_CAPITAL_ONE } from "../data/competenciaCapitalOneTeams.js";
import Avatar from "./ranking/Avatar.jsx";
import styles from "./RankingPublicoPage.module.css";

const brokersByTeamId = new Map(
  EQUIPOS_CAPITAL_ONE.map((eq) => [
    String(eq.id),
    eq.brokers.map((b) => b.referenciaLista)
  ])
);

const TOP_INDIVIDUAL = 10;

function medalRowClass(styles, rankOneBased) {
  const index = rankOneBased - 1;
  if (index === 0) return styles.rowGold;
  if (index === 1) return styles.rowSilver;
  if (index === 2) return styles.rowBronze;
  return "";
}

function avatarDarkForMedal(medalClass, styles) {
  return medalClass === styles.rowBronze;
}

const AVATAR_SIZE = 72;

const eventoNombre = import.meta.env.VITE_EVENTO_NOMBRE ?? "Capital Open";
const eventoSubtitulo = import.meta.env.VITE_EVENTO_SUBTITULO ?? "Cyber";

// Modo suspenso: oculta puntos totales/desglose y el orden real del ranking
// (reordena alfabéticamente y esconde posiciones/medallas) para no revelar
// quién gana antes de la premiación. Reversible: VITE_RANKING_SUSPENSO=false.
const MODO_SUSPENSO =
  String(import.meta.env.VITE_RANKING_SUSPENSO ?? "false").toLowerCase() === "true";

const TABS = [
  { key: "individual", label: "Individual" },
  { key: "bp", label: "Por equipo (BP)" }
];

function formatActualizadoCorto(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatPts(n) {
  return Number(n ?? 0).toLocaleString("es-CL");
}

function formatUf(n) {
  return formatUF(Math.round(Number(n ?? 0)));
}

function formatPollInterval(ms) {
  if (ms >= 60_000 && ms % 60_000 === 0) {
    const min = ms / 60_000;
    return `cada ${min} min`;
  }
  return `cada ${Math.round(ms / 1000)} s`;
}

function temporadaFromPeriodo(periodo) {
  if (!periodo?.desde) return "2026";
  try {
    return new Date(periodo.desde).getFullYear().toString();
  } catch {
    return "2026";
  }
}

export default function RankingPublicoPage() {
  const {
    status,
    error,
    asesores,
    bps,
    huerfanos,
    updatedAt,
    periodo,
    refetch,
    pollIntervalMs,
    manualRemoteEnabled,
    manualPollIntervalMs,
    lastManualSyncAt,
  } = useRankingPublico();
  const [tab, setTab] = useState("individual");

  const lista = useMemo(() => {
    if (tab === "bp") {
      return bps.map((bp, i) => ({
        key: bp.slug,
        rank: i + 1,
        seed: bp.slug,
        nombre: bp.display,
        metaTop: `${bp.reservasCount} reserva${bp.reservasCount === 1 ? "" : "s"} en competencia`,
        metaBottom: null,
        avatarSrc: null,
        reservasCount: bp.reservasCount,
        promesasCount: bp.promesasCount,
        escriturasCount: bp.escriturasCount,
        puntosReserva: bp.puntosReserva,
        puntosPromesas: bp.puntosPromesas,
        puntosEscrituras: bp.puntosEscrituras,
        puntosActividades: bp.puntosActividades ?? 0,
        totalPuntos: bp.totalPuntos
      }));
    }
    return asesores.map((a, i) => ({
      key: a.key || a.email || a.nombre || String(i),
      rank: i + 1,
      seed: a.email || a.nombre,
      nombre: a.nombre ?? a.email,
      metaTop: a.bp_display,
      metaBottom: null,
      avatarSrc: avatarUrlWithCacheBust(
        pickAvatarSrc(
          { asesor_foto_url: a.foto_url, asesor_foto_urls: a.foto_urls },
          AVATAR_SIZE
        ),
        updatedAt
      ),
      reservasCount: a.reservasCount,
      promesasCount: a.promesasCount,
      escriturasCount: a.escriturasCount,
      puntosReserva: a.puntosReserva,
      puntosPromesas: a.puntosPromesas,
      puntosEscrituras: a.puntosEscrituras,
      totalPuntos: a.totalPuntos,
      ufTotal: a.ufTotal ?? 0
    }));
  }, [tab, asesores, bps, updatedAt]);

  const ptsBreakdown = (item) => {
    const parts = [
      formatPts(item.puntosReserva),
      formatPts(item.puntosPromesas),
      formatPts(item.puntosEscrituras)
    ];
    if (tab === "bp" && item.puntosActividades) {
      parts.push(formatPts(item.puntosActividades));
    }
    return parts.join(" + ");
  };

  // En modo suspenso reordenamos alfabéticamente para que el orden no delate
  // quién va ganando; fuera de suspenso se respeta el orden por puntos del hook.
  const listaVisible = useMemo(() => {
    if (!MODO_SUSPENSO) return lista;
    return [...lista].sort((a, b) =>
      String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es", {
        sensitivity: "base"
      })
    );
  }, [lista]);

  const listaTop = MODO_SUSPENSO
    ? listaVisible
    : tab === "individual"
    ? listaVisible.slice(0, TOP_INDIVIDUAL)
    : listaVisible;
  const listaRest =
    MODO_SUSPENSO || tab !== "individual"
      ? []
      : listaVisible.slice(TOP_INDIVIDUAL);

  const renderRow = (item) => {
    const medalClass = MODO_SUSPENSO ? "" : medalRowClass(styles, item.rank);
    const showUf = tab === "individual";

    return (
      <article
        key={item.key}
        className={`${styles.row} ${medalClass} ${
          MODO_SUSPENSO ? styles.rowNoScore : ""
        } ${showUf ? styles.rowWithUf : ""}`}
      >
        <div className={styles.rowGrid}>
          <div className={styles.rankZone}>
            {MODO_SUSPENSO ? (
              <span className={styles.rankHidden} aria-label="Posición oculta">
                ?
              </span>
            ) : (
              <>
                <span className={styles.rankNum}>
                  {String(item.rank).padStart(2, "0")}
                </span>
                <span className={styles.rankLabel}>RANK</span>
              </>
            )}
          </div>

          <div className={styles.identityZone}>
            <div className={styles.avatarFrame}>
              <Avatar
                name={item.nombre}
                seed={item.seed}
                src={item.avatarSrc}
                size={AVATAR_SIZE}
                dark={avatarDarkForMedal(medalClass, styles)}
              />
            </div>
            <div className={styles.identityCopy}>
              {MODO_SUSPENSO ? (
                <span className={styles.seedTag}>
                  {tab === "bp" ? "EN JUEGO" : "EN CANCHA"}
                </span>
              ) : (
                <span className={styles.seedTag}>
                  {tab === "bp" ? "TEAM" : "SEED"}{" "}
                  {String(item.rank).padStart(2, "0")}
                </span>
              )}
              <h2 className={styles.playerName} title={item.nombre}>
                {item.nombre}
              </h2>
              {(item.metaTop || item.metaBottom) ? (
                <p className={styles.playerMeta}>
                  {item.metaTop ? <span>{item.metaTop}</span> : null}
                  {item.metaTop && item.metaBottom ? (
                    <span className={styles.metaSep} aria-hidden="true">
                      ·
                    </span>
                  ) : null}
                  {item.metaBottom ? <span>{item.metaBottom}</span> : null}
                </p>
              ) : null}
            </div>
          </div>

          <div className={styles.metricsZone}>
            <div
              className={`${styles.metricsPanel} ${
                showUf ? styles.metricsPanelWithUf : ""
              }`}
            >
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>
                  {item.reservasCount}
                </span>
                <span className={styles.metricLabel}>Reservas</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>
                  {item.promesasCount}
                </span>
                <span className={styles.metricLabel}>Promesas</span>
              </div>
              <div className={styles.metricItem}>
                <span className={styles.metricValue}>
                  {item.escriturasCount}
                </span>
                <span className={styles.metricLabel}>Escrituras</span>
              </div>
              {showUf ? (
                <div className={`${styles.metricItem} ${styles.metricItemUf}`}>
                  <span className={styles.metricValueUf}>
                    {formatUf(item.ufTotal)}
                  </span>
                  <span className={styles.metricLabel}>Cartera UF</span>
                </div>
              ) : null}
            </div>
          </div>

          {!MODO_SUSPENSO && (
            <div className={styles.scoreZone}>
              <span className={styles.scoreValue}>
                {formatPts(item.totalPuntos)}
              </span>
              <span className={styles.scoreLabel}>PTS · TOTAL</span>
              <span
                className={styles.scoreBreakdown}
                title="Reserva + promesas + escrituras (+ actividades en equipos)"
              >
                {ptsBreakdown(item)}
              </span>
            </div>
          )}
        </div>

        {tab === "bp" && brokersByTeamId.has(item.key) && (
          <details className={styles.bpRoster}>
            <summary className={styles.bpRosterSummary}>
              <span>{brokersByTeamId.get(item.key).length} BPs</span>
              <span className={styles.bpRosterChev} aria-hidden="true">▾</span>
            </summary>
            <ul className={styles.bpRosterList}>
              {brokersByTeamId.get(item.key).map((name) => (
                <li key={name} className={styles.bpRosterItem}>
                  {name}
                </li>
              ))}
            </ul>
          </details>
        )}
      </article>
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.field} aria-hidden="true" />
      <div className={styles.fieldSpot} aria-hidden="true" />
      <svg
        className={styles.courtGrid}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <defs>
          <pattern id="grid-rk" width="8" height="8" patternUnits="userSpaceOnUse">
            <path
              d="M 8 0 L 0 0 0 8"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.06"
              opacity="0.18"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid-rk)" />
        <line x1="0" y1="80" x2="100" y2="80" stroke="#FFFFFF" strokeWidth="0.25" opacity="0.3" />
        <line x1="0" y1="94" x2="100" y2="94" stroke="#FFFFFF" strokeWidth="0.18" opacity="0.2" />
        <line x1="50" y1="80" x2="50" y2="94" stroke="#FFFFFF" strokeWidth="0.18" opacity="0.2" />
      </svg>

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <span className={styles.brand}>
            <svg width="26" height="26" viewBox="-12 -12 24 24" aria-hidden="true">
              <circle r="10" fill="#CCFA3F" stroke="#0B0F1A" strokeWidth="1.6" />
              <path d="M -10 -1 C -5 -8, 5 -8, 10 -1" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
              <path d="M -10 1 C -5 8, 5 8, 10 1" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
            </svg>
            <span className={styles.brandName}>{eventoNombre}</span>
            <span className={styles.brandSub}>{eventoSubtitulo}</span>
          </span>

          <button type="button" className={styles.refreshBtn} onClick={refetch}>
            Refrescar
          </button>
        </header>

        <div className={styles.eyebrow}>
          <span className={styles.dot} />
          RANKING · CYBER
          <span className={styles.muted}>
            TEMPORADA {temporadaFromPeriodo(periodo)} · RESERVAS {formatActualizadoCorto(updatedAt)}
            {manualRemoteEnabled && (
              <>
                {' '}
                · MANUAL {formatActualizadoCorto(lastManualSyncAt)}
                {' '}
                ({formatPollInterval(manualPollIntervalMs)})
              </>
            )}
          </span>
        </div>

        <h1 className={styles.title}>
          Quién manda<br />
          en la <span className={styles.chip}>cancha.</span>
        </h1>

        <p className={styles.lede}>
          <strong>Reservas</strong> en plataforma de competencia: {SCORING.reservaPorRegistro} pts ·{" "}
          <strong>Promesas</strong>: {SCORING.promesaPorRegistro} pts c/u ·{" "}
          <strong>Escrituras</strong>: {SCORING.escrituraPorRegistro} pts c/u.{" "}
          <strong>Cartera UF</strong> por asesor según sus reservas (mismo criterio que el dashboard).
          {MODO_SUSPENSO
            ? " Los puntos y las posiciones están ocultos: se revelan en la premiación."
            : " El ranking se ordena por puntos totales."}
        </p>

        {MODO_SUSPENSO ? (
          <div className={styles.suspenso}>
            <span className={styles.suspensoLock} aria-hidden="true">🔒</span>
            <span>
              <strong>Puntos ocultos.</strong> El marcador y las posiciones se
              revelan en la premiación — sigue sumando.
            </span>
          </div>
        ) : null}

        <div className={styles.controls}>
          <div className={styles.season}>
            <span className={styles.seasonLabel}>SEASON</span>
            <span className={styles.seasonValue}>{temporadaFromPeriodo(periodo)}</span>
            <span className={styles.seasonChev}>▾</span>
          </div>

          <div className={styles.filters} role="tablist" aria-label="Tipo de ranking">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`${styles.filter} ${tab === t.key ? styles.filterActive : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {status === "loading" ? (
          <div className={styles.stateBox}>Cargando ranking del Cyber…</div>
        ) : null}
        {status === "error" ? (
          <div className={`${styles.stateBox} ${styles.stateError}`}>
            Error al cargar: {error}
          </div>
        ) : null}

        {status === "ready" ? (
          <>
            <div
              className={`${styles.tableHead} ${
                tab === "individual" ? styles.tableWithUf : ""
              } ${MODO_SUSPENSO ? styles.tableHeadNoScore : ""}`}
              aria-hidden="true"
            >
              <div className={styles.headRank}>{MODO_SUSPENSO ? "" : "RK"}</div>
              <div className={styles.headIdentity}>{tab === "bp" ? "EQUIPO" : "ASESOR"}</div>
              <div className={styles.headMetrics}>
                <span>RESERVAS</span>
                <span>PROMESAS</span>
                <span>ESCRITURAS</span>
                {tab === "individual" ? <span>CARTERA UF</span> : null}
              </div>
              {!MODO_SUSPENSO && <div className={styles.headScore}>PUNTOS</div>}
            </div>

            {lista.length === 0 ? (
              <div className={styles.empty}>
                Aún no hay asesores con reservas en competencia en este periodo.
              </div>
            ) : (
              <>
                <div className={styles.rows}>{listaTop.map(renderRow)}</div>

                {listaRest.length > 0 ? (
                  <details className={styles.moreBlock}>
                    <summary className={styles.moreSummary}>
                      <span className={styles.moreSummaryLabel}>
                        Ver posiciones {TOP_INDIVIDUAL + 1}–{lista.length}
                      </span>
                      <span className={styles.moreSummaryMeta}>
                        {listaRest.length} asesor
                        {listaRest.length === 1 ? "" : "es"} más
                      </span>
                      <span className={styles.moreChev} aria-hidden="true">
                        ▾
                      </span>
                    </summary>
                    <div className={styles.rows}>{listaRest.map(renderRow)}</div>
                  </details>
                ) : null}
              </>
            )}

            {huerfanos.length > 0 ? (
              <div className={styles.huerfanos}>
                <div className={styles.huerfanosTitle}>
                  {huerfanos.length} asesor{huerfanos.length === 1 ? "" : "es"} sin BP asignado
                </div>
                <div>
                  Tienen reservas pero no están en el xlsx de BPs ni en el roster de Equipo
                  Comercial Interno. Resync con <code>npm run sync:asesores</code> o revisa{" "}
                  <code>src/data/equipoComercialInterno.js</code>.
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div className={styles.footer}>
          <div>
            <span className={styles.footerKey}>DATA</span>
            <span className={styles.footerVal}>
              Brekto Live Feed <span className={styles.footerLime}>v1.0</span>
            </span>
            <span className={styles.footerPoll}>
              Actualización automática {formatPollInterval(pollIntervalMs)}
            </span>
          </div>
          <div>
            <span className={styles.footerKey}>PUNTOS</span>
            <span className={styles.footerVal}>Capital Open · Individual / equipos</span>
          </div>
          <div className="right">
            <span className={styles.footerKey}>ÚLT. ACTUALIZACIÓN</span>
            <span className={styles.footerVal}>{formatActualizadoCorto(updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
