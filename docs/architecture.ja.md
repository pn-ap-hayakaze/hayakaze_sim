# 技術仕様（Architecture）

| | |
|---|---|
| 文書 | `docs/architecture.ja.md`（英文版: `docs/architecture.md`） |
| 状態 | ドラフト v0.1、2026-09-17、承認待ち |
| 範囲 | 技術スタック、開発ツールと方法、技術的制約、性能要件。システムが何をするかは `product-requirements.md`、機能がどう動くかは `functional-design.md` に書く |

## 1. 技術スタック

### 1.1 すでに確定している決定

| 領域 | 選択 | 理由 |
|---|---|---|
| 言語 | TypeScript 5.x、`strict` | エンジン、アプリケーション、UI で共通。プロトタイプがすでに TypeScript |
| UI | React 19 | データ密度の高い多数の画面に向くコンポーネントモデル。エコシステムが広い |
| ビルド | Vite | 高速な開発サーバー、GitHub Pages 向けの静的出力、Web Worker と TypeScript の一級サポート |
| スタイリング | Tailwind CSS | プロジェクト共通のデザインシステム（CLAUDE.md）。ユーティリティクラスでデータ表の見た目を揃える |
| 配信 | GitHub Pages の静的サイト | バックエンドなし、無償ホスティング（製品要件） |
| デスクトップ（後） | Tauri | 同じ静的ビルドを包む。エンジンとアプリケーションが Node や DOM の API に触れないことが前提 |
| テスト | Vitest | プロトタイプの較正テストですでに使用 |
| ツールの実行環境 | Node.js 24 LTS、npm | 開発機に存在する。CI も同じメジャーバージョンを使う |

### 1.2 追加の提案

| 領域 | 選択 | 理由と代替案 |
|---|---|---|
| パッケージ構成 | npm workspaces: `packages/engine`、`packages/app` | エンジンの `tsconfig` は `lib: ["ES2022"]` のみ（DOM なし）にするので、UI やブラウザ依存が誤って混入できない。単一パッケージでは規律だけが頼りになる |
| アプリケーション状態 | Zustand | `GameSession` と表示状態を1つのストアに持つ。API が小さく定型コードがなく、React コンポーネント外（Worker のメッセージ）からも扱える。代替: Redux Toolkit（重い）、React context + reducer（大きな状態での再描画コスト） |
| ルーティング | React Router のハッシュモード | GitHub Pages には SPA のフォールバックがない。ハッシュ URL なら `404.html` のコピーという小技なしにリロード時の 404 を避けられる |
| 永続化 | `idb` ラッパー経由の IndexedDB | 数十 MB のセーブは `localStorage` を超える。`idb` は生の API に型付きの Promise を与える |
| セーブの圧縮 | 書き出しファイルに `CompressionStream`（gzip） | ブラウザ組み込みで依存なし。ブラウザ内の保存は速度のため非圧縮のまま |
| スキーマ検証 | Zod | 取り込み JSON とロードしたセーブを検証する。取り込み画面向けにパス付きのエラーメッセージを出せる |
| Worker の橋渡し | 型付きメッセージ union による素の `postMessage` | 長いシミュレーション（`advanceTo`）は Web Worker で走らせる。メッセージ種類が少数なのでライブラリ（Comlink）は不要。初期実装では状態を直列化（セーブ形式）して Worker と往復させ、Worker はコマンド間で状態を持たない |
| Lint / 整形 | ESLint（typescript-eslint）+ Prettier | 後述のエンジン制約（`Math.random` 禁止、DOM グローバル禁止）を lint 規則として強制する |
| UI テスト | React Testing Library。後に Playwright のスモークテスト | コンポーネントの挙動。リリース前に「新規ゲーム → 1週間進める → 保存 → ロード」のエンドツーエンド確認を1本 |
| CI | GitHub Actions | push ごとに typecheck、lint、test、build。`main` から Pages へデプロイ |

## 2. 構造

