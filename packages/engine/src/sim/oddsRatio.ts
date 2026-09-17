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
import { PA_OUTCOMES, type OutcomeRates, type PaOutcome } from '../types/stats.js';

/**
 * リーグ平均の打席結果分布。「能力値50の打者 vs 能力値50の投手」で出る結果の率。
 * ここを動かすとリーグ全体の成績水準が動く、最も感度の高い定数。
 *
 * 水準（リーグ打率など）はこのアンカーで、散らばり（個人差）は profile.ts の SLOPE で制御する。
 * 出場している選手の平均が50なら、リーグの実測はほぼこの値になる（能力値の散らばりによる
 * Jensen 効果で打率にして +.003 ほど上に出る）。
 *
 * 2026-09-16 両リーグ DH 化に伴い引き下げた。
 * 以前の値（K .19 / BB .078 / HR .0215 / 3B .005 / 2B .039 / 1B .164）は打率 .255・出塁率 .322 の
 * 水準で、セ球場で投手（wOBA ≈ .200）が打席に立つことで結果的にリーグ全体が目標に収まっていた。
 * DH で投手の打席（全打席の約5.5%）が控え野手に置き換わるとリーグ wOBA が約 +14 ポイント上がり、
 * 防御率 3.58・WHIP 1.35・出塁率 .323 と目標上限に乗ったため、アンカーを目標の中心
 * （打率 .248・出塁率 .313・1試合 3.8 得点）に合わせた。SLOPE は触っていない。
 */
export const LEAGUE_AVERAGE: OutcomeRates = {
  K: 0.19,
  BB: 0.075,
  HBP: 0.01,
  HR: 0.021,
  TRIPLE: 0.005,
  DOUBLE: 0.038,
  SINGLE: 0.16,
  OUT_IN_PLAY: 0.501,
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
