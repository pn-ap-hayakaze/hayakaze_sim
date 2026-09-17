# 設計: 初期実装（workspace 構築、エンジン移植、アプリ骨格）

作成日: 2026-09-17
Issue: #2 / ブランチ: `feat/2-initial-implementation`
requirements.md の4項目（workspace、engine 移植、app 骨格、prototype 凍結）をこの順で実装する。

## 承認が必要な提案（先に読むこと）

| # | 提案 | 概要 |
|---|---|---|
| A | エンジンはビルドせず TS ソースを直接公開する | `packages/engine/package.json` の `exports` を `./src/index.ts` に向ける。Vite・Vitest・tsx はいずれも TS を直接読めるので、engine に `dist/` とビルド手順を持たない。Tauri 化やライブラリ配布が必要になった時点でビルドを足す |
| B | Worker との状態のやり取りは「直列化して往復」 | `advanceTo` はメインスレッドがセーブ形式と同じ直列化データを Worker に送り、Worker が進めて直列化データを返す。状態を Worker に常駐させる設計より単純で、セーブ形式の検証を兼ねる。1シーズン分（約 5 MB）の往復は 1 秒未満と見込む。後続で重くなれば Worker 常駐に切り替える |
| C | セーブ形式 v1 は `SeasonState` 全体（打席イベント含む） | 機能設計 4.3 の「他球団のイベントは集計して破棄」は GM 球団の概念が入る作業で実装する。v1 は忠実な往復（ロード後の状態 = 保存時）を優先する。サイズを計測して報告する |
| D | Tailwind CSS は現行メジャー（v4）を採用 | v4 は設定を CSS 側（`@theme`）に持ち `tailwind.config.ts` / `postcss.config.js` を使わない。`repository-structure.md` 1.2 の該当2行を本作業で修正する |
| E | 決定性テストを1件追加する | プロトタイプにない「同一シードの2回実行で順位表と成績のハッシュが一致」を `test/determinism/replay.test.ts` として足す。`architecture.md` 3.2 の要求であり、ゲームの仕組みの追加ではない |

---

## 1. workspace のルート

### ファイル

| ファイル | 内容 |
|---|---|
| `package.json` | `"private": true`、`"workspaces": ["packages/*"]`、`"engines": { "node": ">=24" }`。スクリプト: `typecheck` `lint` `test` は `npm run <x> --workspaces --if-present`、`build` は `npm run build -w packages/app`、`format` は `prettier --write .` |
| `tsconfig.base.json` | プロトタイプの `tsconfig.json` の compilerOptions を継承元にする: `strict`、`noUnusedLocals`、`noUnusedParameters`、`target ES2022`、`module ESNext`、`moduleResolution bundler`、`allowImportingTsExtensions` は外す（`.js` 拡張子 import に統一）、`noEmit`、`skipLibCheck`、`isolatedModules` |
| `eslint.config.js` | flat config。`typescript-eslint` の `recommendedTypeChecked` は重いので `recommended`。engine の `src/**` にだけ以下の上書き: `no-restricted-properties`（`Math.random`、`Date.now`）、`no-restricted-globals`（`window`、`document`、`localStorage`、`sessionStorage`、`indexedDB`、`fetch`、`navigator`、`setTimeout`）。app の `src/ui/**` に `no-restricted-imports`（`@hayakaze/engine/*` の深い import を禁止、`@hayakaze/engine` 本体は型 import のみ許可する規則は後続作業） |
| `.prettierrc` | `singleQuote: true`、`trailingComma: 'all'`、`printWidth: 100` |
| `.gitignore` | 既存に `coverage/`、`packages/*/dist/` を追加 |
| `.github/workflows/check.yml` | `on: [push, pull_request]`。`actions/setup-node@v4` で Node 24、`npm ci`、`npm run typecheck`、`npm run lint`、`npm test`、`npm run build` |

依存（devDependencies、ルート）: `typescript ^5.7`、`eslint ^9`、`typescript-eslint ^8`、`prettier ^3`、`vitest ^5`、`tsx ^4`。
バージョンは `npm install` 時点の最新マイナーを取り、`package-lock.json` をコミットする。

---

## 2. `packages/engine`

### 2.1 ファイル対応表（移植）