```mermaid
graph LR
    subgraph engine["packages/engine  (lib: ES2022, DOM なし)"]
        E[league / sim / player / roster / scouting / draft / ai / metrics / save]
    end
    subgraph app["packages/app  (React, Vite)"]
        W[worker.ts<br/>エンジンのコマンドを実行]
        S[store (Zustand)<br/>GameSession、ビュー]
        U[ui/ 画面とコンポーネント]
        P[永続化<br/>IndexedDB、書き出し／取り込み]
    end
    U --> S
    S <--> W
    W --> E
    S --> E
    S --> P
```

- `packages/engine` は実行時に何にも依存しない。テストは較正スイートとユニットテスト。
- `packages/app` は workspace 経由で `engine` に依存する。メインスレッドは照会と1日分のティックにエンジンを直接使い、
  Worker は複数日の進行を走らせて進捗を報告する。
- `prototype/` のプロトタイプは、その仕組みとテストが `packages/engine` に移植されるまで参照として残し、その後
  削除する（`repository-structure.md` 参照）。

## 3. 開発ツールと方法

### 3.1 コマンド（注記なければ両パッケージ）

| コマンド | 目的 |
|---|---|
| `npm run dev`（app） | Vite 開発サーバー |
| `npm run build`（app） | `dist/` への本番ビルド |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint + Prettier のチェック |
| `npm test` | Vitest。`engine` では6シードの較正アサートを含む |
| `npm run diag*`（engine） | プロトタイプから引き継ぐヘッドレス診断（水準、起用、疲労、ブルペン、クラッチ） |
| `npm run validate`（engine） | 1シーズンを人が読む形で印字 |

### 3.2 方法

- **作業単位ごとの steering**（CLAUDE.md）: `.steering/` 配下に requirements → design → tasklist を置き、それぞれ
  承認を得てから次へ。永続文書は設計変更時のみ更新する。
- **較正はテストとして持つ。** `SLOPE`、アンカー、疲労、故障、AI の定数を変えるときは `npm test` を緑に保つ。目標は
  `product-requirements.md` 第7節にある。新しい仕組みは調律する前に自分のアサート付き目標を持つ。
- **ヘッドレス優先。** すべての機能は画面を作る前に `engine` で実装しテストする。
- **決定性の確認。** 保存したシードを再生し、シーズンの順位表のハッシュを実行間で比較するテストを置く。
- **文書は英文と日本語版を同じコミットで更新する。**

### 3.3 規約

コーディング、命名、スタイリング、テスト、Git の規約は `development-guidelines.md` にある。

## 4. 技術的制約

### 4.1 エンジンの制限（tsconfig と lint で強制）

| 制約 | 強制手段 |
|---|---|
| DOM なし、Node API なし | `lib: ["ES2022"]`。`engine` の実行時コードに `@types/node` を入れない（scripts は別の tsconfig） |
| `Math.random()` 禁止 | ESLint `no-restricted-properties`。すべての乱数は注入された `Rng` から |
| `Date.now()` や壁時計の読み取り禁止 | 同じ規則。暦はゲームデータ |
| グローバルな可変状態なし | 関数はデータを受け取りデータを返す。`Game` オブジェクトが唯一の状態 |
| 意思決定関数は `RatingsView` を受ける | 型シグネチャ。`sim/` と `player/` の外での `player.ratings` アクセスを lint で警告 |
| 状態はシリアライズ可能 | プレーンなオブジェクト、配列、数値、文字列、真偽値、`Map`（保存時に変換）のみ。クラスのインスタンスは数値にシリアライズされる `Rng` を除いて持たない |

### 4.2 決定性

- 同じマスターシード、設定、コマンド列は**同じ JavaScript エンジン上で**同じゲームを再現する。
- `Math.log`、`Math.cos`、`Math.exp` はブラウザ間でビット単位に同一ではない。ブラウザをまたいだ同一再生は要件と
  **しない**。セーブは再生ログではなく状態を持つ。エンジン間の厳密な再現が要件になった場合、置き換える場所は
  `rng.ts` の正規乱数と指数乱数のサンプラーだけである。
- `Map` の反復順は挿入順であり、これに依存する。オブジェクトのキー順には依存しない。

