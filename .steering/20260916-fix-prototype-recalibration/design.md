# 設計: プロトタイプを確定設計決定に合わせて再較正する

作成日: 2026-09-16
requirements.md の6タスクを、この順で実装する。

## 承認が必要な提案（先に読むこと）

以下の4点は requirements の時点で未決定だったもの。この design.md の承認をもって確定とする。

| # | 提案 | 概要 |
|---|---|---|
| A | クラッチ係数 | `f(c) = 1 + 0.09 × (c − 50) / 10`（クラッチ+10 で実効ミート ×1.09）。真のクラッチ才能 σ ≈ 7 wOBA ポイント |
| B | クラッチ分布 | `clutch = 70 − Gamma(shape 4, scale 5)`。平均50・σ10、上限70、65超は1.4% |
| C | 得点水準の制御レバー | 水準は `LEAGUE_AVERAGE`（アンカー）で、散らばりは `SLOPE` で制御する。DH化は水準の変化なのでアンカーを主レバーにし、SLOPE は散らばりの再確認で必要最小限・対称に触る |
| D | 盗塁企図のアサート | 現状 66〜76/チーム（目標105〜110）で、修正はスコープ外。vitest の `it.fails` で「既知の失敗」として登録し、修正されたら自動で気づく形にする |

根拠の数値は各タスクの節にある。

---

## タスク1: 乱数を独立ストリームにする

### 実装アプローチ

**派生方式**: 32bit 整数ミキサ（murmur3 の fmix32）で `masterSeed` と用途タグ・キー列を順に混ぜ、Mulberry32 のシードを作る。

```ts
// rng.ts
export function deriveSeed(masterSeed: number, ...keys: number[]): number;

export const RNG_PURPOSE = {
  ROSTER: 1, SCHEDULE: 2, GAME: 3,
  INJURY: 4, SCOUT: 5, GROWTH: 6, AI: 7,   // 将来用。派生口だけ用意する
} as const;

export interface RngStreams {
  readonly masterSeed: number;
  /** 試合用。hash(masterSeed, GAME, year, day, gameId) */
  game(year: number, day: number, gameId: number): Rng;
  /** 任意用途。hash(masterSeed, purpose, ...keys) */
  forPurpose(purpose: RngPurpose, ...keys: number[]): Rng;
}
export function createRngStreams(masterSeed: number): RngStreams;
```

- キーの順序に依存すること（`(1, 0)` と `(0, 1)` で別のシード）をテストで保証する
- `Rng` に `serialize(): number`（32bit 状態）と `static restore(state: number): Rng` を追加する。復元後の乱数列が元と完全一致することをテストする
- ロスター生成 `hash(master, ROSTER)`、日程生成 `hash(master, SCHEDULE, year)` もこの派生に乗せる。**seed に対する生成結果はこれまでと変わる**が、較正表は本作業で引き直すので問題ない

**SeasonState の変更**: `rng: Rng` を削除し、`masterSeed`・`year`・`streams: RngStreams` を持つ。`advanceOneDay` は試合ごとに `season.streams.game(year, day, game.id)` を作って `simulateGame` に渡す。

**ScheduledGame** に `id: number`（日程配列内の通し番号）を追加する。

**テスト用の注入口**: `createSeason(seed, { streams })` で `RngStreams` を差し替えられるようにする。テストは `game()` をラップして特定の試合だけ `next()` を1回余分に消費させる。

### 独立性の検証（テスト）

疲労は試合をまたいで因果的に伝播する（試合Xの継投が変わる → その2球団の翌日以降のブルペン状態が変わる → 対戦相手にも伝わる）。これは乱数整列ではなく正当な因果なので、検証は因果の届かない範囲に限る。

1. D日目の試合X の乱数消費を1回増やした季節Bと、通常の季節Aを比べる
2. **D日目以前の試合X以外の全試合**が同一（得点・イニング数・打撃と投球のスタッツ）
3. **D+1日目のうち、Xの2球団が関わらない試合**が同一
4. 試合X自身は変化している（摂動が適用された確認）