| プロトタイプ | engine | 変更 |
|---|---|---|
| `src/engine/rng.ts` | `src/rng.ts` | なし |
| `src/engine/player/ratings.ts` | `src/types/player.ts` + `src/player/ratings.ts` | 型と定数配列（`POSITIONS`、`LINEUP_SLOTS`、`BREAK_DIRECTIONS`、`Handedness`、`BatSide`、`*Ratings`、`Pitch`、`Player`）を `types/player.ts` へ。関数 `effectiveBatSide`、`meetAgainst`、`powerAgainst` は `player/ratings.ts` に残す |
| `src/engine/player/arsenal.ts` `clutch.ts` `generate.ts` | `src/player/` 同名 | `Roster` 型を `types/game.ts` へ。`Team` → `Club` |
| `src/engine/sim/oddsRatio.ts` | `src/sim/oddsRatio.ts` | `PaOutcome` 型を `types/stats.ts` へ。`LEAGUE_AVERAGE`（較正定数）は残す |
| `src/engine/sim/profile.ts` `game.ts` | `src/sim/` 同名 | `GameResult`、`GameRules`、`PitcherCondition` を `types/game.ts` へ。`ALL_FRESH` は `game.ts` に残す |
| `src/engine/sim/stats.ts` | `src/types/stats.ts` + `src/sim/stats.ts` | `BattingStats`、`PitchingStats` を `types/stats.ts` へ。関数群は `sim/stats.ts` に残す |
| `src/engine/sim/events.ts` | `src/types/stats.ts` + `src/sim/events.ts` | `PlateAppearanceEvent`、`BaseState`、`BASE_*` 定数を `types/stats.ts` へ。`encodeBases`、`baseOutIndex` は `sim/events.ts` |
| `src/engine/league/config.ts` | `src/types/game.ts` + `src/league/config.ts` | `LeagueDefinition`、`LeagueConfig` を型へ。関数は残し `teamsInLeague` → `clubsInLeague`、`gamesPerTeam` → `gamesPerClub` |
| `src/engine/league/schedule.ts` `lineup.ts` `season.ts` | `src/league/` 同名 | `ScheduledGame`、`Lineup`、`Bullpen`、`TeamRecord` → `ClubRecord`、`PitcherFatigue`、`SeasonState`、`SeasonOptions` を `types/game.ts` へ。`dailyRecovery` 等の定数・関数は残す |
| `src/engine/metrics/*.ts` | `src/metrics/` 同名 | `WobaWeights`、`LeagueContext` を `types/stats.ts` へ |
| `src/data/teams.ts` | `src/data/clubs.ts` | `Team` → `Club`、`TEAMS` → `CLUBS`、`LeagueId` を `types/club.ts` へ |
| `src/data/names.ts` | `src/data/names.ts` | なし |
| `test/*.test.ts` | `test/calibration/calibration.test.ts`、`clutch.test.ts`、`positions.test.ts`、`test/determinism/rng.test.ts` | import パスの修正のみ |
| `scripts/*.ts` | `scripts/` 同名 | import パスの修正。`validate.ts` の順位表ループは `clubs` に |

`types/` の方針: **型、リテラル union、`as const` の定数配列のみ**。関数は置かない。`types/estimate.ts` は本作業では作らない
（推定モデルは後続）。

### 2.2 改名の範囲

| 前 | 後 | 備考 |
|---|---|---|
| `Team` / `Roster.team` | `Club` / `Roster.club` | 型とフィールド |
| `teamId` / `homeTeamId` / `awayTeamId` | `clubId` / `homeClubId` / `awayClubId` | `ScheduledGame`、`GameResult`、`ClubRecord`、`Player.teamId` |
| `SeasonState.teams` | `SeasonState.clubs` | `Map<string, Club>` |
| `TEAMS`、`teams.ts` | `CLUBS`、`clubs.ts` | データ |
| `teamsInLeague`、`gamesPerTeam`、`teamById` | `clubsInLeague`、`gamesPerClub`、（削除済み） | 関数 |
| `TeamRecord` | `ClubRecord` | 型 |

改名は `git mv` の後、`grep -rn "Team\|teamId\|TEAMS" packages/engine` がゼロになるまで手で直す。sed による一括置換は
`teamStrength` のような複合語を壊すので使わない。**能力値フィールド・較正定数・関数名（上記以外）は変えない。**

### 2.3 公開面 `src/index.ts`

```ts
// 型
export type * from './types/player.js';
export type * from './types/club.js';
export type * from './types/game.js';
export type * from './types/stats.js';
export { POSITIONS, LINEUP_SLOTS, BREAK_DIRECTIONS } from './types/player.js';
// シーズン進行
export { createSeason, advanceOneDay, advanceToDay, advanceToEnd, isSeasonOver, standings, gamesBehind, winPct } from './league/season.js';
export { leagueOf, clubsInLeague, gamesPerClub } from './league/config.js';
export { NPB_DEFAULT_CONFIG, CLUBS } from './data/clubs.js';
// 成績
export { avg, obp, slg, ops, era, whip, inningsPitched, sumBatting, sumPitching } from './sim/stats.js';
export { leagueLevel } from './metrics/leagueLevel.js';
// 永続化
export { serializeSeason, deserializeSeason, SAVE_VERSION } from './save/serialize.js';
export type { SeasonSave } from './save/serialize.js';
```

