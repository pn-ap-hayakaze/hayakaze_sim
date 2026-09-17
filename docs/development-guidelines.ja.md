# 開発ガイドライン（Development Guidelines）

| | |
|---|---|
| 文書 | `docs/development-guidelines.ja.md`（英文版: `docs/development-guidelines.md`） |
| 状態 | ドラフト v0.1、2026-09-17、承認待ち |
| 範囲 | コーディング、命名、スタイリング、テスト、Git の規約。ツールは `architecture.md`、配置は `repository-structure.md`、用語は `glossary.md` に書く |

## 1. コーディング規約

### 1.1 TypeScript

- 全体で `strict`。`any` は使わず `unknown` で受けて絞り込む。非 null アサーション（`!`）はテスト以外では使わない。
  例外は保証された `set` の直後の `Map.get` で、その場合はコメントを付ける。
- オブジェクトの形には `interface`、union・タプル・マップ型には `type` を使う。
- 関数が変更しない配列とフィールドには `readonly`。`POSITIONS` のようなリテラル表には `as const`。
- export する関数には明示的な戻り値型。
- ES モジュール。相対 import には `.js` 拡張子を付ける（プロトタイプと Node の ESM 解決に合わせる）。
- 名前付き export のみ。default export は React の遅延読み込み画面以外では使わない。
- クラスより関数。エンジン内の唯一のクラスは `Rng`。
- `enum` は使わず文字列リテラル union（`'ACTIVE' | 'FARM' | 'INJURED'`）を使う。そのままシリアライズできる。

### 1.2 エンジンの規則（`architecture.md` 4.1 参照）

- すべての確率的関数は `Rng` 引数を受け取る。`Rng` を受け取る関数の内部で `Rng` を作らない。
- 意思決定関数は `RatingsView` を受け取る。`player.ratings` を読むのは `sim/` と `player/` だけ。
- 純粋関数: データを受け取りデータを返す。変更が許されるのはコマンドに渡された `Game` オブジェクトだけで、
  コマンド名がそれを表す（`applyResult`、`advanceOneDay`）。
- 較正済み定数: `UPPER_SNAKE_CASE`、使うモジュールから export、値の理由と根拠の計測を書いたドキュメントコメント
  （プロトタイプ `season.ts` の `FATIGUE_PER_APPEARANCE` を参照）。
- プロファイル内で残余の確率を計算しない。正規化は `combine()` でちょうど1回。
- プログラマの誤り（不正な設定、不明な ID）には日本語メッセージの `Error` を投げる。ユーザーが起こしうる規則違反
  （外国人枠、10日ルール）には例外ではなく `Refusal` オブジェクトを返す。

### 1.3 コメント

- コメントはファイルの言語に従う。プロトタイプから引き継ぐエンジンコードは日本語でコメントされているので、新しい
  エンジンとアプリのコードも `src/` 内の一貫性のため日本語を続ける。
- コメントは**なぜ**、計測した数値、落とし穴を説明する。コードが明らかに示すことは書かない。
- export するすべてのシンボルにドキュメントコメント（`/** */`）。

### 1.4 React とアプリケーション層

- フックを使う関数コンポーネント。クラスコンポーネントは使わない。
- 画面はセレクタで Zustand ストアから読む。エンジンのオブジェクトをローカル状態に持たない。
- エンジンへのアクセスはすべて `app/session.ts` を通す。コンポーネントは型を除き `@hayakaze/engine` を直接 import しない。
- 長いコマンドは Worker へ。ストアが進捗を示す。
- 200行を超えるリストは共有の仮想化 `DataTable` を使う。
- 導出データに `useEffect` を使わない。セレクタか `useMemo` で導出する。

## 2. 命名規約

