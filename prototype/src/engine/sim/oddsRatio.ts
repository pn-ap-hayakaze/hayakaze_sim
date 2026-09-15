/**
 * Odds Ratio Method による打席結果の決定。
 *
 * Tango らの log5 / Odds Ratio 法を多項分布に拡張したもの。
 * 結果 x について、打者の発生率 b、投手の被発生率 p、リーグ平均 l から
 *
 *   odds(x) = (b/(1-b)) * (p/(1-p)) / (l/(1-l))
 *   rate(x) = odds / (1 + odds)
 *
 * を計算し、全結果カテゴリで正規化して確率分布を得る。
 *
 * この方式の利点は「なぜこの確率になったか」を数式で説明できること。
 * 采配評価や試合後分析で寄与度を提示する基盤になる。
 */

import type { Rng } from '../rng.js';

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

/**
 * リーグ平均の打席結果分布。
 * 近年の NPB（打率.255 / 出塁率.322 / 長打率.382 前後）に合わせて調律してある。
 * ここを動かすとリーグ全体の成績水準が動く、最も感度の高い定数。
 */
export const LEAGUE_AVERAGE: OutcomeRates = {
  K: 0.19,
  BB: 0.078,
  HBP: 0.01,
  HR: 0.0215,
  TRIPLE: 0.005,
  DOUBLE: 0.039,
  SINGLE: 0.164,
  OUT_IN_PLAY: 0.4925,
};

/** 確率 → オッズ */
export function toOdds(p: number): number {
  const clamped = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return clamped / (1 - clamped);
}

/** オッズ → 確率 */
export function fromOdds(o: number): number {
  return o / (1 + o);
}

/**
 * 能力値（1〜99、平均50）をリーグ平均率からの倍率に変換する。
 *
 * ロジット空間で線形に効かせる。slope は「能力値が10上がったときに
 * そのカテゴリのオッズが何倍になるか」の対数。
 * 例: slope=0.30 なら能力値+10 でオッズ約1.35倍。
 */
export function ratingToRate(leagueRate: number, rating: number, slopePer10: number): number {
  const logit = Math.log(toOdds(leagueRate));
  return fromOdds(Math.exp(logit + (slopePer10 * (rating - 50)) / 10));
}

/**
 * Odds Ratio Method で打者・投手の率を合成する。
 * 守備側の影響（インプレー打球の処理力）は fieldingFactor で補正する。
 */
export function combine(
  batter: OutcomeRates,
  pitcher: OutcomeRates,
  league: OutcomeRates = LEAGUE_AVERAGE,
): OutcomeRates {
  const raw = {} as OutcomeRates;
  let total = 0;

  for (const outcome of PA_OUTCOMES) {
    const odds = (toOdds(batter[outcome]) * toOdds(pitcher[outcome])) / toOdds(league[outcome]);
    const rate = fromOdds(odds);
    raw[outcome] = rate;
    total += rate;
  }

  // 正規化して合計を 1 にする
  for (const outcome of PA_OUTCOMES) {
    raw[outcome] /= total;
  }
  return raw;
}

/** 確率分布から結果を1つ抽選する */
export function sampleOutcome(rates: OutcomeRates, rng: Rng): PaOutcome {
  const roll = rng.next();
  let cumulative = 0;
  for (const outcome of PA_OUTCOMES) {
    cumulative += rates[outcome];
    if (roll < cumulative) return outcome;
  }
  return 'OUT_IN_PLAY';
}