対比として、旧方式だと 2 と 3 が満たされないことは既に実測済み（12球団全部の勝敗が変わった）なので、旧方式のテストは書かない。

### 変更ファイル

- `src/engine/rng.ts` — `deriveSeed`, `RNG_PURPOSE`, `RngStreams`, `createRngStreams`, `Rng.serialize/restore`
- `src/engine/league/schedule.ts` — `ScheduledGame.id`
- `src/engine/league/season.ts` — `SeasonState` の乱数フィールド、`createSeason` オプション、`advanceOneDay`
- `scripts/*.ts` — `createSeason` 呼び出しは互換（第1引数 seed）なので変更なし

---

## タスク2: vitest と較正アサート

### 実装アプローチ

- `vitest` を devDependencies に追加。`package.json` に `"test": "vitest run"`。`tsconfig.json` の include に `test/**/*.ts`
- テストは `prototype/test/` に置く
  - `rng.test.ts` — 派生の順序依存、serialize/restore の一致、試合独立性
  - `calibration.test.ts` — リーグ水準の較正アサート
  - `clutch.test.ts` — タスク6の検証（才能 σ、得点保存、階層・プラトーン保持）
  - `positions.test.ts` — タスク4（`POSITIONS` が9個、`LineupSlot` に DH、DH の出場が appearances に記録される）

### 較正アサートの許容幅（2段構え）

固定シード6つ `[20260915, 1, 2, 3, 4, 5]` で1シーズンずつ回す（合計 約1秒）。

| 指標 | NPB目標（平均がこの中） | 各シードの許容帯（目標を両側に広げる幅） |
|---|---|---|
| 打率 | .240〜.260 | ±.008 |
| 出塁率 | .305〜.325 | ±.008 |
| OPS | .660〜.715 | ±.015 |
| 1試合平均得点（1チーム） | 3.6〜4.3 | ±0.20 |
| 防御率 | 3.00〜3.60 | ±0.20 |
| WHIP | 1.24〜1.35 | ±0.04 |
| 盗塁成功率 | .65〜.75 | ±.03 |
| 盗塁企図 1チーム | 105〜110 | ±15 → **`it.fails` で登録（提案D）** |

幅の根拠: ベースライン5シードで防御率のシード間幅が約 0.4（3.39〜3.76）、WHIP が 0.07、打率が .009、OPS が .029。
「平均は目標の中、各シードは目標±（シード間幅の半分程度）」が、回帰を検知しつつシードのゆらぎで落ちない幅。

**注意**: 防御率と1試合平均得点の目標は両立範囲が狭い。自責点比率 ≈ 90% なので R/G 4.0 で防御率 3.6 に達する。
両方を満たすには **R/G 3.65〜4.0**、中心 3.8 を狙う（防御率 ≈ 3.4）。

### 落ちる順序

タスク2完了時点では較正テストが落ちる（両リーグDH前だが、既に seed 1・3 は防御率と WHIP が上限超え）。
タスク5完了で通る。盗塁企図は `it.fails` なので `npm test` 全体は通る。

---

## タスク3: diag-fatigue.ts の回復式

### 実装アプローチ

- `season.ts` の `dailyRecovery` を `export` し、`diag-fatigue.ts` は import する。写しのコメントと式を削除
- 同種の「写し」は grep で `diag-fatigue.ts` の1箇所のみ。ただし **`validate.ts` の `emptyLike()` と `sumPitching()` が `stats.ts` の `emptyBatting()` / `emptyPitching()` のフィールド列を写している**。タスク4で `BattingStats` にフィールドを足すとここが壊れるので、`stats.ts` の関数を使う形に直す（同じパターンの解消）
- 新規 `scripts/diag-usage.ts`（`npm run diag:usage`）を追加し、以下を測る
  - 救援の連投: 3連投・4連投・5連投以上の年間回数（12球団合計と1チーム平均）
  - 完投数（1チーム年）、1試合最多球数
  - 先発の登板間隔の分布
  - 盗塁企図（1チーム）と成功率