| 対象 | 規約 | 例 |
|---|---|---|
| ファイル（エンジン、アプリのロジック） | `camelCase.ts` | `runExpectancy.ts`、`workerClient.ts` |
| React コンポーネントとそのファイル | `PascalCase.tsx` | `PercentileBar.tsx` |
| 画面フォルダ | `PascalCase/` に `index.tsx` | `ui/screens/PlayerPage/` |
| 型とインターフェース | `PascalCase`、`I` 接頭辞なし | `Player`、`LeagueConfig` |
| 関数と変数 | `camelCase`。関数は動詞から始める | `advanceOneDay`、`gamesPerTeam` |
| 真偽値 | `is`/`has`/`can` 接頭辞 | `isSeasonOver`、`canRegister` |
| 定数 | `UPPER_SNAKE_CASE` | `LEAGUE_AVERAGE`、`CLUTCH_GAIN_PER_10` |
| 文字列リテラル union のメンバー | `UPPER_SNAKE_CASE` | `'EARLY_SUSTAINED'`、`'FOREIGN_EXEMPT'` |
| ID | `<entity>Id` | `playerId`、`clubId`、`gameId` |
| Map | 複数形の名詞または `<value>By<Key>` | `players`、`scheduleByDay` |
| テストファイル | `src/` を鏡映した `<module>.test.ts` | `test/unit/sim/game.test.ts` |
| steering ディレクトリ | `YYYYMMDD-<kind>-<title>` | `20260916-fix-prototype-recalibration` |

ドメイン用語は `glossary.md` で確定した英語形を使う（例: `meet`、`deactivate`、`controlled`、`active`、`farm`、
`foreignStatus`）。同義語を発明しない。

コード内の野球の略語は一般的なセイバーメトリクスの用法に従う: `pa`、`ab`、`h`、`hr`、`bb`、`so`、`sb`、`cs`、`ip`、
`er`、`woba`、`wrcPlus`、`fip`、`war`。投球回は `outs` で保持し、小数では持たない。

## 3. スタイリング規約

- JSX 内の Tailwind ユーティリティクラス。コンポーネントごとの CSS ファイルは作らない。共有パターンは `@apply` クラス
  ではなくコンポーネントにする。例外は `styles/tailwind.css` の少数のデザイントークン。
- デザイントークン: 中立的なパレットに GM 球団のアクセント1色。良い／平均／悪いの意味色をパーセンタイルバーと能力値
  セルで一貫して使う。
- 数値は等幅の表用数字（`tabular-nums`）で右寄せ。
- NPB の書式規則（`ui/format/`）: 打率と率は `.285`（先頭の0なし、小数3桁）、防御率は `2.85`、投球回は `123.1`、
  日付は `6月12日`、勝敗分は `45-30-3`、ゲーム差は `2.5` または首位は `—`。
- 不確実性は文字の太さや不透明度で示し、数値では示さない（製品要件 7.4）。
- すべての操作要素はキーボードで到達できる。表にはキャプションか `aria-label`。コントラストは WCAG AA を満たす。
- 768 px でレイアウトが崩れてはならない。広い画面では文字を大きくするのではなく列を増やす。
- データ更新時のアニメーションは短いフェード以外なし。日次ティックは即時に感じられなければならない。

## 4. テスト規約

### 4.1 レベル

| レベル | 場所 | アサートするもの |
|---|---|---|
| ユニット | `engine/test/unit/**` | 1つの関数またはモジュール。決定的な入力、固定の `Rng` シード |
| 較正 | `engine/test/calibration/**` | 固定6シード `[20260915, 1, 2, 3, 4, 5]` にわたるリーグ水準、起用、故障、成長、ドラフトの目標。2段の許容幅（平均が目標内、各シードが目標 ± 許容幅内） |
| 決定性 | `engine/test/determinism/**` | 試合ごとの乱数独立性、serialize/restore、再生ハッシュ |
| セーブ移行 | `engine/test/unit/save/**` と `fixtures/saves/v<N>/` | リリースした全バージョンがロードされ移行される |
| コンポーネント | `app/src/**/*.test.tsx` | フィクスチャの `Game` に対する React Testing Library での画面の挙動 |
| エンドツーエンド（リリース前） | `app/e2e/` | 新規ゲーム → 1週間進める → 保存 → リロード → ロード |

### 4.2 規則

- **較正テストが完了の定義。** 較正済み定数や仕組みを変えるときはこれに従う。定数を動かす PR は steering の
  `tasklist.md` に変更前後の表を含める。
- **既知の失敗はスキップせず登録する**: `it.fails` を使い、直す予定の steering 作業をコメントに書く（プロトタイプの
  盗塁企図テストが手本）。較正アサートを `it.skip` にしない。