### 4.3 ブラウザとストレージ

- 対応: Chrome、Edge、Firefox、Safari（デスクトップ）の現行と1つ前のメジャーバージョン。モバイルはv1の対象外
  だが、768 px でレイアウトが崩れてはならない。
- ストレージ: オリジンごとのクォータを持つ IndexedDB。セーブスロット1つは約 20 MB 未満に収まる設計とし（機能設計
  4.3 節）、`navigator.storage.estimate()` が報告するクォータの半分を超えたらアプリが警告する。
- 初回読み込み後のネットワークアクセスなし。アナリティクスなし、外部フォントや CDN なし（自前配信のアセットのみ）。

### 4.4 セキュリティ

- 取り込みファイルとロードしたセーブは JSON として解析し、使用前に Zod で検証する。検証に失敗したらパス付きの
  メッセージとともにファイル全体を拒否する。
- ユーザーやファイル由来の文字列はすべてテキストとして描画する（React のエスケープ）。`dangerouslySetInnerHTML`、
  `eval`、動的 `Function` は使わない。
- Content Security Policy `default-src 'self'; img-src 'self' data:` は Vite プラグインが**ビルド時にだけ** `index.html` に注入する。開発サーバーは React Fast Refresh がインラインスクリプトを要するため CSP を掛けない。本番ビルドにはインラインのスクリプトもスタイルもない（Tailwind v4 は CSS ファイルを出力する）ので `'unsafe-inline'` は不要。
- どこにも何も送信しない。資格情報は存在しない。

### 4.5 セーブ形式

- バージョン付き JSON（`version` は整数）。ロード時に `n → n+1` の移行を順に実行する。各移行には前バージョンで
  保存したフィクスチャによるテストを持つ。
- 書き出しは gzip 圧縮し拡張子は `.hayakaze.json.gz`。取り込み画面は圧縮・非圧縮の両方を受け付ける。

### 4.6 権利とコンテンツ

- リポジトリにもビルドにも、実名の選手名、NPB 球団のニックネーム、球場名を含めない。名前プールは実在ニックネームの
  拒否リストに対するテストで確認する。
- 都市名のみ実在のものを使う。

## 5. 性能要件

一般的なノート PC（4コア、8 GB）の Chrome で測る。プロトタイプの数値を基準とする。

| 項目 | 要件 | 基準・注記 |
|---|---|---|
| 公式戦の1日（6試合＋推定＋AI） | メインスレッドで < 100 ms | プロトタイプ: 1試合 0.15 ms。追加コストは推定の更新と AI の判断 |
| ヘッドレスの公式戦1シーズン（858試合） | Worker で < 5 s | プロトタイプ: 試合のみで約 130 ms |
| 複数シーズンの進行 | 進捗を 500 ms ごと以上に報告。UI は操作可能なまま | Worker |
| 画面操作（選手ページを開く、表を並べ替える） | < 100 ms | 200行超の表は仮想化 |
| 初回読み込み | 10 Mbit/s 回線で < 3 s。JS バンドルは gzip 後 < 1 MB | ドラフトと成績の画面をコード分割 |
| IndexedDB への保存 | 20シーズンのゲームで < 2 s | API が許す範囲でメインスレッド外 |
| 書き出し／取り込み | gzip 込みで < 5 s | `CompressionStream` |
| メモリ | 20シーズンのゲームでヒープ < 500 MB | 打席イベントは機能設計 4.3 に従って間引く |
| 較正テストスイート | ローカルと CI で < 60 s | アサート群ごとに6シーズン |

## 6. 先送りした技術的決定

- 仮想化テーブルのライブラリを採用するか、最小限のものを自作するか。
- Playwright のエンドツーエンドテスト: 初期実装ではなく最初の公開リリース前に導入する。
- Tauri のパッケージング詳細（セーブ書き出しのファイルダイアログ、自動更新）はデスクトップフェーズの開始時に。
- ブラウザをまたいだ同一再生が要件になった場合の決定的な数値計算（固定小数点やテーブル方式のサンプラー）の追加。
