# タスクリスト: 初期実装（workspace 構築、エンジン移植、アプリ骨格）

作成日: 2026-09-17
Issue: #2 / ブランチ: `feat/2-initial-implementation` / マイルストーン: v1
design.md の順序で進める。各タスクの完了条件を満たしたら `[x]` にし、数値は記録欄に書く。

## 0. 準備

- [x] 0-1 `main` の最新（PR #3、#5 のマージ後）を `feat/2-initial-implementation` に取り込んでいる
  - 完了条件: `git log` に `c964974`（#3）と `8e3abff`（#5）が含まれる
- [x] 0-2 移植前の基準を再取得して記録する: `prototype/` で `npm test`（37＋1）と `npm run diag:levels`（requirements の基準表と同一）
  - 記録: 37 passed / 1 expected fail。diag:levels は基準表と同一（2026-09-17 16:31）

## 1. workspace のルート

- [x] 1-1 ルート `package.json`（workspaces、展開スクリプト、`engines.node >= 24`）と `tsconfig.base.json`
- [x] 1-2 `eslint.config.js`（engine の `src/**` に `no-restricted-properties`・`no-restricted-globals` の上書き）と `.prettierrc`
- [x] 1-3 `.gitignore` に `coverage/`、`packages/*/dist/` を追加
- [x] 1-4 `.github/workflows/check.yml`
- [x] 1-5 ルートで `npm install` し `package-lock.json` を作る（`packages/*/package-lock.json` は作らない）
  - 完了条件: 空の `packages/engine` と `packages/app` に対して `npm run typecheck`、`npm run lint`、`npm test` が
    エラーなく終わる（`--if-present` で何もしないことを含む）

## 2. `packages/engine` への移植

- [x] 2-1 `packages/engine/package.json`（`@hayakaze/engine`、`exports: ./src/index.ts`、scripts）、`tsconfig.json`
  （`lib: ["ES2022"]`、`types: []`）、`tsconfig.scripts.json`、`vitest.config.ts`
- [x] 2-2 `prototype/src/engine/**` と `prototype/src/data/**` を `git mv` ではなくコピーで `packages/engine/src/` に置く
  （`prototype/` は凍結して残すため）。import パスを直し、**改名せず**に `typecheck` を通す
- [x] 2-3 `prototype/test/**` を `test/calibration/`・`test/determinism/` に、`prototype/scripts/**` を `scripts/` にコピーし、
  import パスを直す
  - 完了条件（改名前の中間確認）: `npm test -w packages/engine` が 37＋1、`diag:levels` が基準表と同一
  - 記録: 37 passed / 1 expected fail。diag:levels は6シード全行が基準表と一致。typecheck・lint 緑。修正した import は teams.ts の config パス1件と、scripts/test のパス。prettier で37ファイルを整形（空白のみ）
- [x] 2-4 型を `src/types/` に分離する（`player.ts`、`club.ts`、`game.ts`、`stats.ts`）。design 2.1 の対応表どおり。
  実装モジュール間の型 import をなくす
- [x] 2-5 `Team` → `Club` 系の改名（design 2.2 の表）。`teams.ts` → `clubs.ts`
  - 完了条件: `grep -rn "Team\b\|teamId\|TEAMS" packages/engine/src packages/engine/test packages/engine/scripts` が 0 件
- [x] 2-6 `src/index.ts` に公開面を作る（design 2.3）
- [x] 2-7 `src/save/serialize.ts`（`SAVE_VERSION = 1`、`serializeSeason`、`deserializeSeason`）と
  `test/unit/save/serialize.test.ts`（30日進めて直列化→復元→残りを進めた結果が通しと完全一致）
