# Architecture (Technical Specification)

| | |
|---|---|
| Document | `docs/architecture.md` (Japanese: `docs/architecture.ja.md`) |
| Status | Draft v0.1, 2026-09-17, awaiting approval |
| Scope | Technology stack, development tools and methods, technical constraints, performance requirements. What the system does is in `product-requirements.md`; how features work is in `functional-design.md` |

## 1. Technology Stack

### 1.1 Decisions already fixed

| Area | Choice | Reason |
|---|---|---|
| Language | TypeScript 5.x, `strict` | Shared by engine, application and UI; the prototype is already TypeScript |
| UI | React 19 | Component model for many data-dense screens; wide ecosystem |
| Build | Vite | Fast dev server, static output for GitHub Pages, first-class Web Worker and TypeScript support |
| Styling | Tailwind CSS | The project's shared design system (CLAUDE.md); utility classes keep data tables consistent |
| Deployment | Static site on GitHub Pages | No backend, free hosting (product requirement) |
| Desktop (later) | Tauri | Wraps the same static build; requires that the engine and application never touch Node or DOM APIs |
| Tests | Vitest | Already used by the prototype's calibration tests |
| Runtime for tools | Node.js 24 LTS, npm | Present on the development machine; CI uses the same major version |

### 1.2 Proposed additions

| Area | Choice | Reason and alternatives |
|---|---|---|
| Package layout | npm workspaces: `packages/engine`, `packages/app` | The engine's `tsconfig` has `lib: ["ES2022"]` only (no DOM), so UI or browser dependencies cannot leak into it by accident. A single package would rely on discipline alone |
| Application state | Zustand | One store holding the `GameSession` and view state; small API, no boilerplate, works outside React components (worker messages). Alternatives: Redux Toolkit (heavier), React context + reducer (re-render cost on large state) |
| Routing | React Router in hash mode | GitHub Pages serves no SPA fallback; hash URLs avoid 404s on reload without a `404.html` copy trick |
| Persistence | IndexedDB through the `idb` wrapper | Save files of tens of MB exceed `localStorage`; `idb` gives typed promises over the raw API |
| Save compression | `CompressionStream` (gzip) for exported files | Built into browsers; no dependency. In-browser saves stay uncompressed for speed |
| Schema validation | Zod | Validates imported JSON and loaded saves; produces path-qualified error messages for the import screen |
| Worker bridge | Plain `postMessage` with a typed message union | Long simulations (`advanceTo`) run in a Web Worker; a library (Comlink) is unnecessary for a handful of message types. In the initial implementation the state is serialised (save format) and sent to the worker and back; the worker does not hold state between commands |
| Lint / format | ESLint (typescript-eslint) + Prettier | Enforces the engine restrictions below (no `Math.random`, no DOM globals) as lint rules |
| UI tests | React Testing Library; Playwright smoke test later | Component behaviour; one end-to-end "new game → advance a week → save → load" check before release |
| CI | GitHub Actions | typecheck, lint, test, build on every push; deploy to Pages from `main` |

## 2. Structure

```mermaid
graph LR
    subgraph engine["packages/engine  (lib: ES2022, no DOM)"]
        E[league / sim / player / roster / scouting / draft / ai / metrics / save]
    end
    subgraph app["packages/app  (React, Vite)"]
        W[worker.ts<br/>runs engine commands]
        S[store (Zustand)<br/>GameSession, views]
        U[ui/ screens and components]
        P[persistence<br/>IndexedDB, export/import]
    end
    U --> S
    S <--> W
    W --> E
    S --> E
    S --> P
```

- `packages/engine` depends on nothing at runtime. Its tests are the calibration suite and unit tests.
- `packages/app` depends on `engine` via the workspace. The main thread uses the engine directly for queries and
  single-day ticks; the worker runs multi-day advances and reports progress.
- The prototype under `prototype/` remains as the reference until its mechanics and tests have been ported into
  `packages/engine`; it is then deleted (see `repository-structure.md`).

## 3. Development Tools and Methods

### 3.1 Commands (both packages unless noted)

| Command | Purpose |
|---|---|
| `npm run dev` (app) | Vite dev server |
| `npm run build` (app) | Production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier check |
| `npm test` | Vitest; in `engine` this includes the six-seed calibration asserts |
| `npm run diag*` (engine) | Headless diagnostics carried from the prototype (levels, usage, fatigue, bullpen, clutch) |
| `npm run validate` (engine) | One season printed for human inspection |

### 3.2 Method

- **Steering per work unit** (CLAUDE.md): requirements → design → tasklist under `.steering/`, each approved before the
  next; permanent documents updated only on design changes.
- **Calibration as tests.** Any change to `SLOPE`, the anchor, fatigue, injury or AI constants must keep `npm test`
  green; the targets live in `product-requirements.md` section 7. New mechanics gain their own asserted targets before
  they are tuned.