`package.json`: `"name": "@hayakaze/engine"`、`"type": "module"`、`"exports": { ".": "./src/index.ts" }`、
`"types": "./src/index.ts"`。深い import はこの `exports` で解決不能になる。

### 2.4 tsconfig

- `tsconfig.json`: `extends ../../tsconfig.base.json`、`lib: ["ES2022"]`、`types: []`、`include: ["src", "test"]`。
  テストは vitest の型（`vitest` パッケージから import）だけで書けるので Node 型は不要
- `tsconfig.scripts.json`: `extends ./tsconfig.json`、`types: ["node"]`、`include: ["scripts", "src"]`。
  `npm run typecheck` は両方を順に走らせる（`tsc -p tsconfig.json && tsc -p tsconfig.scripts.json`）

### 2.5 セーブ形式 v1（`src/save/serialize.ts`）

```ts
export const SAVE_VERSION = 1;
export interface SeasonSave {
  version: 1;
  masterSeed: number;
  year: number;
  config: LeagueConfig;                       // clubs を含む
  rosters: { clubId: string; batters: Player[]; pitchers: Player[] }[];
  schedule: ScheduledGame[];
  currentDay: number;
  lastDay: number;
  records: ClubRecord[];
  battingStats: [string, BattingStats][];
  pitchingStats: [string, PitchingStats][];
  gamesPlayed: [string, number][];
  pitcherFatigue: [string, PitcherFatigue][];
  results: SerializedGameResult[];            // Map を配列にした GameResult。events を含む
}
export function serializeSeason(season: SeasonState): SeasonSave;
export function deserializeSeason(save: SeasonSave): SeasonState;
```

復元時に導出するもの: `streams = createRngStreams(masterSeed)`、`clubs`（config から）、`scheduleByDay`、`players`
（rosters から。同一オブジェクトを共有させる）、`Roster.club`（config の Club を参照）。試合用乱数は
`game(year, day, gameId)` で状態を持たないので、`Rng` の状態は保存しない。

テスト `test/unit/save/serialize.test.ts`: シード 20260915 で 30 日進めて直列化 → 復元 → 残りを進めた最終順位表・
成績が、直列化せずに通しで進めた結果と**完全一致**する。これが「ロードで引き直せない」ことの証明になる。

### 2.6 決定性テストの追加（提案 E）

`test/determinism/replay.test.ts`: `createSeason(20260915)` を2回作り `advanceToEnd`、順位表と全選手の打撃・投球成績を
JSON 化して比較。一致すること。

---

## 3. `packages/app`

### 3.1 依存

`react ^19`、`react-dom ^19`、`react-router ^7`（`HashRouter`）、`zustand ^5`、`idb ^8`。
devDependencies: `vite`、`@vitejs/plugin-react`、`tailwindcss ^4`、`@tailwindcss/vite`、`@testing-library/react`、
`@testing-library/jest-dom`、`jsdom`、`@types/react`、`@types/react-dom`。

`vite.config.ts`: `base: '/hayakaze_sim/'`（GitHub Pages のリポジトリパス。環境変数で上書き可）、`plugins: [react(), tailwindcss()]`、
`worker: { format: 'es' }`。`index.html` に `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'">`
（Vite の開発サーバーはインラインスタイルを使うため `style-src` に `'unsafe-inline'` が要る。本番ビルドで外せるかは実装時に確認して記録する）。

### 3.2 アプリケーション層

```
src/app/
  session.ts        newGame(seed) / advanceDay() / advanceToEnd() / save() / load()。engine を呼ぶ唯一の場所
  store.ts          Zustand: { season, todayResults, running: { active, day, lastDay } | null, error }
  worker.ts         onmessage({ type: 'advanceToEnd', save }) → 進行しながら { type: 'progress', day } を送り、
                    終了時 { type: 'done', save } を返す
  workerClient.ts   Promise で包む。progress コールバックを受ける
  persistence/indexedDb.ts   openDB('hayakaze', 1) / put('saves', slot 'default', { version, savedAt, save }) / get
```

- `advanceDay` はメインスレッドで `advanceOneDay` を直接呼ぶ（1日 < 100 ms の要件をまず実測する）
- `advanceToEnd` は `serializeSeason` → Worker → `deserializeSeason`（提案 B）。実行中は `running` が真で、Dashboard は
  進捗バーを出し、ナビゲーションは可能