- 測った数字は README「既知の問題」に記録する。**モデルは直さない**

---

## タスク4: DH を打順の枠として型に入れる

### データ構造の変更

```ts
// ratings.ts
export const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const; // 変更なし（コメントを直す）
export type Position = (typeof POSITIONS)[number];
/** 打順の枠。守備位置9つ + 指名打者。守備力はこの型では持たない */
export const LINEUP_SLOTS = [...POSITIONS, 'DH'] as const;
export type LineupSlot = (typeof LINEUP_SLOTS)[number];
// FieldingByPosition = Record<Position, number> は変更なし
```

```ts
// stats.ts
export interface BattingStats {
  ...既存...
  /** 打順枠ごとの出場試合数。守備位置補正は主ポジションではなくこの内訳で按分する */
  appearances: Record<LineupSlot, number>;
}
```
`emptyBatting` / `addBatting` を appearances 対応にする（`addBatting` は数値フィールドと appearances を分けて加算）。

```ts
// lineup.ts
export interface Lineup {
  order: Player[];
  defense: Map<Position, Player>;
  /** 指名打者。DH制でない試合は null */
  dh: Player | null;
  startingPitcher: Player;
}
```

### game.ts

試合開始時に `defense` の各 `[pos, player]` で `appearances[pos] += 1`、`dh` があれば `appearances.DH += 1`、DH制でなければ先発投手に `appearances.P += 1`。

### advanced.ts（最小限）

```ts
const POSITIONAL_ADJUSTMENT_PER_162: Record<LineupSlot, number> = { ...既存MLB値, DH: -17.5 };
function positionalRuns(s: BattingStats): number {
  // 出場した枠ごとに按分。遊撃手が DH で休んだ日は DH の補正がつく
  return Σ_slot ADJ[slot] × s.appearances[slot] / 162;
}
export function battingWar(s: BattingStats, ctx: LeagueContext): number; // position 引数を削除
```
`buildLeagueContext` 内のリーグ補正の合計も同じ関数を使うので自動で追従する。

### 影響範囲

- `validate.ts` の `battingWar(..., player.primaryPosition, ctx)` 呼び出し → `battingWar(stats, ctx)`
- `validate.ts` の `emptyLike()` 等（タスク3で解消）
- MLB値のまま。DELTA 値への差し替えはスコープ外

---

## タスク5: 両リーグDHと再較正

### リーグ設定の型

```ts
// src/engine/league/config.ts
export interface LeagueDefinition {
  id: string;          // 'CENTRAL' など。型は string（リテラル型をやめる）
  name: string;
  /** 指名打者制。本拠地リーグのルールを試合に適用する（交流戦はNPBと同じ扱い） */
  dh: boolean;
}
export interface LeagueConfig {
  teams: readonly Team[];
  leagues: readonly LeagueDefinition[];
  /** 同一リーグ内の1カードあたり試合数（NPB: 25） */
  gamesVsSameLeague: number;
  /** 他リーグの1カードあたり試合数（NPB: 3） */
  gamesVsOtherLeague: number;
}
export function leagueOf(config, teamId): LeagueDefinition;
export function teamsInLeague(config, leagueId): Team[];
export function gamesPerTeam(config, teamId): number;   // 143 を導出する。ハードコードしない
export function validateConfig(config): void;           // 球団のリーグIDが定義済みか等
```

- `data/teams.ts`: `LeagueId` を `string` に、`usesDh` を**削除**。`NPB_DEFAULT_CONFIG` を追加（両リーグ `dh: true`、25/3）
- `game.ts`: `simulateGame(..., rules: GameRules)` で `GameRules = { dh: boolean }` を受ける。`usesDh` の import を消す
- `schedule.ts`: `generateSchedule(seed, config)`。`TEAMS` の直接参照をやめる
- `generate.ts`: `generateLeague(seed, teams)`。`TEAMS` の直接参照をやめる
- `season.ts`: `SeasonState.config`、`teams: Map<string, Team>`。`standings(season, leagueId: string)`。`teamById` の代わりに `season.teams.get()`
- `validate.ts`: 順位表のループを `season.config.leagues` に、「143試合」「規定打席 143×3.1」を `gamesPerTeam` から導出

