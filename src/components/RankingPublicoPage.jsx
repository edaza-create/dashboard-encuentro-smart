import { useMemo, useState } from "react";
import { useRankingPublico } from "../hooks/useRankingPublico.js";
import { pickAvatarSrc } from "../utils/buildRanking.js";
import { formatUF } from "../utils/format.js";
import Avatar from "./ranking/Avatar.jsx";
import styles from "./RankingPublicoPage.module.css";

const AVATAR_SIZE = 72;

const eventoNombre = import.meta.env.VITE_EVENTO_NOMBRE ?? "Encuentro Smart";
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

function temporadaFromPeriodo(periodo) {
  if (!periodo?.desde) return "2026";
  try {
    return new Date(periodo.desde).getFullYear().toString();
  } catch {
    return "2026";
  }
}

export default function RankingPublicoPage() {
  const { status, error, asesores, bps, huerfanos, updatedAt, periodo, refetch } =
    useRankingPublico();
  const [tab, setTab] = useState("individual");

  const lista = useMemo(() => {
    if (tab === "bp") {
      return bps.map((bp, i) => ({
        key: bp.slug,
        rank: i + 1,
        seed: bp.slug,
        nombre: bp.display,
        metaTop: `${bp.asesores_activos} asesor${bp.asesores_activos === 1 ? "" : "es"} activo${bp.asesores_activos === 1 ? "" : "s"}`,
        metaBottom: null,
        avatarSrc: null,
        total: bp.total,
        montoUf: bp.monto_uf_total
      }));
    }
    return asesores.map((a, i) => ({
      key: a.email,
      rank: i + 1,
      seed: a.email,
      nombre: a.nombre ?? a.email,
      metaTop: a.bp_display,
      metaBottom: a.email,
      avatarSrc: pickAvatarSrc(
        { asesor_foto_url: a.foto_url, asesor_foto_urls: a.foto_urls },
        AVATAR_SIZE
      ),
      total: a.total,
      montoUf: a.monto_uf_total
    }));
  }, [tab, asesores, bps]);

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
            TEMPORADA {temporadaFromPeriodo(periodo)} · ACTUALIZADO {formatActualizadoCorto(updatedAt)}
          </span>
        </div>

        <h1 className={styles.title}>
          Quién manda<br />
          en la <span className={styles.chip}>cancha.</span>
        </h1>

        <p className={styles.lede}>
          Reservas acumuladas por asesor y por equipo (BP) en el Cyber del Encuentro Smart.
          Suma de reservas reales y UF transada al cierre de la jornada.
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
          <div className={styles.stateBox}>Cargando reservas del Cyber…</div>
        ) : null}
        {status === "error" ? (
          <div className={`${styles.stateBox} ${styles.stateError}`}>
            Error al cargar: {error}
          </div>
        ) : null}

        {status === "ready" ? (
          <>
            <div className={styles.tableHead}>
              <div className={`${styles.col} ${styles.colNum}`}>RK</div>
              <div className={styles.col} aria-hidden="true" />
              <div className={styles.col}>{tab === "bp" ? "EQUIPO" : "ASESOR"}</div>
              <div className={`${styles.col} ${styles.colRight}`}>RESERVAS</div>
              <div className={`${styles.col} ${styles.colRight}`}>UF</div>
              <div className={`${styles.col} ${styles.colRight}`}>TOTAL ▌</div>
            </div>

            {lista.length === 0 ? (
              <div className={styles.empty}>Aún no hay reservas registradas en el periodo.</div>
            ) : (
              <div className={styles.rows}>
                {lista.map((item, i) => (
                  <article
                    key={item.key}
                    className={`${styles.row} ${i === 0 ? styles.rowTop1 : ""}`}
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
                    </div>
                    <div className={styles.statCell}>
                      <div className={styles.statValue}>{item.total}</div>
                      <div className={styles.statLabel}>RESERVAS</div>
                    </div>
                    <div className={styles.statCell}>
                      <div className={styles.statValue}>{formatUF(item.montoUf)}</div>
                      <div className={styles.statLabel}>TRANSADA</div>
                    </div>
                    <div className={styles.totalCell}>
                      <div className={styles.totalValue}>{item.total}</div>
                      <div className={styles.totalLabel}>RESERVAS · TOTAL</div>
                    </div>
                  </article>
                ))}
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
          </div>
          <div>
            <span className={styles.footerKey}>RANKING</span>
            <span className={styles.footerVal}>Individual · Por equipo (BP)</span>
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