- `save` / `load` は IndexedDB のスロット `default` 1つ。`savedAt` は `new Date().toISOString()`（app 層なので許可）

### 3.3 UI

```
src/ui/
  App.tsx            HashRouter。Shell（ヘッダ: 年・日・フェーズ、ナビ: ダッシュボード / 順位表 / タイトル）
  routes.tsx         '/' Title、'/dashboard' Dashboard、'/standings' Standings
  screens/Title/     シード入力（既定 20260915）、[新規開始]、[ロード]（保存があるときのみ有効）
  screens/Dashboard/ 日付、今日の試合結果一覧（球団略称と得点、延長なら回数、引き分け表示）、
                     [1日進める] [シーズン末まで進める] [保存]。進行中は進捗バー
  screens/Standings/ リーグごとの表: 順位 球団 試合 勝 敗 分 勝率 差 得点 失点
  components/        DataTable（仮想化なし。200行未満）、Button、ProgressBar
  format/            fmtRate(.285) fmtEra(2.85) fmtInnings(123.1) fmtRecord(45-30-3) fmtGamesBehind(2.5 / —) fmtDay(Day 78)
  strings/           title.ts dashboard.ts standings.ts shell.ts
styles/tailwind.css  @import "tailwindcss"; @theme { --color-accent: ... } とごく少数のトークン
```

日付は本作業では `Day N` 表示にとどめる（暦の月日はカレンダー機能の作業で）。

### 3.4 テスト

- `src/ui/format/*.test.ts`: 書式関数
- `src/app/session.test.ts`: `newGame` → `advanceDay` で `currentDay` が 2 になる。`save` → `load` で順位表が一致（`fake-indexeddb` を devDependency に追加）
- vitest 環境は `jsdom`。Worker はテストしない（エンドツーエンドは後続）

---

## 4. `prototype/` の凍結

`prototype/README.md` と `README.ja.md` の見出し直下に1段落追加:
「**Frozen (2026-09-17).** The engine, tests and scripts have been ported to `packages/engine`; this directory is kept only as
the calibration reference until `docs/repository-structure.md` section 4 step 5 removes it. Do not add mechanics here.」
（日本語版も同内容）。

---

## 5. 影響範囲

| 対象 | 影響 |
|---|---|
| `docs/repository-structure.md` 1.2 | Tailwind v4 に合わせ `tailwind.config.ts, postcss.config.js` の行を削除し、`styles/tailwind.css` に設定がある旨を追記（英日） |
| `docs/architecture.md` 1.2 | 「Worker との橋渡し」の行に「状態は直列化して往復（初期実装時点）」を追記（英日） |
| `docs/glossary.md` | `ClubRecord`、`clubsInLeague`、`gamesPerClub` を該当行のコード列に反映（英日） |
| `prototype/` | README の凍結注記のみ |
| メモリ | 完了時に「初期実装完了、次は登録・抹消の steering」へ更新 |

## 6. リスクと対処

| リスク | 対処 |
|---|---|
| 改名で較正テストが別物になる（例: 順位表のフィルタが `league` を見失う） | 移植直後・改名前に一度 `npm test` と `diag:levels` を通し、改名後にもう一度通す。2段階で確認する |
| `.js` 拡張子 import が Vite の workspace 解決で失敗する | `moduleResolution: bundler` と Vite の既定で解決できる。失敗したら `resolve.alias` で `@hayakaze/engine` を `src/index.ts` に直接向ける |
| 直列化データのサイズが想定より大きく Worker 往復が遅い | 計測して 1 秒を超えるなら `results` の `events` を Worker 往復からだけ除く（セーブには残す）。それでも超えるなら Worker 常駐へ |
| Tailwind v4 と `@tailwindcss/vite` の組み合わせで CSP が緩む | 本番ビルドの CSS が外部ファイルになることを確認し、`style-src` から `'unsafe-inline'` を外せるか記録する |
| CI の `npm ci` が workspace の lockfile と不整合 | ルートで `npm install` した lockfile のみコミットする。`packages/*/package-lock.json` は作らない |

## 7. 検証手順（完了時）

```bash
npm ci
npm run typecheck && npm run lint && npm test && npm run build
npm run diag:levels -w packages/engine          # requirements の基準表と一致すること
npm run dev -w packages/app                     # 新規開始 → 1日進める → 順位表 → 保存 → リロード → ロード
grep -rn "Team\b\|teamId\|TEAMS" packages/engine/src packages/engine/test packages/engine/scripts   # 0件
```

意図的に `packages/engine/src/rng.ts` に `Math.random()` を1行足して `npm run lint` が失敗することを確認し、戻す（受け入れ条件4）。
