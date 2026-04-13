# DEPLOY TRUTH — read first

**This repo is NOT the production deploy source for `yardscoring.com`.**

The live YardScore web app is built from `yardscore-ops/apps/web/`, alongside
the FastAPI in `yardscore-ops/apps/api/`. Deploy is `make deploy` from
`yardscore-ops`.

## Why this matters

If you change a file in this repo expecting it to ship to `yardscoring.com`,
**it will not.** Three sprints' worth of UI work landed here in April 2026
without ever reaching production for exactly this reason.

## What this repo IS

- A standalone Next.js scaffold and canon staging area
- A reference implementation that the deploy tree (`yardscore-ops/apps/web/`)
  may diverge from
- A future destination if/when repo convergence happens

## What this repo IS NOT (today)

- The production deploy source
- The single source of truth for live UI behavior

## Doing UI work that needs to ship

1. Mirror the change into `yardscore-ops/apps/web/` (carefully — the trees
   have diverged).
2. Run `make deploy` from `yardscore-ops`.
3. Smoke-test against `https://yardscoring.com`.

## Owed follow-up

The repo convergence initiative is tracked at
`drewhenry/initiatives/yardscore-repo-convergence.json`. Until that lands,
treat this repo as canon-only and `yardscore-ops/apps/web/` as production.
