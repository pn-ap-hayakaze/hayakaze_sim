/**
 * 能力値 → 打席結果率プロファイルへの変換。
 *
 * ここが「能力値の意味」を定義する唯一の場所。
 * slope 定数はリーグ全体の成績分布が現実的になるよう調律する対象であり、
 * 変更した場合は必ず scripts/validate.ts でリーグ成績を再確認すること。
 *
 * 打者と投手の能力は次のように対になって打ち消し合う:
 *
 *   打者          投手            結果
 *   ミート    ⇄  H/9 (hits)      単打・二塁打
 *   パワー    ⇄  HR/9 (homeRuns) 本塁打
 *   コンタクト ⇄  K/9 (strikeouts) 三振
 *   選球眼    ⇄  BB/9 (walks)    四球
 *
 * 得点圏（走者二塁または三塁）では、打者はコンタクトの代わりにクラッチを、
 * 投手は H/9 の代わりにクラッチを使う。
 */

import { LEAGUE_AVERAGE, ratingToRate, type OutcomeRates, PA_OUTCOMES } from './oddsRatio.js';
import {
  meetAgainst,
  powerAgainst,
  type Handedness,
  type Player,
} from '../player/ratings.js';

/**
 * 能力値がオッズに与える傾き（能力値+10 あたりの対数オッズ増分）。
 * 符号に注意。打者にとって不利な結果（K）は負の傾きを持つ。
 *
 * 較正の基準:
 *   能力値50 = 一軍で実際に出場している選手の平均（控えを含む全登録選手の平均ではない）
 *   能力値の標準偏差 = 約10
 *   能力値+10 ごとに OPS が約 .075 動く（現実の一軍レギュラーの実力分布に相当）
 *
 * 傾きを大きくしすぎると、スター選手が打率.400を打つ非現実的なリーグになる。
 * 実際に一度 batterHit=0.30 で試したところリーグ打率が .292 になった。
 */
const SLOPE = {
  /** コンタクト力 → 三振率（下げる） */
  batterK: -0.23,
  /** 選球眼 → 四球率（上げる） */
  batterBB: 0.25,
  /** パワー → 本塁打率（上げる）。本塁打は個人差が大きいので傾きも大きい。0.40 では本塁打王が52本 */
  batterHR: 0.36,
  /** ミート → 単打・二塁打率（上げる）。0.14 では首位打者が .394 に達した */
  batterHit: 0.125,
  /** 走力 → 三塁打率（上げる） */
  batterTriple: 0.35,

  // 投手側の傾きは打者側より緩くする。
  // 1人の投手は1試合で全打者と対戦するため、能力差が成績に与える影響が
  // 打者より大きく出る。打者と同じ傾きにすると防御率の散らばりが
  // 標準偏差1.21（現実は0.65前後）まで広がり、防御率1.35の投手が生まれた。
  /** K/9 → 奪三振率（上げる） */
  pitcherK: 0.12,
  /** BB/9 → 与四球率（下げる） */
  pitcherBB: -0.14,
  /** HR/9 → 被本塁打率（下げる） */
  pitcherHR: -0.16,
  /** H/9 → 被安打率（下げる） */
  pitcherHit: -0.06,
} as const;

/** 合計を1に正規化する */
function normalize(rates: OutcomeRates): OutcomeRates {
  let total = 0;
  for (const o of PA_OUTCOMES) total += rates[o];
  const out = {} as OutcomeRates;
  for (const o of PA_OUTCOMES) out[o] = rates[o] / total;
  return out;
}

/**
 * 打者の結果率プロファイル。対戦投手の利き腕と得点圏か否かで変わる。
 *
 * OUT_IN_PLAY はリーグ平均のまま据え置く。
 * ここを「残差」(1 - 他カテゴリの合計) にすると能力差が二重に効いてしまう。
 * 優れた投手は各カテゴリが下がり、さらに残差が膨らみ、combine() の正規化で
 * もう一度圧縮される。実測では WHIP 0.76・防御率0.52 の投手が生まれた。
 * 正規化は combine() で一度だけ行うのが正しい。
 */
