/**
 * 較正の回帰テスト。
 *
 * リーグ水準が現実の NPB の目標レンジに入ることを、複数シードで許容幅つきにアサートする。
 * 2段構え:
 *   1. 全シードの平均が目標レンジに入る
 *   2. 各シードが「目標レンジを両側に tolerance だけ広げた帯」に入る
 * 幅の根拠はベースライン5シードのシード間のばらつき（防御率で約0.4、WHIP 0.07、打率 .009、OPS .029）。
 * 平均は目標の中、各シードはそのゆらぎの半分程度を許す。
 *
 * SLOPE・LEAGUE_AVERAGE・生成の階層・疲労係数を変えたときはこのテストで回帰を検知する。
 */
import { describe, expect, it } from 'vitest';
import { advanceToEnd, createSeason } from '../../src/league/season.js';
import { leagueLevel, type LeagueLevel } from '../../src/metrics/leagueLevel.js';

const SEEDS = [20260915, 1, 2, 3, 4, 5];

interface Target {
  key: keyof LeagueLevel;
  label: string;
  /** 現実の NPB の目標レンジ。平均はこの中に入る */
  lo: number;
  hi: number;
  /** 各シードに許す、目標レンジからのはみ出し幅 */
  tolerance: number;
}

const TARGETS: Target[] = [
  { key: 'avg', label: '打率', lo: 0.24, hi: 0.26, tolerance: 0.008 },
  { key: 'obp', label: '出塁率', lo: 0.305, hi: 0.325, tolerance: 0.008 },
  { key: 'ops', label: 'OPS', lo: 0.66, hi: 0.715, tolerance: 0.015 },
  { key: 'runsPerGame', label: '1試合平均得点', lo: 3.6, hi: 4.3, tolerance: 0.2 },
  { key: 'era', label: '防御率', lo: 3.0, hi: 3.6, tolerance: 0.2 },
  { key: 'whip', label: 'WHIP', lo: 1.24, hi: 1.35, tolerance: 0.04 },
  { key: 'stealSuccessRate', label: '盗塁成功率', lo: 0.65, hi: 0.75, tolerance: 0.03 },
];

/** 修正がスコープ外で、現状では目標に届かないことが分かっている項目。届いたら it.fails が落ちて気づける */
const KNOWN_FAILING: Target[] = [
  // attemptSteal が2アウトと三盗を許しておらず、チーム走塁方針のレバーもない。実測 66〜76/チーム
  { key: 'stealAttemptsPerTeam', label: '盗塁企図 1チーム', lo: 105, hi: 110, tolerance: 15 },
];

const levels: LeagueLevel[] = SEEDS.map((seed) => {
  const season = createSeason(seed);
  advanceToEnd(season);
  return leagueLevel(season);
});

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const describeValues = (t: Target) =>
  `${t.label}: ${levels.map((l) => l[t.key].toFixed(3)).join(' / ')} (平均 ${mean(levels.map((l) => l[t.key])).toFixed(3)}, 目標 ${t.lo}〜${t.hi})`;

function assertTarget(t: Target): void {
  const values = levels.map((l) => l[t.key]);
  const m = mean(values);
  expect(m, `平均が目標外 ${describeValues(t)}`).toBeGreaterThanOrEqual(t.lo);
  expect(m, `平均が目標外 ${describeValues(t)}`).toBeLessThanOrEqual(t.hi);
  for (const [i, v] of values.entries()) {
    expect(v, `seed ${SEEDS[i]} が許容帯外 ${describeValues(t)}`).toBeGreaterThanOrEqual(
      t.lo - t.tolerance,
    );
    expect(v, `seed ${SEEDS[i]} が許容帯外 ${describeValues(t)}`).toBeLessThanOrEqual(
      t.hi + t.tolerance,
    );
  }
}

describe(`リーグ水準の較正（${SEEDS.length}シード）`, () => {
  for (const t of TARGETS) {
    it(`${t.label} が ${t.lo}〜${t.hi}（各シード ±${t.tolerance}）`, () => assertTarget(t));
  }
  for (const t of KNOWN_FAILING) {
    it.fails(`[既知の問題・未修正] ${t.label} が ${t.lo}〜${t.hi}`, () => assertTarget(t));
  }
});
