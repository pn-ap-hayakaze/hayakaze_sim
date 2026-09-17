# リポジトリ構成（Repository Structure）

| | |
|---|---|
| 文書 | `docs/repository-structure.ja.md`（英文版: `docs/repository-structure.md`） |
| 状態 | ドラフト v0.1、2026-09-17、承認待ち |
| 範囲 | フォルダとファイルの配置、各ディレクトリの役割、配置規則、`prototype/` からの移行手順 |

## 1. 目標とする配置

```
hayakaze_sim/
├── CLAUDE.md, CLAUDE.ja.md          プロジェクト規則（自動読み込みは英文のみ）
├── README.md, README.ja.md          プロジェクト概要、実行方法
├── docs/                            永続文書（英文 + .ja.md の対）
├── .steering/                       作業単位の文書。作業ごとに1ディレクトリ
├── .github/workflows/               CI: check.yml（typecheck、lint、test、build）、deploy.yml（Pages）
├── package.json                     npm workspaces のルート。共通スクリプト
├── tsconfig.base.json               共通のコンパイラ設定（strict）。各パッケージが継承
├── eslint.config.js, .prettierrc    全パッケージの lint と整形
├── packages/
│   ├── engine/                      純粋なシミュレーションエンジン（DOM なし、実行時 Node なし）
│   └── app/                         React アプリケーション（Vite）
└── prototype/                       参照実装。移行完了後に削除（第4節）
```

### 1.1 `packages/engine`

```
packages/engine/
├── package.json                     name: @hayakaze/engine。scripts: test, typecheck, lint, diag*, validate
├── tsconfig.json                    lib: ["ES2022"] のみ
├── tsconfig.scripts.json            scripts/ にだけ Node の型を加える
├── vitest.config.ts
├── src/
│   ├── index.ts                     公開面（機能設計 8.1）。app はここからだけ import する
│   ├── rng.ts                       Rng, deriveSeed, RNG_PURPOSE, RngStreams
│   ├── types/                       ロジックを持たない共有データ型
│   │   ├── game.ts                  Game, Calendar, SaveFile
│   │   ├── player.ts                Player, Ratings, Caps, GrowthProfile, HiddenTraits, HealthState, RosterStatus
│   │   ├── club.ts                  Club, Ballpark, Scout, Policy
│   │   ├── estimate.ts              Estimate, RatingsView, ScoutReport
│   │   └── stats.ts                 BattingStats, PitchingStats, PlateAppearanceEvent
│   ├── league/                      config, schedule, calendar, season（日次ティック）, standings, postseason
│   ├── sim/                         oddsRatio, profile, game, fatigue, events
│   ├── player/                      arsenal, clutch, generate, development, aging, injury
│   ├── roster/                      rules, moves, farm, retirement
│   ├── scouting/                    estimate, scouts, public, reveal, views
│   ├── draft/                       class, order, bidding, lottery, aiBid
│   ├── ai/                          manager, clubGm
│   ├── metrics/                     runExpectancy, advanced, percentile, leagueLevel, clutchAnalysis
│   ├── save/                        serialize, migrate/, import
│   └── data/                        cities, namePools, nicknameDenylist, npbDefaultConfig
├── scripts/                         ヘッドレス診断（validate, diag-*）。tsx で実行
└── test/
    ├── calibration/                 リーグ水準、起用、故障、成長、ドラフト（アサート付き目標）
    ├── determinism/                 乱数の独立性、再生ハッシュ、serialize/restore
    ├── unit/                        モジュールごとのユニットテスト。src/ の配置を鏡映
    └── fixtures/                    セーブバージョンごとの保存ゲーム、取り込みサンプル
```

### 1.2 `packages/app`

```
packages/app/
├── package.json                     name: @hayakaze/app。scripts: dev, build, preview, test, typecheck, lint
├── index.html                       CSP メタ、ルート要素
├── vite.config.ts                   GitHub Pages の base パス、Worker 設定
├── tailwind.config.ts, postcss.config.js
├── public/                          favicon、フォント（自前配信）
└── src/
    ├── main.tsx                     エントリ。<App/> をマウント
    ├── app/                         アプリケーション層
    │   ├── session.ts               GameSession: エンジンに対するコマンドと照会
    │   ├── store.ts                 Zustand ストア
    │   ├── worker.ts                Web Worker エントリ。複数日の進行を実行
    │   ├── workerClient.ts          型付き postMessage の橋渡し
    │   ├── views.ts                 推定からの表示オブジェクト（20〜80、正確な値、公開推定）
    │   └── persistence/             indexedDb.ts, exportFile.ts, importFile.ts
    ├── ui/
    │   ├── App.tsx, routes.tsx      シェルとハッシュルート
    │   ├── screens/                 画面ごとに1フォルダ: Title, Dashboard, Standings, Roster, PlayerPage,
    │   │                            Stats, Scouting, Draft, Policy, SaveLoad
    │   ├── components/              共有: DataTable, PercentileBar, RatingCell, GradeCell, Dialog, ...
    │   ├── format/                  数値と日付の書式（打率 .285、防御率 2.85、6月12日）
    │   └── strings/                 UI 文言（日本語）。画面ごとに1モジュール
    └── styles/                      tailwind.css、デザイントークン
```

## 2. 各ディレクトリの役割

