# Development Guidelines

| | |
|---|---|
| Document | `docs/development-guidelines.md` (Japanese: `docs/development-guidelines.ja.md`) |
| Status | Draft v0.1, 2026-09-17, awaiting approval |
| Scope | Coding, naming, styling, testing and Git conventions. Tooling is in `architecture.md`; placement in `repository-structure.md`; terms in `glossary.md` |

## 1. Coding Conventions

### 1.1 TypeScript

- `strict` everywhere. No `any`; use `unknown` and narrow. No non-null assertions (`!`) outside tests, except on `Map.get`
  immediately after a guaranteed `set`, with a comment.
- Prefer `interface` for object shapes and `type` for unions, tuples and mapped types.
- `readonly` on arrays and fields the function does not mutate; `as const` for literal tables such as `POSITIONS`.
- Explicit return types on exported functions.
- ES modules with `.js` extensions in relative imports (matches the prototype and Node ESM resolution).
- Named exports only; no default exports outside React lazy-loaded screens.
- Functions over classes. The only class in the engine is `Rng`.
- No `enum`; use string-literal unions (`'ACTIVE' | 'FARM' | 'INJURED'`), which serialise as-is.

### 1.2 Engine rules (see `architecture.md` 4.1)

- Every probabilistic function takes an `Rng` parameter. Never create an `Rng` inside a function that receives one.
- Decision functions take a `RatingsView`; only `sim/` and `player/` read `player.ratings`.
- Pure functions: take data, return data. Mutation is allowed only on the `Game` object passed to a command, and the
  command's name says so (`applyResult`, `advanceOneDay`).
- Calibrated constants: `UPPER_SNAKE_CASE`, exported from the module that uses them, with a doc comment that states the
  value's reason and the measurement behind it (see `season.ts` `FATIGUE_PER_APPEARANCE` in the prototype).
- Never compute a residual probability inside a profile; normalise exactly once in `combine()`.
- Throw `Error` with a Japanese message for programmer errors (invalid config, unknown id). Return a `Refusal` object,
  not an exception, for rule violations the user can cause (quota, 10-day rule).

### 1.3 Comments

- Comments follow the language of the file. Engine code carried from the prototype is commented in Japanese; new
  engine and app code continues in Japanese for consistency within `src/`.
- A comment explains **why**, a measured number, or a trap, never what the code plainly does.
- Doc comments (`/** */`) on every exported symbol.

### 1.4 React and application layer

- Function components with hooks; no class components.
- Screens read from the Zustand store with selectors; they never hold engine objects in local state.
- All engine access goes through `app/session.ts`. Components never import `@hayakaze/engine` directly except for types.
- Long-running commands go to the worker; the store shows progress.
- Lists over 200 rows use the shared virtualised `DataTable`.
- No `useEffect` for derived data; derive in selectors or `useMemo`.

## 2. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files (engine, app logic) | `camelCase.ts` | `runExpectancy.ts`, `workerClient.ts` |
| React components and their files | `PascalCase.tsx` | `PercentileBar.tsx` |
| Screen folders | `PascalCase/` with `index.tsx` | `ui/screens/PlayerPage/` |
| Types and interfaces | `PascalCase`, no `I` prefix | `Player`, `LeagueConfig` |
| Functions and variables | `camelCase`, verb-first for functions | `advanceOneDay`, `gamesPerClub` |
| Booleans | `is`/`has`/`can` prefix | `isSeasonOver`, `canRegister` |
| Constants | `UPPER_SNAKE_CASE` | `LEAGUE_AVERAGE`, `CLUTCH_GAIN_PER_10` |
| String-literal union members | `UPPER_SNAKE_CASE` | `'EARLY_SUSTAINED'`, `'FOREIGN_EXEMPT'` |
| Ids | `<entity>Id` | `playerId`, `clubId`, `gameId` |
| Maps | plural noun or `<value>By<Key>` | `players`, `scheduleByDay` |
| Test files | `<module>.test.ts` mirroring `src/` | `test/unit/sim/game.test.ts` |
| Steering directories | `YYYYMMDD-<kind>-<title>` | `20260916-fix-prototype-recalibration` |

Domain terms use the English forms fixed in `glossary.md` (e.g. `meet`, `deactivate`, `controlled`, `active`,
`farm`, `foreignStatus`); do not invent synonyms.

Baseball abbreviations in code follow common sabermetric usage: `pa`, `ab`, `h`, `hr`, `bb`, `so`, `sb`, `cs`, `ip`,
`er`, `woba`, `wrcPlus`, `fip`, `war`. Innings are stored as `outs`, never as a decimal.

## 3. Styling Conventions

- Tailwind utility classes in JSX; no per-component CSS files. Shared patterns become components, not `@apply` classes,
  except for a small set of design tokens in `styles/tailwind.css`.
- Design tokens: a neutral palette with one accent for the GM's club; semantic colours for good / average / poor used
  consistently in percentile bars and rating cells.
