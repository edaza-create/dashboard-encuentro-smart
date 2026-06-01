# Repositorios

Este proyecto se desarrolla en dos remotos Git:

| Remote | URL | Uso |
|--------|-----|-----|
| `origin` | [vpedrerop/dashboard-encuentro-smart](https://github.com/vpedrerop/dashboard-encuentro-smart) | Repo principal / historial |
| `edaza` | [edaza-create/dashboard-encuentro-smart](https://github.com/edaza-create/dashboard-encuentro-smart) | **Deploy mirror** (Vercel: dashboard-encuentro-smart.vercel.app) |

Rama de trabajo: **`feat/ranking-publico-cyber`** (default en el mirror edaza).

## Sincronizar desde el mirror edaza

```bash
git fetch edaza feat/ranking-publico-cyber
git merge edaza/feat/ranking-publico-cyber
```

## Publicar al mirror (deploy)

```bash
git push edaza feat/ranking-publico-cyber
```

## Datos del ranking Cyber

| Fuente | Comando / archivo |
|--------|-------------------|
| Roster BPs (planilla visual) | `src/data/roster-bp-grupos.mjs` → `pnpm run apply:roster` |
| Mapeo email → BP | `src/data/asesores-bp.json` |
| API reservas (ored) | `pnpm run export:cyber` → `exports/cyber-snapshot.json` |
| Env público /cyber | `.env.example` (copiar a `.env.local`) |
