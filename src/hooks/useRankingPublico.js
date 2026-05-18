import { useEffect, useState } from "react";
import { fetchReservasRanking } from "../api/rankingClient.js";
import { buildRanking } from "../utils/buildRanking.js";

/**
 * Hook autocontenido para el ranking publico: fetch + transform + estado.
 *
 * Sin Supabase, sin auth — solo HTTP al endpoint de ored. Refetch manual via
 * `refetch()`. No hace polling por defecto: el server cachea 60s.
 */
export function useRankingPublico(options = {}) {
  const [state, setState] = useState({
    status: "loading",
    error: null,
    updatedAt: null,
    periodo: null,
    asesores: [],
    bps: [],
    huerfanos: []
  });

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setState((s) => ({ ...s, status: "loading", error: null }));

    fetchReservasRanking({ ...options, signal: ac.signal })
      .then((resp) => {
        const ranking = buildRanking(resp.reservas);
        setState({
          status: "ready",
          error: null,
          updatedAt: resp.updated_at,
          periodo: resp.periodo,
          asesores: ranking.asesores,
          bps: ranking.bps,
          huerfanos: ranking.huerfanos
        });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState((s) => ({ ...s, status: "error", error: err.message ?? String(err) }));
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, options.desde, options.hasta, options.limit]);

  return {
    ...state,
    refetch: () => setReloadKey((k) => k + 1)
  };
}
