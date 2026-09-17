/**
 * クラッチ係数の較正解析。診断スクリプトとテストが共通に使う。
 *
 * 「真の才能」はシーズンの実測ではなく、能力値から解析的に計算する。
 * 実測の得点圏成績は打席数（1人あたり年150打席前後）の二項ノイズが才能の 5 倍あり、
 * 才能の σ を直接は読めないため。
 */

import { batterProfile, pitcherProfile } from '../sim/profile.js';
import { combine, type OutcomeRates } from '../sim/oddsRatio.js';
import type { Handedness, Player } from '../player/ratings.js';
import type { Roster } from '../player/generate.js';
import { buildLineup } from '../league/lineup.js';

/** wOBA の重み。シーズンから導出した値（seed 20260915）に近い固定値。解析の比較用なので固定でよい */
const WOBA = { bb: 0.73, hbp: 0.75, single: 0.88, double: 1.35, triple: 1.74, hr: 2.3 };

export function wobaOf(r: OutcomeRates): number {
  return (
    WOBA.bb * r.BB +
    WOBA.hbp * r.HBP +
    WOBA.single * r.SINGLE +
    WOBA.double * r.DOUBLE +
    WOBA.triple * r.TRIPLE +
    WOBA.hr * r.HR
  );
}

/** 能力値がすべて 50 の投手。クラッチも 50 なので係数は 1 */
const AVERAGE_PITCHER: Player = {
  id: 'avg-pitcher',
  name: '平均投手',
  teamId: '',
  age: 27,
  throws: 'R',
  bats: 'R',
  primaryPosition: 'P',
  pitcherRole: 'SP',
  ratings: {
    batting: {
      meetVsR: 50,
      meetVsL: 50,
      powerVsR: 50,
      powerVsL: 50,
      contact: 50,
      eye: 50,
      clutch: 50,
    },
    running: { speed: 50, stealing: 50, baserunning: 50 },
    throwing: { armStrength: 50, armAccuracy: 50 },
    reaction: { forward: 50, backward: 50, right: 50, left: 50 },
    fielding: { P: 50, C: 50, '1B': 50, '2B': 50, '3B': 50, SS: 50, LF: 50, CF: 50, RF: 50 },
    durability: 50,
    pitching: {
      hits: 50,
      homeRuns: 50,
      strikeouts: 50,
      walks: 50,
      stamina: 50,
      recovery: 50,
      clutch: 50,
      arsenal: [],
      speed: 50,
      breakAmount: 50,
      control: 50,
    },
  },
};

/** 打者の期待 wOBA（平均投手相手）。得点圏か否か、対戦投手の利き腕を指定する */
export function expectedWoba(batter: Player, throws: Handedness, risp: boolean): number {
  const pitcher = pitcherProfile(AVERAGE_PITCHER, false, 0);
  return wobaOf(combine(batterProfile(batter, throws, risp), pitcher));
}

/** 投手の期待被 wOBA（平均打者相手） */
export function expectedWobaAllowed(pitcher: Player, risp: boolean): number {
  const avgBatter = batterProfile(AVERAGE_PITCHER, 'R', false); // 能力50の打者プロファイル
  return wobaOf(combine(avgBatter, pitcherProfile(pitcher, risp, 0)));
}

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
export const stdev = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
export function correlation(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
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

export function analyzeClutch(rosters: Roster[]): ClutchAnalysis {
  // スタメン = DH 制で組んだ打順 9 人（投手を除く）
  const batters = rosters.flatMap((r) =>
    buildLineup(r, r.pitchers[0], true).order.filter((p) => p.primaryPosition !== 'P'),
  );
  const allBatters = rosters.flatMap((r) => r.batters);
  const pitchers = rosters.flatMap((r) => r.pitchers);

  const gapOfBatter = (b: Player) => expectedWoba(b, 'R', true) - expectedWoba(b, 'R', false);
  const normal = batters.map((b) => expectedWoba(b, 'R', false));
  const risp = batters.map((b) => expectedWoba(b, 'R', true));
  const gaps = risp.map((v, i) => v - normal[i]);
  const gapsAll = allBatters.map(gapOfBatter);

  const platoonNormal = batters.map(
    (b) => expectedWoba(b, 'L', false) - expectedWoba(b, 'R', false),
  );
  const platoonRisp = batters.map((b) => expectedWoba(b, 'L', true) - expectedWoba(b, 'R', true));

  const order = normal.map((_, i) => i).sort((a, b) => normal[b] - normal[a]);
  const decile = Math.max(1, Math.floor(batters.length / 10));
  const top = order.slice(0, decile);
  const bottom = order.slice(-decile);
  const gapOf = (xs: number[]) => mean(top.map((i) => xs[i])) - mean(bottom.map((i) => xs[i]));

  const pGaps = pitchers.map((p) => expectedWobaAllowed(p, true) - expectedWobaAllowed(p, false));
  const clutches = allBatters.map((b) => b.ratings.batting.clutch);

  return {
    batters: batters.length,
    talentSd: stdev(gaps) * 1000,
    talentSdAll: stdev(gapsAll) * 1000,
    talentMean: mean(gaps) * 1000,
    platoonCorrelation: correlation(platoonNormal, platoonRisp),
    tierGapNormal: gapOf(normal) * 1000,
    tierGapRisp: gapOf(risp) * 1000,
    pitcherTalentSd: stdev(pGaps) * 1000,
    clutchMean: mean(clutches),
    clutchSd: stdev(clutches),
    clutchMax: Math.max(...clutches),
    clutchAbove65: clutches.filter((c) => c > 65).length / clutches.length,
  };
}
