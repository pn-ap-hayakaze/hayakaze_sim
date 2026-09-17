# Repository Structure

| | |
|---|---|
| Document | `docs/repository-structure.md` (Japanese: `docs/repository-structure.ja.md`) |
| Status | Draft v0.1, 2026-09-17, awaiting approval |
| Scope | Folder and file layout, the role of each directory, placement rules, and the migration path from `prototype/` |

## 1. Target Layout

```
hayakaze_sim/
├── CLAUDE.md, CLAUDE.ja.md          project rules (auto-loaded: English only)
├── README.md, README.ja.md          project overview, how to run
├── docs/                            permanent documents (English + .ja.md twins)
├── .steering/                       work-unit documents, one directory per piece of work
├── .github/workflows/               CI: check.yml (typecheck, lint, test, build), deploy.yml (Pages)
├── package.json                     npm workspaces root; shared scripts
├── tsconfig.base.json               shared compiler options (strict); packages extend it
├── eslint.config.js, .prettierrc    lint and format for all packages
├── packages/
│   ├── engine/                      pure simulation engine (no DOM, no Node at runtime)
│   └── app/                         React application (Vite)
└── prototype/                       reference implementation; deleted after migration (section 4)
```

### 1.1 `packages/engine`

```
packages/engine/
├── package.json                     name: @hayakaze/engine; scripts: test, typecheck, lint, diag*, validate
├── tsconfig.json                    lib: ["ES2022"] only
├── tsconfig.scripts.json            adds Node types for scripts/ only
├── vitest.config.ts
├── src/
│   ├── index.ts                     public surface (functional design 8.1); the app imports only from here
│   ├── rng.ts                       Rng, deriveSeed, RNG_PURPOSE, RngStreams
│   ├── types/                       shared data types with no logic
│   │   ├── game.ts                  Game, Calendar, SaveFile
│   │   ├── player.ts                Player, Ratings, Caps, GrowthProfile, HiddenTraits, HealthState, RosterStatus
│   │   ├── club.ts                  Club, Ballpark, Scout, Policy
│   │   ├── estimate.ts              Estimate, RatingsView, ScoutReport
│   │   └── stats.ts                 BattingStats, PitchingStats, PlateAppearanceEvent
│   ├── league/                      config, schedule, calendar, season (daily tick), standings, postseason
│   ├── sim/                         oddsRatio, profile, game, fatigue, events
│   ├── player/                      arsenal, clutch, generate, development, aging, injury
│   ├── roster/                      rules, moves, farm, retirement
│   ├── scouting/                    estimate, scouts, public, reveal, views
│   ├── draft/                       class, order, bidding, lottery, aiBid
│   ├── ai/                          manager, clubGm
│   ├── metrics/                     runExpectancy, advanced, percentile, leagueLevel, clutchAnalysis
│   ├── save/                        serialize, migrate/, import
│   └── data/                        cities, namePools, nicknameDenylist, npbDefaultConfig
├── scripts/                         headless diagnostics (validate, diag-*), run with tsx
└── test/
    ├── calibration/                 league level, usage, injuries, development, draft (asserted targets)
    ├── determinism/                 rng independence, replay hash, serialize/restore
    ├── unit/                        per-module unit tests, mirrors src/ layout
    └── fixtures/                    saved games per save version, import samples
```

### 1.2 `packages/app`

```
packages/app/
├── package.json                     name: @hayakaze/app; scripts: dev, build, preview, test, typecheck, lint
├── index.html                       CSP meta, root element
├── vite.config.ts                   base path for GitHub Pages, worker config
├── public/                          favicon, fonts (self-hosted)
└── src/
    ├── main.tsx                     entry; mounts <App/>
    ├── app/                         application layer
    │   ├── session.ts               GameSession: commands and queries over engine
    │   ├── store.ts                 Zustand store
    │   ├── worker.ts                Web Worker entry: runs multi-day advances
    │   ├── workerClient.ts          typed postMessage bridge
    │   ├── views.ts                 display objects (20–80, exact, public) from estimates
    │   └── persistence/             indexedDb.ts, exportFile.ts, importFile.ts
    ├── ui/
    │   ├── App.tsx, routes.tsx      shell and hash routes
    │   ├── screens/                 one folder per screen: Title, Dashboard, Standings, Roster, PlayerPage,
    │   │                            Stats, Scouting, Draft, Policy, SaveLoad
    │   ├── components/              shared: DataTable, PercentileBar, RatingCell, GradeCell, Dialog, ...
    │   ├── format/                  number and date formatting (打率 .285, 防御率 2.85, 6月12日)
    │   └── strings/                 UI text (Japanese), one module per screen
    └── styles/                      tailwind.css (Tailwind v4: `@import` and `@theme` tokens; no tailwind.config / postcss.config)
```

## 2. Role of Each Directory

