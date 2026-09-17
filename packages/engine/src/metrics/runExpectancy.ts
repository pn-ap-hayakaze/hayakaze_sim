/**
 * 得点期待値（RE24）と線形ウェイトの導出。
 *
 * 外部の定数を借りず、シミュレーション自身の打席記録から計算する。
 * これにより wOBA や wRC+ がエンジンの得点環境と内部的に整合する。
 * リーグ平均の分布（LEAGUE_AVERAGE）や走塁モデルを変えれば、ウェイトも自動で追従する。
 */

import { baseOutIndex } from '../sim/events.js';
import {
  LINEAR_WEIGHT_OUTCOMES,
  type LinearWeightOutcome,
  type PlateAppearanceEvent,
  type RunExpectancyTable,
} from '../types/stats.js';
import type { GameResult } from '../types/game.js';

/**
 * 標本が少ないセルの縮約先。MLB の一般的な RE24（2010年代）を NPB の得点環境に合わせて 0.92 倍した値。
 * 添字は baseOutIndex(outs, bases)。フルシーズンなら全セルに百件以上の標本があり、この表はほぼ効かない。
 * 開幕直後など標本が少ない時期に、稀な状態（無死三塁など）の期待値が 0 や極端な値になるのを防ぐ。
 */
const PRIOR_RUN_EXPECTANCY: readonly number[] = [
  // 0アウト: ---  1--   -2-   12-   --3   1-3   -23   123
  0.442, 0.791, 1.012, 1.325, 1.242, 1.638, 1.803, 2.107,
  // 1アウト
  0.23, 0.469, 0.607, 0.828, 0.874, 1.04, 1.27, 1.417,
  // 2アウト
  0.092, 0.202, 0.294, 0.396, 0.322, 0.442, 0.534, 0.69,
];

/** 事前表の重み（標本数換算）。標本10件で半々、100件で1割弱、1000件で1%程度になる */
const PRIOR_WEIGHT = 10;

/** 1試合分のイベントを半イニングごとに分ける（記録順を保つ） */
function splitHalfInnings(events: PlateAppearanceEvent[]): PlateAppearanceEvent[][] {
  const halves: PlateAppearanceEvent[][] = [];
  let current: PlateAppearanceEvent[] = [];
  let key = '';
  for (const e of events) {
    const k = `${e.inning}-${e.top ? 'T' : 'B'}`;
    if (k !== key) {
      if (current.length > 0) halves.push(current);
      current = [];
      key = k;
    }
    current.push(e);
  }
  if (current.length > 0) halves.push(current);
  return halves;
}

/**
 * 得点期待値表を作る。
 * 各打席の「打席前の状態」に、その半イニングの残り得点（この打席を含む）を記録し平均する。
 *
 * サヨナラで途中終了した半イニングは、残り得点が決勝点で頭打ちになり期待値を過小評価するので
 * 標本から除外する（標準的な RE24 の作法）。線形ウェイトの導出（ΔRE）では RE(打席後) を使うので
 * 打ち切られた打席もそのまま使える。
 */
export function buildRunExpectancy(results: GameResult[]): RunExpectancyTable {
  const total = new Array<number>(24).fill(0);
  const samples = new Array<number>(24).fill(0);
  let invariantViolations = 0;
  let truncatedHalfInnings = 0;

  for (const game of results) {
    for (const half of splitHalfInnings(game.events)) {
      for (const e of half) {
        if (e.outsAfter >= 3 && e.runs > 0) invariantViolations++;
      }

      const last = half[half.length - 1];
      if (last.outsAfter < 3) {
        truncatedHalfInnings++;
        continue;
      }

      const runsInHalf = half.reduce((sum, e) => sum + e.runs, 0);
      let runsSoFar = 0;
      for (const e of half) {
        const index = baseOutIndex(e.outsBefore, e.basesBefore);
        total[index] += runsInHalf - runsSoFar;
        samples[index] += 1;
        runsSoFar += e.runs;
      }
    }
  }

  // 標本の少ないセルは事前表へ縮約する。標本 0 のセルが期待値 0 になって ΔRE を歪めるのを防ぐ
  const expected = total.map(
    (t, i) => (t + PRIOR_WEIGHT * PRIOR_RUN_EXPECTANCY[i]) / (samples[i] + PRIOR_WEIGHT),
  );
  return { expected, samples, invariantViolations, truncatedHalfInnings };
}

/** 打席後の状態の得点期待値。3アウトならイニング終了で 0 */
function expectedAfter(e: PlateAppearanceEvent, re: RunExpectancyTable): number {
  if (e.outsAfter >= 3) return 0;
  return re.expected[baseOutIndex(e.outsAfter, e.basesAfter)];
}

export function linearWeightOutcome(e: PlateAppearanceEvent): LinearWeightOutcome {
  return e.reachedOnError ? 'ROE' : e.outcome;
}

/**
 * 結果ごとの線形ウェイト（1回あたりの得点価値）。
 *   ΔRE = RE(打席後) + その打席の得点 − RE(打席前)
 * を結果ごとに平均したもの。全打席の平均はほぼ 0 になる。
 */
export function deriveLinearWeights(
  results: GameResult[],
  re: RunExpectancyTable,
): { weights: Record<LinearWeightOutcome, number>; counts: Record<LinearWeightOutcome, number> } {
  const sum = {} as Record<LinearWeightOutcome, number>;
  const counts = {} as Record<LinearWeightOutcome, number>;
  for (const o of LINEAR_WEIGHT_OUTCOMES) {
    sum[o] = 0;
    counts[o] = 0;
  }

  for (const game of results) {
    for (const e of game.events) {
      const key = linearWeightOutcome(e);
      const before = re.expected[baseOutIndex(e.outsBefore, e.basesBefore)];
      sum[key] += expectedAfter(e, re) + e.runs - before;
      counts[key] += 1;
    }
  }

  const weights = {} as Record<LinearWeightOutcome, number>;
  for (const o of LINEAR_WEIGHT_OUTCOMES) {
    weights[o] = counts[o] > 0 ? sum[o] / counts[o] : 0;
  }
  return { weights, counts };
}
