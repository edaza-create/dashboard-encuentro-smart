import { useMemo, useState } from "react";
import { useRankingPublico } from "../hooks/useRankingPublico.js";
import { pickAvatarSrc } from "../utils/buildRankingCompetencia.js";
import { SCORING } from "../utils/competenciaCapitalOpenScore.js";
import { formatUF } from "../utils/format.js";
import Avatar from "./ranking/Avatar.jsx";

function medalRowClass(styles, index) {
  if (index === 0) return styles.rowGold;
  if (index === 1) return styles.rowSilver;
  if (index === 2) return styles.rowBronze;
  return "";
}
import styles from "./RankingPublicoPage.module.css";

const AVATAR_SIZE = 72;

const eventoNombre = import.meta.env.VITE_EVENTO_NOMBRE ?? "Capital Open";
const eventoSubtitulo = import.meta.env.VITE_EVENTO_SUBTITULO ?? "Cyber";

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
      key: a.email || a.nombre || String(i),
      rank: i + 1,
      seed: a.email || a.nombre,
      nombre: a.nombre ?? a.email,
      metaTop: a.bp_display,
      metaBottom: a.email,
      avatarSrc: pickAvatarSrc(
        { asesor_foto_url: a.foto_url, asesor_foto_urls: a.foto_urls },
        AVATAR_SIZE
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
  }, [tab, asesores, bps]);

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
          El ranking se ordena por puntos totales.
        </p>

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
              className={`${styles.tableHead} ${styles.tableCompetencia} ${
                tab === "individual" ? styles.tableWithUf : ""
              }`}
            >
              <div className={`${styles.col} ${styles.colNum}`}>RK</div>
              <div className={styles.col} aria-hidden="true" />
              <div className={styles.col}>{tab === "bp" ? "EQUIPO" : "ASESOR"}</div>
              <div className={`${styles.col} ${styles.colRight}`}>RES</div>
              <div className={`${styles.col} ${styles.colRight}`}>PROM</div>
              <div className={`${styles.col} ${styles.colRight}`}>ESC</div>
              {tab === "individual" ? <div className={`${styles.col} ${styles.colRight}`}>UF</div> : null}
              <div className={`${styles.col} ${styles.colRight}`}>PTS ▌</div>
            </div>

            {lista.length === 0 ? (
              <div className={styles.empty}>
                Aún no hay asesores con reservas en competencia en este periodo.
              </div>
            ) : (
              <div className={styles.rows}>
                {lista.map((item, i) => {
                  const medalClass = medalRowClass(styles, i);

                  return (
                  <article
                    key={item.key}
                    className={`${styles.row} ${styles.rowCompetencia} ${medalClass} ${
                      tab === "individual" ? styles.rowWithUf : ""
                    }`}
                  >
                    <div className={styles.rankCell}>
                      <div className={styles.rankNum}>{String(item.rank).padStart(2, "0")}</div>
                      <div className={styles.rankLabel}>RANK</div>
                    </div>
                    <div className={styles.portraitCell}>
                      <Avatar
                        name={item.nombre}
                        seed={item.seed}
                        src={item.avatarSrc}
                        size={AVATAR_SIZE}
                      />
                    </div>
                    <div className={styles.playerCell}>
                      <span className={styles.seedTag}>
                        {tab === "bp" ? "TEAM" : "SEED"} {String(item.rank).padStart(2, "0")}
                      </span>
                      <div className={styles.playerName} title={item.nombre}>
                        {item.nombre}
                      </div>
                      <div className={styles.playerMeta}>
                        {item.metaTop ? <span>{item.metaTop}</span> : null}
                        {item.metaTop && item.metaBottom ? (
                          <span className="sep">·</span>
                        ) : null}
                        {item.metaBottom ? <span>{item.metaBottom}</span> : null}
                      </div>
                      <div className={styles.mobileStats}>
                        {item.reservasCount} res · {item.promesasCount} prom · {item.escriturasCount} esc
                        {tab === "individual" ? (
                          <>
                            {" "}
                            · {formatUf(item.ufTotal)}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className={styles.statCell}>
                      <div className={styles.statValue}>{item.reservasCount}</div>
                      <div className={styles.statLabel}>RESERVAS</div>
                    </div>
                    <div className={styles.statCell}>
                      <div className={styles.statValue}>{item.promesasCount}</div>
                      <div className={styles.statLabel}>PROMESAS</div>
                    </div>
                    <div className={styles.statCell}>
                      <div className={styles.statValue}>{item.escriturasCount}</div>
                      <div className={styles.statLabel}>ESCRITURAS</div>
                    </div>
                    {tab === "individual" ? (
                      <div className={styles.statCell}>
                        <div className={styles.statValue}>{formatUf(item.ufTotal)}</div>
                        <div className={styles.statLabel}>CARTERA UF</div>
                      </div>
                    ) : null}
                    <div className={styles.totalCell}>
                      <div className={styles.totalValue}>{formatPts(item.totalPuntos)}</div>
                      <div className={styles.totalLabel}>PTS · TOTAL</div>
                      <div
                        className={styles.ptsHint}
                        title="Reserva + promesas + escrituras (+ actividades en equipos)"
                      >
                        {ptsBreakdown(item)}
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}

            {huerfanos.length > 0 ? (
              <div className={styles.huerfanos}>
                <div className={styles.huerfanosTitle}>
                  {huerfanos.length} asesor{huerfanos.length === 1 ? "" : "es"} sin BP asignado
                </div>
                <div>
                  Tienen reservas pero no matchean ninguna hoja del xlsx. Resync con{" "}
                  <code>pnpm run sync:asesores</code> si actualizaste el archivo.
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