- Numbers are right-aligned in monospace tabular figures (`tabular-nums`).
- NPB formatting rules (`ui/format/`): batting average and rates as `.285` (no leading zero, three decimals); ERA as
  `2.85`; innings as `123.1`; dates as `6月12日`; win–loss–tie as `45-30-3`; games behind as `2.5` or `—` for the leader.
- Uncertainty is shown by type weight or opacity, never by a number (product requirement 7.4).
- Every interactive element is keyboard-reachable; tables have a caption or `aria-label`; contrast meets WCAG AA.
- Layout must not break at 768 px; wider screens gain columns, not larger type.
- No animation on data updates other than a short fade; the daily tick must feel instant.

## 4. Testing Conventions

### 4.1 Levels

| Level | Location | What it asserts |
|---|---|---|
| Unit | `engine/test/unit/**` | One function or module; deterministic inputs, fixed `Rng` seeds |
| Calibration | `engine/test/calibration/**` | League level, usage, injuries, development and draft targets over six fixed seeds `[20260915, 1, 2, 3, 4, 5]`; two-tier tolerance (mean inside target, each seed inside target ± tolerance) |
| Determinism | `engine/test/determinism/**` | Per-game RNG independence, serialize/restore, replay hash |
| Save migration | `engine/test/unit/save/**` with `fixtures/saves/v<N>/` | Every released version loads and migrates |
| Component | `app/src/**/*.test.tsx` | Screen behaviour with React Testing Library against a fixture `Game` |
| End-to-end (pre-release) | `app/e2e/` | New game → advance a week → save → reload → load |

### 4.2 Rules

- **Calibration tests are the definition of done** for any change to a calibrated constant or mechanic. A PR that moves
  a constant includes the before/after table in its steering `tasklist.md`.
- **Known failures are registered, not skipped**: use `it.fails` with a comment naming the steering work that will fix
  it (the prototype's steal-attempt test is the model). Never `it.skip` a calibration assert.
- Tests never call `Math.random`; they construct `Rng` with fixed seeds.
- One behaviour per `it`; the name states the expectation in plain language (Japanese is fine, matching the prototype).
- Fixtures are data files, not builders with hidden randomness.
- Diagnostics (`scripts/`) are not tests. When a diagnostic reveals a target, add an assert.
- Component tests assert visible text and roles, not implementation details.
- The full engine suite must run under 60 s; put anything slower behind an explicit `npm run test:slow`.

## 5. Git Conventions

### 5.1 Issues, milestones and branches

- **One steering work unit = one issue = one branch = one pull request.**
- Milestones are release versions (`v1`, …). Every issue belongs to the milestone of the release scope it serves.
- The issue is created when the steering directory is created: title = steering title, label = kind (`feat`, `fix`,
  `rfct`, `rule`, `docs`), body links to the steering directory. `requirements.md` records `Issue: #N` in its header.
- `main` is always deployable; CI must be green.
- Branches are named `<kind>/<issue number>-<short-title>`: `feat/2-initial-implementation`, `fix/7-steal-attempts`,
  `rule/1-branch-and-issues`. All work of the unit, including its steering documents, is committed on the branch.
- Merge to `main` through a pull request with a **merge commit** (never squash or rebase, so the commit hashes recorded
  in `tasklist.md` remain valid) after the steering tasklist is complete and the user has approved.
- Exception: changes that need no steering (memory notes, typo fixes in documents) may be committed directly to `main`.

### 5.2 Commits

- Message language: **Japanese** (matches the existing history). Subject line ≤ 50 characters, imperative mood, no
  trailing period; body explains why and lists what changed with hyphens.
- One logical change per commit. Documents and their Japanese twins are committed together. Calibration changes commit
  the constant change, the tests and the README table together.
- Commit only when the user asks or approves; never commit `.claude/settings.local.json` or generated output.
- Trailer on every commit made with the assistant:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

### 5.3 Pull requests

- One per steering work unit, from its branch to `main`.
- Title in Japanese; body starts with `Closes #N`, then lists the steering directory, the summary of changes, the test
  evidence (which asserts, which diag tables), and screenshots for UI changes.
- Merged only after the user approves, with a merge commit. The PR number is recorded in `tasklist.md`.
- End the body with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 5.4 Steering and documents

- A work unit starts with an issue and a branch, then `.steering/YYYYMMDD-<kind>-<title>/requirements.md`, then
  `design.md`, then `tasklist.md`, each approved before the next.
- `tasklist.md` is updated as tasks finish; the final items record the commit hashes and the PR number.
- When a change alters a permanent decision, the `docs/` file and its `.ja.md` twin are updated in the same work unit,
  and the memory notes are updated if the decision is one the assistant relies on.

## 6. Checklist Before Asking for Approval

1. `npm run typecheck`, `npm run lint`, `npm test` pass in every touched package.
2. Calibration tables in the steering `tasklist.md` are filled in if a constant moved.
3. English and Japanese documents have the same section structure (`grep -c '^#'` matches).
4. No `Math.random`, `Date.now`, DOM globals or `player.ratings` reads outside the allowed modules (lint is green).
5. New UI text lives in `strings/`; numbers use `ui/format/`.
6. The steering `tasklist.md` reflects reality, including anything left undone.