- **Headless first.** Every feature is implemented and tested in `engine` before a screen is built for it.
- **Determinism checks.** A test replays a saved seed and compares a season's standings hash across runs.
- **Documentation in English with Japanese twins**, updated in the same commit.

### 3.3 Conventions

Coding, naming, styling, testing and Git conventions are in `development-guidelines.md`.

## 4. Technical Constraints

### 4.1 Engine restrictions (enforced by tsconfig and lint)

| Constraint | Enforcement |
|---|---|
| No DOM, no Node APIs | `lib: ["ES2022"]`, no `@types/node` in `engine` runtime code (scripts have their own tsconfig) |
| No `Math.random()` | ESLint `no-restricted-properties`; all randomness through injected `Rng` |
| No `Date.now()` or wall-clock reads | Same rule; the calendar is game data |
| No global mutable state | Functions take and return data; the `Game` object is the only state |
| Decision functions take a `RatingsView` | Type signature; a lint rule flags `player.ratings` access outside `sim/` and `player/` |
| Serialisable state | Only plain objects, arrays, numbers, strings, booleans, `Map` (converted on save); no class instances except `Rng`, which serialises to a number |

### 4.2 Determinism

- The same master seed, config and command sequence reproduce the same game **on the same JavaScript engine**.
- `Math.log`, `Math.cos`, `Math.exp` are not bit-identical across browsers. Cross-browser identical replays are **not**
  a requirement; a save carries its state, not a replay log. If exact cross-engine reproducibility becomes a requirement,
  the normal and exponential samplers in `rng.ts` are the only places to replace.
- Iteration order over `Map` is insertion order and is relied upon; object key order is not.

### 4.3 Browser and storage

- Supported: current and previous major versions of Chrome, Edge, Firefox and Safari (desktop); mobile is not a target
  for v1 but layouts must not break at 768 px.
- Storage: IndexedDB with a per-origin quota; a save slot is designed to stay under about 20 MB (functional design
  section 4.3), and the app warns when total usage exceeds half the quota reported by `navigator.storage.estimate()`.
- No network access after the initial load; no analytics, no external fonts or CDNs (self-hosted assets only).

### 4.4 Security

- Imported files and loaded saves are parsed as JSON and validated with Zod before any use; a failed validation rejects
  the whole file with path-qualified messages.
- All user- or file-supplied strings are rendered as text (React escaping); no `dangerouslySetInnerHTML`, no `eval`,
  no dynamic `Function`.
- Content Security Policy `default-src 'self'; img-src 'self' data:` is injected into `index.html` by a Vite plugin **at build time only**. The dev server has no CSP because React Fast Refresh needs an inline script. The production build has no inline scripts or styles (Tailwind v4 emits a CSS file), so no `'unsafe-inline'` is needed.
- Nothing is sent anywhere; there are no credentials.

### 4.5 Save format

- Versioned JSON (`version` integer). Loading runs migrations `n → n+1` in sequence; every migration has a test with a
  fixture saved by the previous version.
- Exports are gzip-compressed with the `.hayakaze.json.gz` extension; the import screen accepts both compressed and
  plain files.

### 4.6 Rights and content

- No real player names, NPB club nicknames or ballpark names in the repository or the build; name pools are checked by a
  test against a denylist of real nicknames.
- Real city names only.

## 5. Performance Requirements

Measured on a typical laptop (4 cores, 8 GB) in Chrome; the prototype's figures are the baseline.

| Item | Requirement | Baseline / note |
|---|---|---|
| One regular-season day (6 games + estimates + AI) | < 100 ms on the main thread | Prototype: 0.15 ms per game; the added cost is estimate updates and AI decisions |
| Headless full regular season (858 games) | < 5 s in the worker | Prototype: about 130 ms for games only |
| Multi-season advance | Progress reported at least every 500 ms; UI stays interactive | Worker |
| Screen interaction (open a player page, sort a table) | < 100 ms | Virtualised tables above 200 rows |
| Initial load | < 3 s on a 10 Mbit/s connection; JS bundle < 1 MB gzipped | Code-split the draft and stats screens |
| Save to IndexedDB | < 2 s for a 20-season game | Off the main thread where the API allows |
| Export / import | < 5 s including gzip | `CompressionStream` |
| Memory | < 500 MB heap for a 20-season game | PA events pruned per functional design 4.3 |
| Calibration test suite | < 60 s locally and in CI | Six seasons per assert group |

## 6. Deferred Technical Decisions

- Whether to adopt a virtualised table library or write a minimal one.
- Playwright end-to-end tests: introduce before the first public release, not in the initial implementation.
- Tauri packaging details (file dialogs for save export, auto-update) when the desktop phase starts.
- Whether to add deterministic math (fixed-point or table-based samplers) if cross-browser identical replays are ever
  required.
