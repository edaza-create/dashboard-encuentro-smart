import { useCallback, useEffect, useRef, useState } from "react";
import { atlasProxyConfigured, fetchReservasAtlas } from "../api/atlasClient.js";
import { fetchReservasRanking } from "../api/rankingClient.js";
import { buildFotoByEmail, buildRankingCompetencia } from "../utils/buildRankingCompetencia.js";
import { mapReservaAtlas } from "../utils/mapReserva.js";
import { useCompetenciaManualRemoteSync } from "./useCompetenciaManualRemoteSync.js";
import { subscribeCompetenciaManualUpdated } from "../utils/competenciaStorage.js";

/**
 * Carga las reservas del ranking.
 *
 * Atlas Engine es la fuente de las reservas. ored se consulta en paralelo
 * UNICAMENTE para el mapa email -> foto del asesor, porque Atlas no entrega
 * avatares; sus reservas no se usan.
 *
 * Si ored falla, el ranking se muestra igual, sin fotos. Si Atlas falla, se
 * propaga el error: no se sustituye con datos de ored, porque cada fuente tiene
 * su propia vision de que reservas estan caidas y mezclarlas daria cifras que no
 * cuadran.
 *
 * @returns {Promise<{ reservas: object[], fotos: Map, updatedAt: string|null, periodo: object|null, origen: string }>}
 */
async function cargarReservasYFotos(options) {
  // Solo para avatares. Se lanza en paralelo y nunca hace fallar el ranking.
  const fotosPromise = fetchReservasRanking(options)
    .then((ored) => buildFotoByEmail(ored?.reservas ?? []))
    .catch((err) => {
      console.warn("[ranking] ored no disponible para fotos:", err.message);
      return new Map();
    });

  if (!atlasProxyConfigured()) {
    await fotosPromise;
    throw new Error(
      "Atlas no configurado: falta SUPABASE_URL o VITE_ATLAS_PROXY_URL"
    );
  }

  const atlas = await fetchReservasAtlas(options);
  return {
    reservas: (atlas.reservas || []).map(mapReservaAtlas).filter(Boolean),
    fotos: await fotosPromise,
    updatedAt: atlas.updated_at ?? null,
    periodo: atlas.periodo ?? null,
    origen: "atlas",
  };
}

const DEFAULT_POLL_MS = 30 * 60 * 1000; // 30 minutos

function readPollMs() {
  const raw = import.meta.env.VITE_CYBER_POLL_MS;
  if (raw == null || raw === "") return DEFAULT_POLL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 5_000 ? n : DEFAULT_POLL_MS;
}

/**
 * Ranking público: API ored + puntos de competencia (Supabase o localStorage).
 * Auto-refresh: polling API + sync remoto de puntos manuales + escucha entre pestañas.
 */
export function useRankingPublico(options = {}) {
  const manualRemote = useCompetenciaManualRemoteSync();
  const [state, setState] = useState({
    status: "loading",
    error: null,
    updatedAt: null,
    periodo: null,
    asesores: [],
    bps: [],
    huerfanos: [],
    scoring: null,
    lastManualSyncAt: null,
  });

  const [reloadKey, setReloadKey] = useState(0);
  const [manualVersion, setManualVersion] = useState(0);
  const reservasRef = useRef([]);
  const fotosRef = useRef(new Map());
  const metaRef = useRef({ updatedAt: null, periodo: null });

  const applyRankingFromCache = useCallback(() => {
    const ranking = buildRankingCompetencia(null, {
      reservas: reservasRef.current,
      fotos: fotosRef.current,
    });
    setState((s) => ({
      ...s,
      status: s.status === "loading" && reservasRef.current.length === 0 ? "loading" : "ready",
      asesores: ranking.asesores,
      bps: ranking.bps,
      huerfanos: ranking.huerfanos,
      scoring: ranking.scoring,
      lastManualSyncAt: Date.now(),
    }));
  }, []);

  useEffect(() => {
    return subscribeCompetenciaManualUpdated(() => {
      setManualVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    if (manualVersion === 0) return;
    applyRankingFromCache();
  }, [manualVersion, applyRankingFromCache]);

  useEffect(() => {
    const ac = new AbortController();
    let isFirst = true;

    const load = () => {
      if (isFirst) {
        setState((s) => ({ ...s, status: "loading", error: null }));
      }

      return cargarReservasYFotos({ ...options, signal: ac.signal })
        .then((resp) => {
          reservasRef.current = resp.reservas;
          fotosRef.current = resp.fotos;
          metaRef.current = { updatedAt: resp.updatedAt, periodo: resp.periodo };
          const ranking = buildRankingCompetencia(null, {
            reservas: resp.reservas,
            fotos: resp.fotos,
          });
          setState({
            status: "ready",
            error: null,
            updatedAt: resp.updatedAt,
            periodo: resp.periodo,
            origen: resp.origen,
            asesores: ranking.asesores,
            bps: ranking.bps,
            huerfanos: ranking.huerfanos,
            scoring: ranking.scoring,
            lastManualSyncAt: Date.now(),
          });
          isFirst = false;
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setState((s) => ({
            ...s,
            status: "error",
            error: err.message ?? String(err),
          }));
        });
    };

    load();

    const pollMs = readPollMs();
    const timer = setInterval(load, pollMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ac.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, options.desde, options.hasta, options.limit]);

  return {
    ...state,
    refetch: () => setReloadKey((k) => k + 1),
    pollIntervalMs: readPollMs(),
    manualRemoteEnabled: manualRemote.enabled,
    manualPollIntervalMs: manualRemote.pollIntervalMs,
  };
}