- [x] 2-8 `test/determinism/replay.test.ts`（同一シード2回実行で順位表と全成績が一致）
- [x] 2-9 lint の動作確認: `src/rng.ts` に `Math.random()` を1行足して `npm run lint` が失敗することを確認し、戻す
  - 記録: `no-restricted-properties` で「エンジン内では Math.random() を使わず、引数で受け取った Rng を使う」のエラーになり失敗を確認。戻して lint 緑
  - 完了条件（改名後の最終確認）: `npm test -w packages/engine` が 37＋1＋新規（serialize 1、replay 1）、
    `diag:levels` が基準表と同一、`typecheck`（`tsconfig.json` と `tsconfig.scripts.json` の両方）と `lint` が緑
  - 記録: 42 passed / 1 expected fail（37 + serialize 3 + replay 2）。diag:levels の6シード行の md5 は改名前 df695f61… と一致。typecheck 両方・lint 緑。型は types/{player,club,stats,game}.ts に 52 宣言を集約。実装モジュール間の型 import は rng.ts の Rng/RngStreams のみ（設計どおりの例外）

## 3. `packages/app` の骨格

- [x] 3-1 Vite + React 19 + Tailwind v4（`@tailwindcss/vite`）+ React Router（HashRouter）+ Zustand + idb の初期化。
  `vite.config.ts`（`base`、worker）、`index.html`（CSP メタ）、`styles/tailwind.css`
- [x] 3-2 `app/store.ts`、`app/session.ts`（`newGame`、`advanceDay`、`advanceToEnd`、`save`、`load`）
- [x] 3-3 `app/worker.ts`、`app/workerClient.ts`（直列化データの往復、progress）
- [x] 3-4 `app/persistence/indexedDb.ts`（`hayakaze` DB、`saves` ストア、スロット `default`）
- [x] 3-5 `ui/format/`（`fmtRate`、`fmtEra`、`fmtInnings`、`fmtRecord`、`fmtGamesBehind`、`fmtDay`）とテスト
- [x] 3-6 `ui/strings/`（title、dashboard、standings、shell）
- [x] 3-7 画面: `App.tsx`・`routes.tsx`・Shell、`screens/Title`、`screens/Dashboard`、`screens/Standings`、
  `components/`（DataTable、Button、ProgressBar）
- [x] 3-8 `app/session.test.ts`（`fake-indexeddb`。`newGame`→`advanceDay` で 2 日目、`save`→`load` で順位表一致）
- [x] 3-9 ブラウザで手動確認: 新規開始 → 1日進める → 順位表 → 保存 → リロード → ロード → 順位表と現在日が一致。
  「シーズン末まで進める」中に順位表・タイトルへ遷移できる
  - 記録: 手動確認の代わりに Playwright（scratchpad、リポジトリ外）で本番ビルド（`vite preview`）に対して自動確認。
    新規開始 → 1日進める×2（Day 3、試合6件表示）→ 順位表 → 保存 → リロード → ロード → 順位表・Day が保存時と一致。
    「シーズン末まで進める」で進捗バー表示中に順位表へ遷移でき、完走まで 312 ms（UI 込み）。コンソールのエラー・警告ゼロ。
    node 計測: 1日 中央値 0.86 ms（p95 2.5 ms、最大 5.5 ms）、1シーズン 141 ms、セーブ JSON 17.1 MB（打席イベント込み。
    直列化 88 ms、復元 55 ms）。CSP: 本番ビルドは `default-src 'self'; img-src 'self' data:` で `style-src` に `'unsafe-inline'` は不要だった
    （Tailwind v4 の CSS は外部ファイル）。開発サーバーは Fast Refresh のインラインスクリプトのため CSP を掛けていない。
    確認中に見つけた不具合1件を修正: `season` だけを購読するヘッダーが in-place 変更後に再描画されなかった（revision を購読）。
    RTL・jsdom は本作業では未導入（UI テストは書式と session のみ）
  - 完了条件: `npm run build -w packages/app` が成功し、上記の手動確認が通る

## 4. `prototype/` の凍結と文書