DH を球団単位ではなくリーグ単位の設定にするのは、「DH有無・試合数・対戦数・球団リストを持つリーグ設定」という指示と、将来のリーグ再編オプション（DH無しリーグを設定で作れる）に合わせるため。決定「両リーグDH」は既定設定の値として表現する。

### 再較正の方針（提案C）

**なぜ水準が上がるか**: セ球場の試合で打席に立っていた投手（ミート20前後、wOBA ≈ .200）が DH（wOBA ≈ .300前後の控え）に置き換わる。
投手はリーグ全打席の約 5.5% を占めていたので、リーグ wOBA が約 +14 ポイント上がる。これは実測の OPS +29（セ球場のみ）／全体 +15 と一致する。

**レバーの選択**:
- `SLOPE` は「能力値+10 でロジットがどれだけ動くか」で、母集団の平均が50なら**水準を一次では動かさない**（動くのは散らばり）。水準を SLOPE で直そうとすると、個人成績の散らばり（首位打者・本塁打王・防御率σ）を壊すか、打者側と投手側の非対称を深めるかのどちらかになる。これは requirements の禁止事項
- `LEAGUE_AVERAGE` は「50 vs 50 の対戦で出る結果分布」で、**水準そのもの**。現行値は .255/.322/.382（OPS .704）と目標の中心（.250/.315/.373、OPS .688）より高く、投手が打席に立つことで結果的に目標へ収まっていた
- したがって主レバーはアンカー。「50 = 実際に出場している選手の平均」という基準と、「50 vs 50 = NPB平均」というアンカーの意味が、DH化で初めて素直に一致する

**手順**:
1. タスク1〜4完了後、両リーグDH・現行定数で6シード回して「変更前」を記録する
2. `LEAGUE_AVERAGE` を、R/G 3.8・打率 .248・出塁率 .313・OPS .680 前後（防御率 ≈ 3.4）を狙って引き下げる。SINGLE / DOUBLE / HR / BB を下げ、OUT_IN_PLAY に戻す。合計1を維持
3. 6シードで水準を確認。`diag` で散らばり（首位打者 .320〜.350、本塁打王 30〜40、規定投球回の防御率 σ ≈ 0.65、OPS σ ≈ .090）を確認
4. 散らばりが目標を外れた場合のみ SLOPE を触る。**打者側と投手側を同方向・同比率で**動かし、非対称の比（batterHR/pitcherHR ≈ 2.1、batterK/pitcherK ≈ 1.9）を深めない。変更前後の値と理由を README に記録する
5. 較正テストが通ることを確認し、README の較正表を書き直す

SLOPE を変えずに済んだ場合は「変えなかった理由（水準はアンカーで制御した）」を README に書く。

---

## タスク6: クラッチの係数化

### 係数 f（提案A）

```ts
// profile.ts
/** クラッチ+10 で実効ミート（投手は実効 hits）が何倍になるか。f(50) = 1.0 */
export const CLUTCH_GAIN_PER_10 = 0.09;
export function clutchFactor(clutch: number): number {
  return 1 + (CLUTCH_GAIN_PER_10 * (clutch - 50)) / 10;
}
// 打者: meet = meetAgainst(b, throws) × (risp ? clutchFactor(b.clutch) : 1)
// 投手: hits = p.hits × (risp ? clutchFactor(p.clutch) : 1) − fatiguePenalty
```
線形にする理由: 分布の平均が50なら `E[f] = 1` が厳密に成り立ち、リーグ得点が保存される。指数形だと歪んだ分布で平均がずれる。

**傾き 0.09 の根拠**（ソース未変更の事前計測、seed 20260915）:
- ミート1点あたりの wOBA 感度は **1.41 ポイント**（45〜55 の中心差分。主砲級62付近で1.48、控え35付近で1.33）
- スタメン相当108人にクラッチを σ10 で与え、`f` を掛けた実効ミートで（得点圏 wOBA − 通常 wOBA）の選手間 σ を出すと

