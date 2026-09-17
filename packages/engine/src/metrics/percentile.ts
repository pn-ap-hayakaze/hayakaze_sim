/**
 * パーセンタイル表示（Baseball Savant 風）。
 *
 * 選手の能力値や成績を「リーグ内で上位何%か」に変換する。
 * 100 が最上位、1 が最下位。低いほど良い指標（三振率など）は反転して扱う。
 */

import type { MetricSpec, PercentileCell } from '../types/stats.js';

/**
 * 母集団の中での value のパーセンタイル。
 * 同値は半分を下位とみなす（中央値ちょうどなら 50 になる）。
 */
export function percentileRank(
  population: readonly number[],
  value: number,
  higherIsBetter = true,
): number {
  if (population.length === 0) return 50;
  let below = 0;
  let equal = 0;
  for (const v of population) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  let p = ((below + equal / 2) / population.length) * 100;
  if (!higherIsBetter) p = 100 - p;
  return Math.min(100, Math.max(1, Math.round(p)));
}

/** 1人の選手について、複数指標のパーセンタイルをまとめて出す */
export function percentileCard<T>(
  subject: T,
  population: readonly T[],
  metrics: readonly MetricSpec<T>[],
): PercentileCell[] {
  return metrics.map((m) => {
    const values = population.map(m.value);
    const value = m.value(subject);
    return {
      label: m.label,
      value,
      display: m.format ? m.format(value) : String(Math.round(value)),
      percentile: percentileRank(values, value, m.higherIsBetter ?? true),
    };
  });
}

/** 端末表示用の簡易バー。UI では色付きの丸で表す想定 */
export function percentileBar(p: number, width = 20): string {
  const filled = Math.round((p / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}