export function batterProfile(
  batter: Player,
  pitcherThrows: Handedness,
  risp: boolean,
): OutcomeRates {
  const b = batter.ratings.batting;
  const meet = meetAgainst(b, pitcherThrows);
  const power = powerAgainst(b, pitcherThrows);
  const speed = batter.ratings.running.speed;
  // 得点圏ではクラッチがコンタクト力になる
  const contact = risp ? b.clutch : b.contact;

  // 選球眼は三振回避にも部分的に寄与する（見極めて追い込まれない）
  const kResist = contact * 0.8 + b.eye * 0.2;

  return {
    K: ratingToRate(LEAGUE_AVERAGE.K, kResist, SLOPE.batterK),
    BB: ratingToRate(LEAGUE_AVERAGE.BB, b.eye, SLOPE.batterBB),
    HBP: LEAGUE_AVERAGE.HBP,
    HR: ratingToRate(LEAGUE_AVERAGE.HR, power * 0.75 + meet * 0.25, SLOPE.batterHR),
    TRIPLE: ratingToRate(LEAGUE_AVERAGE.TRIPLE, speed * 0.7 + meet * 0.3, SLOPE.batterTriple),
    DOUBLE: ratingToRate(LEAGUE_AVERAGE.DOUBLE, meet * 0.7 + power * 0.3, SLOPE.batterHit),
    SINGLE: ratingToRate(LEAGUE_AVERAGE.SINGLE, meet * 0.85 + speed * 0.15, SLOPE.batterHit),
    OUT_IN_PLAY: LEAGUE_AVERAGE.OUT_IN_PLAY,
  };
}

/**
 * 投手の被結果率プロファイル。得点圏では H/9 の代わりにクラッチを使う。
 *
 * @param fatiguePenalty 疲労による能力値の減少量。疲労度 × 0.15 程度を想定。
 *                       疲れた投手は球威と制球の両方が落ちる
 */
export function pitcherProfile(
  pitcher: Player,
  risp: boolean,
  fatiguePenalty = 0,
): OutcomeRates {
  const p = pitcher.ratings.pitching;
  if (!p) throw new Error(`投手能力を持たない選手が登板しました: ${pitcher.id}`);

  const hits = (risp ? p.clutch : p.hits) - fatiguePenalty;
  const strikeouts = p.strikeouts - fatiguePenalty;
  const walks = p.walks - fatiguePenalty;
  const homeRuns = p.homeRuns - fatiguePenalty;

  return {
    K: ratingToRate(LEAGUE_AVERAGE.K, strikeouts, SLOPE.pitcherK),
    BB: ratingToRate(LEAGUE_AVERAGE.BB, walks, SLOPE.pitcherBB),
    // 死球はゾーンに収める力の裏返し
    HBP: ratingToRate(LEAGUE_AVERAGE.HBP, walks, -0.2),
    HR: ratingToRate(LEAGUE_AVERAGE.HR, homeRuns, SLOPE.pitcherHR),
    TRIPLE: LEAGUE_AVERAGE.TRIPLE,
    DOUBLE: ratingToRate(LEAGUE_AVERAGE.DOUBLE, hits, SLOPE.pitcherHit),
    SINGLE: ratingToRate(LEAGUE_AVERAGE.SINGLE, hits, SLOPE.pitcherHit),
    OUT_IN_PLAY: LEAGUE_AVERAGE.OUT_IN_PLAY,
  };
}

/**
 * 守備陣の打球処理力による補正。
 * インプレー打球（単打・二塁打・三塁打 ⇄ アウト）の間だけを動かす。
 * 三振・四球・本塁打は守備の影響を受けないので触らない。
 *
 * @param fieldingLevel 守備側9人の加重平均能力値（50が平均）
 */
export function applyFielding(rates: OutcomeRates, fieldingLevel: number): OutcomeRates {
  // 能力値+10 でインプレー安打が約4%減る
  const factor = Math.exp((-0.04 * (fieldingLevel - 50)) / 10);
  const out = { ...rates };
  let delta = 0;
  for (const o of ['SINGLE', 'DOUBLE', 'TRIPLE'] as const) {
    const adjusted = out[o] * factor;
    delta += out[o] - adjusted;
    out[o] = adjusted;
  }
  out.OUT_IN_PLAY += delta;
  return normalize(out);
}

/** パークファクターによる本塁打補正 */
export function applyParkFactor(rates: OutcomeRates, homeRunFactor: number): OutcomeRates {
  const out = { ...rates };
  const adjusted = out.HR * homeRunFactor;
  out.OUT_IN_PLAY += out.HR - adjusted;
  out.HR = adjusted;
  return normalize(out);
}