| g | 正規 N(50,10) | 70 − Gamma(4,5) |
|---|---|---|
| 0.05 | 4.1 | 3.5 |
| 0.06 | 5.0 | 4.2 |
| 0.08 | 6.6 | 5.6 |
| 0.09（外挿） | ≈7.4 | ≈6.3 |
| 0.10（外挿） | ≈8.2 | ≈7.0 |

- 反射ガンマは標本の索引の取り方で正規より低く出ている（108人の小標本）。実装後に `diag:clutch` で全選手・大標本で測り直し、**σ が 6〜8 に入らなければ g を 0.08〜0.11 の範囲で1回だけ調整**する。それでも入らなければ報告する
- レビュー時の修正案（オフセット `meet + k(clutch−50)`, k≈0.3〜0.4）と比べると、g=0.09 はミート50で k≈0.45 に相当し、才能 σ の目標 6〜8 に届く。オフセット案の k=0.35 だと σ≈5 で目標に届かない
- 乗算なので主砲（ミート62）はクラッチ+10で +5.6点、控え（ミート35）は +3.2点。「勝負強さは実力の増幅」

**階層・プラトーンの保持**: 実効ミート = ミート × f なので、同じクラッチなら主砲は主砲のまま、対左と対右の差 `meetVsL − meetVsR` は `f` 倍されて残る。置換方式で消えていた2つがどちらも保たれる。テストで `corr(通常のプラトーン差, 得点圏のプラトーン差) > 0.95` と「主砲階層と控え階層の得点圏 wOBA 差が通常時の差の 0.9倍以上」を確認する。

### 分布（提案B）

```ts
// player/clutch.ts
/** クラッチの生成。平均50・σ10 だが上側の裾が薄い。70 を超えない */
export function drawClutch(rng: Rng): number {
  // Gamma(4, 5) = 指数乱数4つの和 × 5。Erlang なので専用サンプラー不要
  let g = 0;
  for (let i = 0; i < 4; i++) g += -Math.log(Math.max(rng.next(), Number.EPSILON));
  return clamp(Math.round(70 - 5 * g));
}
```

| 分布 | 平均 | σ | p50 | p90 | p99 | P(>60) | P(>65) | P(>70) | P(<30) | P(<20) |
|---|---|---|---|---|---|---|---|---|---|---|
| N(50,10)（比較用） | 50.0 | 10.0 | 50 | 63 | 73 | 14.7% | 6.1% | 2.0% | 2.0% | 0.1% |
| **70 − Gamma(4,5)** | 50.0 | 10.0 | 52 | 61 | 66 | 12.5% | **1.4%** | **0%** | 4.0% | 1.0% |
| 67.3 − Gamma(3,5.77) | 50.0 | 10.0 | 52 | 61 | 65 | 11.7% | 0.4% | 0% | 4.1% | 1.1% |

shape 4 を選ぶ理由:
- σ を 10 に保つので、**20-80 スケールとの1:1対応**（設計決定）がクラッチでも崩れない。「そうそう高くならない」は σ ではなく形で表現する
- 上限70 = 20-80 スケールの「70（plus-plus）」が到達可能な最高値。65超は1.4%（12球団の一軍野手 約200人中 3人）
- shape 3 は 65 超が 0.4% でほぼ「60台前半が天井」になり、勝負強いベテランの価値（決定）が薄い。shape 4 が「稀だが存在する」の中庸
- 下側は正規より厚い（30未満 4%）。「勝負弱い」選手が一定数いる
- **クラッチはミート・階層と独立**に引く（決定）。現行の `draw(talent, profile.meet×0.5, 11)` は階層と相関しているので置き換える
- **投手も同じ分布・同じ係数**で独立に引く（対称）。現行の `clamp(hits + N(0,7))` は hits と相関しているので置き換える。`derivePitching` の引数に clutch を足す

