/**
 * 打席結果・成績・イベント・指標の型。ロジックは持たない。
 */

import type { LineupSlot } from './player.js';

export interface WobaWeights {
  bb: number;
  hbp: number;
  single: number;
  double: number;
  triple: number;
  hr: number;
}

export interface LeagueContext {
  runExpectancy: RunExpectancyTable;
  /** 結果ごとの線形ウェイト（アウトを基準にしない生の値） */
  linearWeights: Record<LinearWeightOutcome, number>;
  /** アウト1つの線形ウェイト。三振とインプレーのアウトの加重平均 */
  outWeight: number;
  wobaWeights: WobaWeights;
  /** wOBA を出塁率の尺度に合わせる倍率 */
  wobaScale: number;
  /** リーグ wOBA。構成上リーグ出塁率と一致する */
  leagueWoba: number;
  /** 1打席あたりのリーグ得点 */
  runsPerPa: number;
  leagueEra: number;
  /** 失点ベースの 9回あたり得点 */
  leagueRa9: number;
  /** FIP をリーグ防御率の尺度に合わせる定数 */
  cFip: number;
  /** 1勝に相当する得点。得点環境で変わる */
  runsPerWin: number;
  /**
   * 代替水準の野手が平均より低い得点（1打席あたり）。
   * FanGraphs: 代替水準の総量は 570勝/2430試合 で固定し、RPW で得点に換算してリーグ全打席で割る。
   * RPW を動的に導出しているので、代替水準もそれに追従させる（「20点/600PA」の旧近似は使わない）
   */
  replacementRunsPerPa: number;
  /**
   * リーグ補正（1打席あたり）。野手全体の 打撃 + 走塁 + 守備位置 の合計を 0 に戻す。
   * wOBA の基準にはセ・リーグで打席に立つ投手も含まれるため、これがないと野手の合計が
   * 平均より上に浮く（実測で +300 点 ≒ +35 WAR）
   */
  leagueAdjustmentPerPa: number;
}

export interface ClutchAnalysis {
  batters: number;
  /**
   * 真のクラッチ才能: （得点圏 wOBA − 通常 wOBA）の選手間 σ（wOBA ポイント）。
   * スタメン（DH 込み 9 人 × 球団数）で測る。「50 = 出場している選手の平均」と同じ母集団で、
   * The Book の推定（レギュラー対象、σ≈8）と比べられる値
   */
  talentSd: number;
  /** 同じ σ を控えを含む全野手で測った値。乗算型なのでミートの低い控えは効きが小さく、スタメンより小さく出る */
  talentSdAll: number;
  /** スタメンの才能の平均。E[f]=1 なら 0 付近 */
  talentMean: number;
  /** 通常時のプラトーン差（対左 − 対右 wOBA）と得点圏でのプラトーン差の相関 */
  platoonCorrelation: number;
  /** 上位10%と下位10%（通常 wOBA 順）の wOBA 差。得点圏／通常 の比が 1 に近ければ階層が保たれている */
  tierGapNormal: number;
  tierGapRisp: number;
  /** 投手側の真の才能 σ（被 wOBA ポイント） */
  pitcherTalentSd: number;
  /** クラッチ値そのものの分布 */
  clutchMean: number;
  clutchSd: number;
  clutchMax: number;
  clutchAbove65: number;
}

export interface LeagueLevel {
  avg: number;
  obp: number;
  ops: number;
  /** 1チーム1試合あたりの得点 */
  runsPerGame: number;
  era: number;
  whip: number;
  /** 1チーム1シーズンあたりの盗塁企図（成功 + 失敗） */
  stealAttemptsPerClub: number;
  stealSuccessRate: number;
  kRate: number;
  bbRate: number;
  hrRate: number;
}

export interface MetricSpec<T> {
  /** 表示名 */
  label: string;
  /** 対象から数値を取り出す */
  value: (item: T) => number;
  /** false なら低いほど良い指標（FIP, 三振率など） */
  higherIsBetter?: boolean;
  /** 表示用の書式 */
  format?: (v: number) => string;
}