- テストは `Math.random` を呼ばない。固定シードで `Rng` を作る。
- 1つの `it` に1つの挙動。名前は期待を平文で述べる（プロトタイプに合わせて日本語でよい）。
- フィクスチャはデータファイル。隠れた乱数を持つビルダーにしない。
- 診断（`scripts/`）はテストではない。診断が目標を明らかにしたらアサートを追加する。
- コンポーネントテストは見える文字列とロールをアサートし、実装の詳細には触れない。
- エンジンの全スイートは 60 秒以内。それより遅いものは明示的な `npm run test:slow` の後ろに置く。

## 5. Git 規約

### 5.1 issue、マイルストーン、ブランチ

- **steering の作業単位1つ = issue 1つ = ブランチ1つ = プルリクエスト1つ。**
- マイルストーンはリリースバージョン（`v1`、…）。すべての issue は、それが仕える リリース範囲のマイルストーンに属する。
- issue は steering ディレクトリを作るときに作る: タイトル = steering のタイトル、ラベル = kind（`feat`、`fix`、
  `rfct`、`rule`、`docs`）、本文に steering ディレクトリへのリンク。`requirements.md` のヘッダに `Issue: #N` を記録する。
- `main` は常にデプロイ可能。CI は緑でなければならない。
- ブランチ名は `<kind>/<issue番号>-<short-title>`: `feat/2-initial-implementation`、`fix/7-steal-attempts`、
  `rule/1-branch-and-issues`。steering の文書を含む作業単位のすべてをそのブランチにコミットする。
- steering の tasklist が完了しユーザーが承認したら、プルリクエストで**マージコミット**により `main` にマージする
  （squash や rebase はしない。`tasklist.md` に記録したコミットハッシュを有効なまま保つため）。
- 例外: steering を伴わない変更（メモリのノート、文書の誤字修正）は `main` へ直接コミットしてよい。

### 5.2 コミット

- メッセージの言語: **日本語**（既存の履歴に合わせる）。件名は 50 文字以内、命令形、末尾の句点なし。本文は理由を
  説明し、変更点をハイフンで列挙する。
- 1コミットに1つの論理的変更。文書とその日本語版は一緒にコミットする。較正の変更は定数の変更、テスト、README の表を
  一緒にコミットする。
- コミットはユーザーが求めたか承認したときだけ。`.claude/settings.local.json` や生成物はコミットしない。
- アシスタントが作るすべてのコミットにトレーラーを付ける:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
```

### 5.3 プルリクエスト

- steering の作業単位ごとに1つ。そのブランチから `main` へ。
- タイトルは日本語。本文は `Closes #N` で始め、steering ディレクトリ、変更の概要、テストの証拠（どのアサート、
  どの diag の表）、UI 変更ならスクリーンショットを載せる。
- ユーザーの承認後にのみ、マージコミットでマージする。PR 番号を `tasklist.md` に記録する。
- 本文の末尾に:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 5.4 steering と文書

- 作業単位は issue とブランチから始め、次に `.steering/YYYYMMDD-<kind>-<title>/requirements.md`、次に `design.md`、
  次に `tasklist.md`。それぞれ承認を得てから次へ。
- `tasklist.md` はタスクが終わるごとに更新し、最後の項目群にコミットハッシュと PR 番号を記録する。
- 変更が永続的な決定を変えるときは、同じ作業単位で `docs/` のファイルとその `.ja.md` を更新し、アシスタントが
  依拠する決定であればメモリのノートも更新する。

## 6. 承認を求める前のチェックリスト

1. 触ったすべてのパッケージで `npm run typecheck`、`npm run lint`、`npm test` が通る。
2. 定数を動かした場合、steering の `tasklist.md` の較正表が埋まっている。
3. 英文と日本語の文書が同じ節構成である（`grep -c '^#'` が一致する）。
4. 許可されたモジュール以外に `Math.random`、`Date.now`、DOM グローバル、`player.ratings` の読み取りがない（lint が緑）。
5. 新しい UI 文言は `strings/` にあり、数値は `ui/format/` を使っている。
6. steering の `tasklist.md` が、やり残しを含めて実態を反映している。