| Directory | Role | Owns | Must not contain |
|---|---|---|---|
| `docs/` | Permanent design ("what" and "how it is built") | Six documents + Japanese twins, `images/` if ever needed | Work logs, task lists, code |
| `.steering/` | Work-unit records | `YYYYMMDD-title/requirements.md, design.md, tasklist.md` | Permanent decisions (those go to `docs/`) |
| `packages/engine/src` | Simulation, rules, AI, metrics, persistence format | Pure functions over data | DOM, React, Node, `Math.random`, wall-clock |
| `packages/engine/scripts` | Human-readable diagnostics | Console output | Logic that tests depend on (put it in `src/`, import it) |
| `packages/engine/test` | Asserted behaviour and calibration | Vitest suites, fixtures | Anything the app imports |
| `packages/app/src/app` | Application layer | Session, store, worker, persistence, view construction | JSX, screen-specific logic |
| `packages/app/src/ui` | Presentation | Screens, components, formatting, strings | Engine calls (go through `app/session.ts`), direct storage access |
| `packages/engine/src/data` | Static data | Cities, name pools, default config, denylist | Anything derived at runtime |
| `prototype/` | Reference until migration completes | Frozen; no new features | — |

## 3. Placement Rules

1. **Types with no logic live in `engine/src/types/`.** Modules import types from there, never from each other's
   implementation files, to avoid cycles.
2. **The app imports the engine only through `@hayakaze/engine`** (its `index.ts`). Deep imports are blocked by the
   package `exports` field.
3. **Decision code goes to `ai/`, rule code to `roster/rules.ts`, simulation to `sim/`.** A function that reads
   `player.ratings` directly may live only under `sim/` or `player/`; everything else takes a `RatingsView`.
4. **One screen, one folder** under `ui/screens/<Name>/` with `index.tsx`, its sub-components and its `strings.ts`.
   Components used by two or more screens move to `ui/components/`.
5. **UI text is never inline.** It comes from `ui/strings/` (or the screen's `strings.ts`) so wording can be reviewed
   and changed in one place.
6. **Constants that calibrate behaviour** (`SLOPE`, anchor, fatigue and injury coefficients, AI thresholds) are
   exported from the module that uses them, named in `UPPER_SNAKE_CASE`, documented with the reason for the value, and
   covered by a calibration test.
7. **Tests mirror `src/`**: `test/unit/sim/game.test.ts` tests `src/sim/game.ts`. Calibration and determinism tests are
   grouped by what they assert, not by module.
8. **Fixtures are versioned**: `test/fixtures/saves/v<N>/*.json` for every save format version ever released.
9. **Diagnostics never duplicate formulas.** A script imports the function it diagnoses (the prototype's
   `diag-fatigue.ts` lesson).
10. **Documents**: English file first, Japanese twin in the same commit, identical section structure. Diagrams inline
    (Mermaid or ASCII); images only under `docs/images/`.
11. **Steering directories** are named `YYYYMMDD-<kind>-<title>` with kind in `feat`, `fix`, `rfct`, `rule`, `docs`.
12. **Generated output** (`dist/`, coverage, `node_modules/`) is never committed; `.gitignore` at the root covers all
    packages.

## 4. Migration from `prototype/`

The prototype is the calibrated reference. It is ported, not rewritten.

| Step | Action | Done when |
|---|---|---|
| 1 | Create the workspace root and `packages/engine` with the shared tsconfig, lint and vitest | `npm test` runs an empty suite in `engine` |
| 2 | Move `prototype/src/engine/**` into `packages/engine/src/**` keeping module names; split types into `types/`; move `prototype/src/data` to `src/data` | `typecheck` passes |
| 3 | Move `prototype/test/**` into `test/calibration` and `test/determinism`; move `prototype/scripts/**` into `scripts/` | `npm test` passes with the same 37 asserts + 1 known failure; `diag:levels` prints the same table for seed 20260915 |
| 4 | Implement v1 features in `engine` per their steering work units | Each work unit's tasklist |
| 5 | Delete `prototype/` and its README; add a note in the root `README.md` pointing to the commit that removed it | No references to `prototype/` remain in `docs/` except this section's history |

Until step 5, `prototype/` is frozen: no new mechanics are added there.

## 5. Root Files

| File | Purpose |
|---|---|
| `package.json` | `workspaces: ["packages/*"]`; root scripts fan out: `npm test -ws`, `npm run typecheck -ws`, `npm run lint -ws` |
| `tsconfig.base.json` | `strict`, `noUnusedLocals`, `noUnusedParameters`, `target ES2022`, `moduleResolution bundler` |
| `eslint.config.js` | typescript-eslint; engine override adds `no-restricted-properties` for `Math.random` and `Date.now`, `no-restricted-globals` for DOM |
| `.prettierrc` | Single quotes, trailing commas, print width 100 |
| `.gitignore` | `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.env*`, `.claude/settings.local.json`, editor folders |
| `.github/workflows/check.yml` | On push and PR: install, typecheck, lint, test, build |
| `.github/workflows/deploy.yml` | On push to `main` after checks: build `packages/app`, deploy to GitHub Pages |