- [x] 4-1 `prototype/README.md` と `README.ja.md` に凍結の注記を追加
- [x] 4-2 `docs/repository-structure.md` / `.ja.md` 1.2 の Tailwind 設定ファイルの行を v4 に合わせて修正
- [x] 4-3 `docs/architecture.md` / `.ja.md` 1.2 の Worker の行に「状態は直列化して往復（初期実装時点）」を追記
- [x] 4-4 `docs/glossary.md` / `.ja.md` に `ClubRecord`、`clubsInLeague`、`gamesPerClub` を反映
- [x] 4-5 実装中に見つかった文書と実装の食い違いを、この tasklist の「報告」節に列挙し、該当する `docs/` を英日で直す

## 5. CI と最終確認

- [x] 5-1 push して `check.yml` が緑になる
  - 記録（実行 URL）: https://github.com/pn-ap-hayakaze/hayakaze_sim/actions/runs/35197175786（success）
- [x] 5-2 受け入れ条件 1〜12 を requirements.md の番号順に確認し、結果を記録する
  - 記録: 1 ルートで typecheck（エラー0）・lint・test（engine 42+1、app 8）・build すべて成功 ✓／2 37件は全部含まれ 42 passed / 1 expected fail ✓／
    3 diag:levels 6シード行の md5 が移植前後で一致 ✓／4 lib ES2022 のみ、Math.random 挿入で lint 失敗を確認 ✓／
    5 types/ に 52 宣言、実装間の型 import は rng.ts のみ ✓／6 grep 0 件 ✓／7 Playwright で一致を確認 ✓／8 進捗バー表示中に遷移可 ✓／
    9 完走 312 ms（UI 込み）✓／10 CI success ✓／11 凍結注記あり ✓／12 docs 4件を英日同時更新 ✓
- [x] 5-3 報告をまとめる（`diag:levels` の前後対比、テスト件数、実行時間、文書との食い違い）
- [ ] 5-4 PR を作成する（`Closes #2`、テストの証拠、画面のスクリーンショット）。ユーザーの承認後にマージコミットで
  マージし、PR 番号とマージコミットのハッシュをここに記録する
  - 記録:

## 報告（完了時に記入）

- `diag:levels` 前後対比: 6シードすべての行が requirements の基準表と同一（平均 .248 / .316 / .690 / 3.74 / 3.37 / 1.305 / 首位打者 .351 / HR王 33.5 / ERAσ 0.65 / OPSσ .100）
- テスト件数: engine 42 passed / 1 expected fail（プロトタイプ 37 + serialize 3 + replay 2）、app 8 passed
- 実行時間: 1日 中央値 0.86 ms（最大 5.5 ms）、1シーズン 141 ms（node）、Worker 経由の完走 312 ms（UI 込み）、セーブ JSON 17.1 MB
- 文書と実装の食い違い（本作業で直したもの）:
  1. Tailwind v4 は設定を CSS に持つ → repository-structure 1.2 の `tailwind.config.ts, postcss.config.js` を削除（英日）
  2. CSP は `index.html` 固定ではなくビルド時注入。開発サーバーには掛けない → architecture 4.4 を実態に合わせた（英日）
  3. Worker は状態を直列化して往復 → architecture 1.2 に追記（英日）
  4. `gamesPerTeam` の例と用語集の league configuration 行を改名後の識別子に（英日）
- 文書と実装の食い違い（後続作業に残すもの）:
  1. `Club.stadium` は用語集では `ballpark`（球場は架空名にする作業で構造ごと変える）
  2. セーブ JSON は 17.1 MB（設計の見込み 5 MB の3倍、上限 20 MB の設計内）。GM 球団以外の打席イベントを集計して破棄する作業で縮む
  3. `data/clubs.ts` の球団名・球場名は実在ニックネーム流用のまま（決定どおり総入れ替えは別作業）
  4. RTL・jsdom（architecture 1.2 の UI テスト）は未導入。画面のテストを書く作業で入れる