export interface PercentileCell {
  label: string;
  value: number;
  display: string;
  /** 1〜100 */
  percentile: number;
}

/** 線形ウェイトを持つ結果。失策出塁は打席結果とは別に扱う */
export type LinearWeightOutcome = PaOutcome | 'ROE';

export const LINEAR_WEIGHT_OUTCOMES: readonly LinearWeightOutcome[] = [
  'K',
  'BB',
  'HBP',
  'HR',
  'TRIPLE',
  'DOUBLE',
  'SINGLE',
  'OUT_IN_PLAY',
  'ROE',
];

/** 24状態（アウト数3 × 走者8）の得点期待値 */
export interface RunExpectancyTable {
  /** 添字は baseOutIndex(outs, bases)。その状態からイニング終了までに入る得点の平均（事前表に縮約済み） */
  expected: number[];
  /** 各状態の標本数（事前表の重みは含まない） */
  samples: number[];
  /**
   * 「3アウト目のプレーで得点が入った」打席の件数。野球規則上ありえない遷移で、0 でなければ
   * 試合シミュレーション側にバグがある（過去に併殺で3アウトになりながら三塁走者が生還する欠陥があった）
   */
  invariantViolations: number;
  /** 3アウトで終わらなかった半イニング（サヨナラ）の件数。RE の標本からは除外する */
  truncatedHalfInnings: number;
}

/**
 * 走者状態のビット表現。
 *   1 = 一塁, 2 = 二塁, 4 = 三塁
 * 0 = 走者なし … 7 = 満塁。アウト数(0〜2)と組み合わせて 24 状態になる。
 */
export type BaseState = number;

export const BASE_FIRST = 1;

export const BASE_SECOND = 2;

export const BASE_THIRD = 4;

export interface PlateAppearanceEvent {
  inning: number;
  /** 表（ビジターの攻撃）なら true */
  top: boolean;
  batterId: string;
  pitcherId: string;
  outcome: PaOutcome;
  /** インプレーのアウトが失策で出塁になった打席 */
  reachedOnError: boolean;
  /** 打席前のアウト数 0〜2 */
  outsBefore: number;
  basesBefore: BaseState;
  /** 打席後のアウト数 0〜3 */
  outsAfter: number;
  basesAfter: BaseState;
  /** この打席で入った得点 */
  runs: number;
  /** 打席前の得点差（攻撃側 − 守備側） */
  scoreDiffBefore: number;
}

/** 打席の結果カテゴリ */
export type PaOutcome =
  | 'K' // 三振
  | 'BB' // 四球
  | 'HBP' // 死球
  | 'HR' // 本塁打
  | 'TRIPLE' // 三塁打
  | 'DOUBLE' // 二塁打
  | 'SINGLE' // 単打
  | 'OUT_IN_PLAY'; // インプレーのアウト（凡打）

export const PA_OUTCOMES: readonly PaOutcome[] = [
  'K',
  'BB',
  'HBP',
  'HR',
  'TRIPLE',
  'DOUBLE',
  'SINGLE',
  'OUT_IN_PLAY',
];

export type OutcomeRates = Record<PaOutcome, number>;

export interface BattingStats {
  g: number;
  pa: number;
  ab: number;
  h: number;
  double: number;
  triple: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
  r: number;
  rbi: number;
  sb: number;
  cs: number;
  /** 失策出塁 */
  roe: number;
  /**
   * 打順枠ごとの出場試合数。
   * 守備位置補正は主ポジションではなくこの内訳で按分する。
   * 遊撃手が DH で休んだ日は遊撃ではなく DH の補正がつく
   */
  appearances: Record<LineupSlot, number>;
}

export interface PitchingStats {
  g: number;
  gs: number;
  outs: number;
  bf: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
  /** 推定投球数 */
  pitches: number;
  /** 失点 */
  r: number;
  /** 自責点 */
  er: number;
  w: number;
  l: number;
  sv: number;
  hld: number;
}