| ディレクトリ | 役割 | 所有するもの | 含めてはならないもの |
|---|---|---|---|
| `docs/` | 永続的な設計（「何か」と「どう作るか」） | 6文書＋日本語版。必要なら `images/` | 作業ログ、タスクリスト、コード |
| `.steering/` | 作業単位の記録 | `YYYYMMDD-title/requirements.md, design.md, tasklist.md` | 永続的な決定（`docs/` へ） |
| `packages/engine/src` | シミュレーション、規則、AI、指標、永続化形式 | データに対する純粋関数 | DOM、React、Node、`Math.random`、壁時計 |
| `packages/engine/scripts` | 人が読む診断 | コンソール出力 | テストが依存するロジック（`src/` に置いて import する） |
| `packages/engine/test` | アサートされた挙動と較正 | Vitest スイート、フィクスチャ | app が import するもの |
| `packages/app/src/app` | アプリケーション層 | セッション、ストア、Worker、永続化、ビュー構築 | JSX、画面固有のロジック |
| `packages/app/src/ui` | プレゼンテーション | 画面、コンポーネント、書式、文言 | エンジン呼び出し（`app/session.ts` を通す）、ストレージへの直接アクセス |
| `packages/engine/src/data` | 静的データ | 都市、名前プール、既定設定、拒否リスト | 実行時に導出されるもの |
| `prototype/` | 移行完了までの参照 | 凍結。新機能なし | — |

## 3. 配置規則

1. **ロジックを持たない型は `engine/src/types/` に置く。** モジュールは型をそこから import し、互いの実装ファイル
   からは import しない。循環を避けるため。
2. **app はエンジンを `@hayakaze/engine`（その `index.ts`）経由でのみ import する。** 深い import はパッケージの
   `exports` フィールドで遮断する。
3. **意思決定のコードは `ai/`、規則のコードは `roster/rules.ts`、シミュレーションは `sim/` へ。** `player.ratings` を
   直接読む関数は `sim/` と `player/` の配下にしか置けない。それ以外は `RatingsView` を受け取る。
4. **1画面1フォルダ**。`ui/screens/<Name>/` に `index.tsx`、その下位コンポーネント、`strings.ts` を置く。2画面以上で
   使うコンポーネントは `ui/components/` に移す。
5. **UI 文言はインラインに書かない。** `ui/strings/`（または画面の `strings.ts`）から取り、文言のレビューと変更を
   一箇所でできるようにする。
6. **挙動を較正する定数**（`SLOPE`、アンカー、疲労と故障の係数、AI の閾値）は使うモジュールから export し、
   `UPPER_SNAKE_CASE` で命名し、値の理由を文書化し、較正テストで覆う。
7. **テストは `src/` を鏡映する**: `test/unit/sim/game.test.ts` が `src/sim/game.ts` をテストする。較正と決定性の
   テストはモジュールではなく、何をアサートするかでまとめる。
8. **フィクスチャはバージョン管理する**: リリースした全セーブ形式について `test/fixtures/saves/v<N>/*.json`。
9. **診断は式を複製しない。** スクリプトは診断対象の関数を import する（プロトタイプの `diag-fatigue.ts` の教訓）。
10. **文書**: 英文ファイルを先に、日本語版を同じコミットで、同一の節構成で。図はインライン（Mermaid か ASCII）。
    画像は `docs/images/` にのみ。
11. **steering ディレクトリ**は `YYYYMMDD-<kind>-<title>` と命名し、kind は `feat`、`fix`、`rfct`、`rule`、`docs`。
12. **生成物**（`dist/`、coverage、`node_modules/`）はコミットしない。ルートの `.gitignore` が全パッケージを覆う。

## 4. `prototype/` からの移行

プロトタイプは較正済みの参照である。書き直すのではなく移植する。

| 手順 | 作業 | 完了条件 |
|---|---|---|
| 1 | workspace のルートと `packages/engine` を、共通 tsconfig・lint・vitest とともに作る | `engine` で `npm test` が空のスイートを実行する |
| 2 | `prototype/src/engine/**` をモジュール名を保って `packages/engine/src/**` に移す。型を `types/` に分離。`prototype/src/data` を `src/data` へ | `typecheck` が通る |
| 3 | `prototype/test/**` を `test/calibration` と `test/determinism` に、`prototype/scripts/**` を `scripts/` に移す | 同じ37件のアサート＋既知の失敗1件で `npm test` が通る。`diag:levels` がシード 20260915 で同じ表を印字する |
| 4 | v1の機能を各 steering 作業単位に従って `engine` に実装する | 各作業単位の tasklist |
| 5 | `prototype/` とその README を削除し、ルートの `README.md` に削除したコミットへの注記を加える | この節の履歴を除き、`docs/` に `prototype/` への参照が残らない |

手順5まで `prototype/` は凍結する。新しい仕組みはそこに足さない。

## 5. ルートのファイル

| ファイル | 目的 |
|---|---|
| `package.json` | `workspaces: ["packages/*"]`。ルートのスクリプトは各パッケージへ展開: `npm test -ws`、`npm run typecheck -ws`、`npm run lint -ws` |
| `tsconfig.base.json` | `strict`、`noUnusedLocals`、`noUnusedParameters`、`target ES2022`、`moduleResolution bundler` |
| `eslint.config.js` | typescript-eslint。engine 向けの上書きで `Math.random` と `Date.now` に `no-restricted-properties`、DOM に `no-restricted-globals` を加える |
| `.prettierrc` | シングルクォート、末尾カンマ、行幅 100 |
| `.gitignore` | `node_modules/`、`dist/`、`coverage/`、`*.tsbuildinfo`、`.env*`、`.claude/settings.local.json`、エディタのフォルダ |
| `.github/workflows/check.yml` | push と PR で: install、typecheck、lint、test、build |
| `.github/workflows/deploy.yml` | `main` への push でチェック後に: `packages/app` をビルドして GitHub Pages にデプロイ |
