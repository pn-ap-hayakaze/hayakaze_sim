# 要求内容: 初期実装（workspace 構築、エンジン移植、アプリ骨格）

作成日: 2026-09-17 / 承認: 2026-09-17
Issue: #2 / ブランチ: `feat/2-initial-implementation` / マイルストーン: v1
対象: リポジトリ全体（新規 `packages/engine`、`packages/app`、ルート設定）
参照: `docs/repository-structure.md` 第4節（移行手順）、`docs/architecture.md`、`docs/development-guidelines.md`

## 背景

永続文書6件が承認され、目標とするリポジトリ構成（npm workspaces、`packages/engine` と `packages/app`）が決まった。
現状は `prototype/` に較正済みのエンジンとテストがあるだけで、目標構成のディレクトリは存在しない。

本作業は、v1の機能を実装する前の**土台作り**である。新しいゲームの仕組みは一切足さない。
目的は次の3つ。

1. プロトタイプのエンジンを**較正を崩さずに**目標構成へ移植する（移行手順1〜3）
2. アーキテクチャの主要な判断（DOM なしのエンジン、Worker、Zustand、IndexedDB、ハッシュルーティング、CI）が
   実際に成立することを、最小の縦割り一片で確認する
3. 以後の steering 作業が「エンジンに機能を足し、画面を足す」だけで進められる状態にする

## 変更・追加する機能

### 1. workspace のルートを作る

- ルート `package.json`（`workspaces: ["packages/*"]`、`npm test -ws` 等の展開スクリプト）
- `tsconfig.base.json`（strict、ES2022、moduleResolution bundler）
- `eslint.config.js`（typescript-eslint。engine 向け上書きで `Math.random`・`Date.now` の `no-restricted-properties`、
  DOM グローバルの `no-restricted-globals`）と `.prettierrc`
- `.gitignore` を全パッケージ対応に更新
- `.github/workflows/check.yml`（install、typecheck、lint、test、build）

### 2. `packages/engine` にプロトタイプを移植する

- `prototype/src/engine/**` を `packages/engine/src/**` にモジュール名を保って移す
- ロジックを持たない型を `src/types/` に分離する（`game.ts`、`player.ts`、`club.ts`、`estimate.ts`、`stats.ts`）。
  実装モジュール同士の型 import をなくす
- `prototype/src/data/**` を `src/data/` に移す
- 用語を用語集に合わせて**改名する**: `Team` → `Club`、`teamId` → `clubId`、`TEAMS`/`teams` → `CLUBS`/`clubs`。
  それ以外の識別子（能力値フィールド名、`SLOPE`、`LEAGUE_AVERAGE` 等）は変えない
- `src/index.ts` に公開面を作る。`package.json` の `exports` で深い import を遮断する
- `tsconfig.json` は `lib: ["ES2022"]` のみ。`scripts/` 用に `tsconfig.scripts.json` を分ける
- `prototype/test/**` を `test/calibration/` と `test/determinism/` に、`prototype/scripts/**` を `scripts/` に移す
- `npm run validate`、`diag*` を engine の scripts として動かす

### 3. `packages/app` の骨格を作る

- Vite + React 19 + Tailwind CSS + React Router（ハッシュモード）+ Zustand
- `index.html` に CSP メタ（`default-src 'self'`）
- アプリケーション層: `app/session.ts`（`newGame`、`advanceDay`、`advanceTo`、`save`、`load` の最小セット）、
  `app/store.ts`、`app/worker.ts` と `app/workerClient.ts`（`advanceTo` を Worker で実行し進捗を返す）、
  `app/persistence/indexedDb.ts`（`idb` でスロット1つに保存・読込）
- 画面は3つだけ: `Title`（新規開始、ロード）、`Dashboard`（今日の試合結果、1日進める、シーズン末まで進める）、
  `Standings`（両リーグの順位表）。デザインは最小限。ワイヤーフレームの完成度は求めない
- `ui/format/`（打率 `.285`、防御率 `2.85`、投球回 `123.1`、勝敗分 `45-30-3`、ゲーム差）
- `ui/strings/` に UI 文言を置く。インライン文言なし
- セーブは既存 `SeasonState` の直列化（Map → 配列）。**セーブ形式バージョン 1** として `save/serialize.ts` に置く。
  乱数は `masterSeed` と `year`・`currentDay` で再導出できるので、状態の書き出しは `Rng` を持たない

### 4. `prototype/` の扱い

- 本作業では**削除しない**。移植の検証（同一シードで同一の表）に参照として使う
- 削除は移行手順5（v1機能の実装後）に別作業で行う。本作業では `prototype/README.md` の先頭に
  「凍結。実装は `packages/engine` へ移植済み」と注記する

## ユーザーストーリー

- 開発者として、`npm test -ws` 一発でプロトタイプと同じ較正アサートが通ることを確認したい。移植で数値が変わって
  いないことを機械的に保証したい
- 開発者として、エンジンに DOM や Node の API を混入させたら typecheck か lint で止まってほしい
- GM（プレイヤー）として、ブラウザで新規ゲームを始め、1日進めて順位表を見て、保存し、再読み込み後にロードして
  同じ状態から続けたい