### 検証（diag:clutch とテスト）

1. **真の才能 σ**: 全野手（一軍出場者）について、リーグ平均投手相手の（得点圏 wOBA − 通常 wOBA）を解析的に計算し、σ が 6〜8 に入る
2. **得点保存**: 同じシードで「クラッチ全員50（f≡1）」と比べ、6シード平均の R/G の差が ±1% 以内
3. **階層・プラトーン**: 上記
4. **投手側**: 規定級投手の（防御率 − FIP）の σ が現実の目安 0.45 から大きく外れない（独立 σ10 で以前測ったときの値と比較）
5. **得点圏比率**: 24.9% 前後で変わっていない
6. `ratings.ts` のクラッチのコメントを係数型に書き直す

---

## 片付け

- `scripts/_rev_caps.ts` `_rev_clutch2.ts` `_rev_math.ts` `_rev_season.ts` を削除（typecheck も直る）

---

## 変更ファイル一覧

| ファイル | タスク | 変更 |
|---|---|---|
| `src/engine/rng.ts` | 1 | deriveSeed, RngStreams, serialize/restore |
| `src/engine/league/schedule.ts` | 1, 5 | `id`、config 引数 |
| `src/engine/league/season.ts` | 1, 3, 5 | streams・year・config、`dailyRecovery` export、standings |
| `src/engine/league/config.ts` | 5 | 新規: LeagueConfig |
| `src/engine/league/lineup.ts` | 4 | `Lineup.dh` |
| `src/engine/sim/game.ts` | 4, 5, 6 | appearances 記録、GameRules、usesDh 削除 |
| `src/engine/sim/stats.ts` | 4 | appearances |
| `src/engine/sim/profile.ts` | 6 | clutchFactor、置換→乗算、ヘッダコメント |
| `src/engine/player/ratings.ts` | 4, 6 | LINEUP_SLOTS、コメント修正 |
| `src/engine/player/clutch.ts` | 6 | 新規: drawClutch |
| `src/engine/player/generate.ts` | 5, 6 | teams 引数、clutch 生成 |
| `src/engine/player/arsenal.ts` | 6 | derivePitching に clutch |
| `src/engine/metrics/advanced.ts` | 4 | DH 補正、appearances 按分、battingWar 署名 |
| `src/engine/sim/oddsRatio.ts` | 5 | LEAGUE_AVERAGE 再設定 |
| `src/data/teams.ts` | 5 | LeagueId→string、usesDh 削除、NPB_DEFAULT_CONFIG |
| `scripts/validate.ts` | 3, 4, 5 | stats.ts の関数を使う、config から導出、battingWar |
| `scripts/diag-fatigue.ts` | 3 | dailyRecovery import |
| `scripts/diag-usage.ts` | 3 | 新規 |
| `scripts/diag-clutch.ts` | 6 | 新規 |
| `scripts/_rev_*.ts` | 片付け | 削除 |
| `test/*.test.ts` | 2 | 新規 |
| `package.json` / `tsconfig.json` | 2 | vitest、test script、include |
| `README.md` | 全部 | 較正表、モデルの要点（クラッチ・乱数・DH）、既知の簡略化・問題 |

## 影響範囲と後方互換

- `createSeason(seed)` の呼び出しは互換。ただし同じ seed でも生成されるリーグは変わる（乱数派生の変更）
- `simulateGame` と `generateLeague` と `generateSchedule` の署名が変わる。呼び出し元は `season.ts` とテストのみ
- `battingWar` の署名が変わる。呼び出し元は `validate.ts` のみ
- メモリ `project-design-decisions.md` の「クラッチ係数の傾きと分布形（未定）」は、本 design 承認後に確定値で更新する

## 検証手順（完了時）

```bash
cd prototype
npm run typecheck
npm test
npm run validate           # 6シード分は test が担う。目視は既定シード
npm run diag && npm run diag:fatigue && npm run diag:bullpen && npm run diag:usage && npm run diag:clutch
```