- 開発者として、push すると CI が typecheck・lint・test・build を回してくれる状態にしたい

## 受け入れ条件

1. ルートで `npm install` が通り、`npm run typecheck -ws`、`npm run lint -ws`、`npm test -ws`、
   `npm run build -w packages/app` がすべて成功する
2. `packages/engine` の `npm test` が、プロトタイプと同じ **37件の通過＋既知の失敗1件（盗塁企図、`it.fails`）** で通る
3. `packages/engine` の `npm run diag:levels` がシード `20260915, 1〜5` でプロトタイプの `diag:levels` と**同一の表**を出す
   （打率・出塁率・OPS・R/G・防御率・WHIP・首位打者・HR王・ERAσ・OPSσ が小数表示まで一致）
4. `packages/engine/tsconfig.json` の `lib` が `["ES2022"]` のみで、`src/` に `Math.random`・`Date.now`・DOM グローバルの
   参照がない（lint が緑。テストとして、意図的に `Math.random()` を書いたファイルで lint が失敗することを1回確認し記録する）
5. `packages/engine/src/types/` に型が集約され、`src/` の実装モジュールが他の実装モジュールから**型だけ**を import する
   箇所がない（型は `types/` から、関数は実装モジュールから）
6. `Team`/`teamId` が `packages/engine` に残っていない（`grep` で確認）
7. `packages/app` を `npm run dev` で起動し、ブラウザで 新規開始 → 1日進める → 順位表 → 保存 → リロード → ロード
   を行うと、ロード後の順位表と現在日が保存時と一致する
8. 「シーズン末まで進める」が Worker で実行され、実行中もタイトルへの遷移などの UI 操作が可能で、進捗が表示される
9. 1公式戦シーズン（858試合）のヘッドレス実行が Worker 内で 5 秒以内（`architecture.md` 第5節）
10. GitHub Actions の `check.yml` が push で走り緑になる（デプロイ用 `deploy.yml` は本作業の範囲外）
11. `prototype/README.md` と `README.ja.md` の先頭に凍結の注記がある
12. 英日の文書に変更が必要な場合（実装で判明した配置の修正など）、`docs/*.md` と `.ja.md` を同時に更新している

## 制約事項

- **新しいゲームの仕組みを足さない。** 登録・抹消、外国人枠、故障、成長、スカウト、ドラフト、AI の推定ビューは
  すべて後続の steering 作業。本作業のアプリはプロトタイプの `SeasonState` をそのまま動かす
- 較正定数（`SLOPE`、`LEAGUE_AVERAGE`、疲労・クラッチの係数）を変えない
- `POSITIONS` に DH を足さない。`usesDh` を復活させない
- エンジン内で `Math.random()`・`Date.now()` を使わない
- 改名は `Team` → `Club` 系に限る。能力値フィールド名は変えない（`development-guidelines.md` 命名規約）
- コメントは日本語。文書は英文＋`.ja.md`
- `prototype/` は本作業では削除も改変もしない（README の凍結注記のみ）
- コミットはユーザーの承認後

## スコープ外（後続の steering 作業）

- `packages/engine` の新規モジュール（`roster/`、`scouting/`、`draft/`、`ai/`、`save/migrate/`）
- 選手ページ、ロスター画面、スカウト画面、ドラフト画面、方針画面
- セーブの gzip 書き出し・取り込み、Zod による検証、実名データ取り込み
- `deploy.yml`（GitHub Pages への配信）
- Playwright のエンドツーエンドテスト
- `prototype/` の削除

## 基準表（移植前、2026-09-17 に `prototype/` で実測。受け入れ条件3の比較対象）

```
    seed      打率     出塁率     OPS     R/G     防御率    WHIP      K%     BB%     HR%      企図     盗塁率    首位打者     HR王     盗塁王    ERAσ    OPSσ
20260915    .244    .314    .686    3.70    3.36   1.294    18.8     8.2    2.26      71    .709    .342      34      41    0.75   0.103
       1    .250    .315    .692    3.77    3.38   1.304    18.8     7.6    2.22      80    .697    .371      33      49    0.62   0.099
       2    .249    .317    .691    3.78    3.38   1.310    18.6     8.0    2.20      82    .684    .354      34      51    0.65   0.096
       3    .250    .319    .693    3.81    3.41   1.325    19.6     8.1    2.10      78    .687    .360      31      37    0.60   0.099
       4    .252    .320    .700    3.86    3.51   1.331    18.9     8.1    2.22      75    .704    .342      32      45    0.69   0.110
       5    .243    .310    .674    3.55    3.15   1.268    19.3     7.8    2.07      70    .666    .336      37      36    0.56   0.095
      平均    .248    .316    .690    3.74    3.37   1.305    19.0     8.0    2.18      76    .691    .351    33.5    43.2    0.65   0.100
```

## 報告事項（完了時）

- 移植前後の `diag:levels` の表の対比（同一であること）
- 較正テストの件数（37＋1）
- 1日と1シーズンの実行時間（メインスレッド、Worker）
- 移植中に見つかった、文書（`docs/`）と実装の食い違い
