/**
 * セイバーメトリクス指標: wOBA, wRC+, FIP, WAR。
 *
 * すべてリーグ環境（LeagueContext）を基準にした相対値。
 * LeagueContext はシーズンの打席記録から作るので、外部の定数に依存しない。
 *
 * WAR は FanGraphs 方式に倣う。
 *  野手: (打撃 wRAA + 走塁 + 守備位置補正 + リーグ補正 + 代替水準) / RPW
 *  投手: (平均との差 [勝/試合] + 代替水準 [勝/試合]) × IP/9
 *
 * WAR の注意:
 *  - 守備の貢献は未算入（打球の層を入れて個人に守備機会を帰属できるまで保留）
 *  - 走塁は盗塁・盗塁死の定数評価のみ
 *  - パークファクター補正なし
 *  - 守備位置補正は FanGraphs の MLB 値（NPB の DELTA 値への差し替えは実装フェーズ）
 * 「fWAR 相当の簡易版」として読むこと。
 */

import { buildRunExpectancy, deriveLinearWeights } from './runExpectancy.js';
import { LINEUP_SLOTS, type LineupSlot } from '../types/player.js';
import type { BattingStats, LeagueContext, PitchingStats, WobaWeights } from '../types/stats.js';
import type { SeasonState } from '../types/game.js';

/**
 * 打順枠ごとの補正（162試合あたりの得点）。FanGraphs の MLB 値をそのまま使う。
 * 難しい守備位置ほど、同じ打撃成績でも価値が高い。DH は守らないので最も低い。
 * 出場した枠ごとに按分するので、遊撃手が DH で出た日には遊撃の加点はつかない。
 */
const POSITIONAL_ADJUSTMENT_PER_162: Record<LineupSlot, number> = {
  C: 12.5,
  SS: 7.5,
  '2B': 2.5,
  '3B': 2.5,
  CF: 2.5,
  LF: -7.5,
  RF: -7.5,
  '1B': -12.5,
  DH: -17.5,
  P: 0,
};

/** FanGraphs: 代替水準の総量。2430試合（MLB 1シーズン）あたり 570 勝を野手に配る */
const REPLACEMENT_WINS_PER_2430_GAMES = 570;

/** 盗塁・盗塁死の得点価値（近似）。将来は線形ウェイト同様に導出する */
const STOLEN_BASE_RUNS = 0.2;
const CAUGHT_STEALING_RUNS = -0.4;

function sumBatting(season: SeasonState) {
  const t = { pa: 0, ab: 0, h: 0, double: 0, triple: 0, hr: 0, bb: 0, hbp: 0 };
  for (const s of season.battingStats.values()) {
    t.pa += s.pa;
    t.ab += s.ab;
    t.h += s.h;
    t.double += s.double;
    t.triple += s.triple;
    t.hr += s.hr;
    t.bb += s.bb;
    t.hbp += s.hbp;
  }
  return t;
}

function sumPitching(season: SeasonState) {
  const t = { outs: 0, h: 0, hr: 0, bb: 0, hbp: 0, so: 0, r: 0, er: 0 };
  for (const s of season.pitchingStats.values()) {
    t.outs += s.outs;
    t.h += s.h;
    t.hr += s.hr;
    t.bb += s.bb;
    t.hbp += s.hbp;
    t.so += s.so;
    t.r += s.r;
    t.er += s.er;
  }
  return t;
}

/** シーズンの記録からリーグ環境を組み立てる */
export function buildLeagueContext(season: SeasonState): LeagueContext {
  const runExpectancy = buildRunExpectancy(season.results);
  const { weights, counts } = deriveLinearWeights(season.results, runExpectancy);

  // アウトの価値。三振とインプレーのアウトを件数で加重平均する
  const outCount = counts.K + counts.OUT_IN_PLAY;
  const outWeight =
    outCount > 0 ? (weights.K * counts.K + weights.OUT_IN_PLAY * counts.OUT_IN_PLAY) / outCount : 0;

  const b = sumBatting(season);
  const singles = b.h - b.double - b.triple - b.hr;
  const denominator = b.ab + b.bb + b.hbp;
  const leagueObp = denominator > 0 ? (b.h + b.bb + b.hbp) / denominator : 0;

  // アウトを 0 とした生の重み
  const raw: WobaWeights = {
    bb: weights.BB - outWeight,
    hbp: weights.HBP - outWeight,
    single: weights.SINGLE - outWeight,
    double: weights.DOUBLE - outWeight,
    triple: weights.TRIPLE - outWeight,
    hr: weights.HR - outWeight,
  };
  const rawLeagueWoba =
    denominator > 0
      ? (raw.bb * b.bb +
          raw.hbp * b.hbp +
          raw.single * singles +
          raw.double * b.double +
          raw.triple * b.triple +
          raw.hr * b.hr) /
        denominator
      : 0;
  // 出塁率と同じ尺度に合わせる
  const wobaScale = rawLeagueWoba > 0 ? leagueObp / rawLeagueWoba : 1;
  const wobaWeights: WobaWeights = {
    bb: raw.bb * wobaScale,
    hbp: raw.hbp * wobaScale,
    single: raw.single * wobaScale,
    double: raw.double * wobaScale,
    triple: raw.triple * wobaScale,
    hr: raw.hr * wobaScale,
  };

  let leagueRuns = 0;
  for (const r of season.records.values()) leagueRuns += r.runsScored;
  const runsPerPa = b.pa > 0 ? leagueRuns / b.pa : 0;

  const p = sumPitching(season);
  const ip = p.outs / 3;
  const leagueEra = ip > 0 ? (p.er * 9) / ip : 0;
  const leagueRa9 = ip > 0 ? (p.r * 9) / ip : 0;
  const cFip = ip > 0 ? leagueEra - (13 * p.hr + 3 * (p.bb + p.hbp) - 2 * p.so) / ip : 0;

  // FanGraphs: RPW = 9 × (R/IP) × 1.5 + 3
  const runsPerWin = ip > 0 ? 9 * (p.r / ip) * 1.5 + 3 : 10;

  // 代替水準: 570勝 × (試合数/2430) を得点に換算し、リーグ全打席で割る
  const games = season.results.length;
  const replacementRunsPerPa =
    b.pa > 0 ? (REPLACEMENT_WINS_PER_2430_GAMES * (games / 2430) * runsPerWin) / b.pa : 0;

  const ctx: LeagueContext = {
    runExpectancy,
    linearWeights: weights,
    outWeight,
    wobaWeights,
    wobaScale,
    leagueWoba: leagueObp,
    runsPerPa,
    leagueEra,
    leagueRa9,
    cFip,
    runsPerWin,
    replacementRunsPerPa,
    leagueAdjustmentPerPa: 0,
  };

  // リーグ補正: 野手（投手を除く）の 打撃+走塁+守備位置 の合計が 0 になるよう配分する
  let aboveAverageRuns = 0;
  let fielderPa = 0;
  for (const [playerId, s] of season.battingStats) {
    const player = season.players.get(playerId);
    if (!player || player.primaryPosition === 'P') continue;
    aboveAverageRuns += wraa(s, ctx) + baserunningRuns(s) + positionalRuns(s);
    fielderPa += s.pa;
  }
  ctx.leagueAdjustmentPerPa = fielderPa > 0 ? -aboveAverageRuns / fielderPa : 0;

  return ctx;
}

export function woba(s: BattingStats, ctx: LeagueContext): number {
  const denominator = s.ab + s.bb + s.hbp;
  if (denominator === 0) return 0;
  const w = ctx.wobaWeights;
  const singles = s.h - s.double - s.triple - s.hr;
  return (
    (w.bb * s.bb +
      w.hbp * s.hbp +
      w.single * singles +
      w.double * s.double +
      w.triple * s.triple +
      w.hr * s.hr) /
    denominator
  );
}

/** 平均的な打者と比べて何点多く生み出したか */
export function wraa(s: BattingStats, ctx: LeagueContext): number {
  if (s.pa === 0) return 0;
  return ((woba(s, ctx) - ctx.leagueWoba) / ctx.wobaScale) * s.pa;
}

/** 100 がリーグ平均。パークファクター補正はしていない */
export function wrcPlus(s: BattingStats, ctx: LeagueContext): number {
  if (s.pa === 0 || ctx.runsPerPa === 0) return 0;
  return ((wraa(s, ctx) / s.pa + ctx.runsPerPa) / ctx.runsPerPa) * 100;
}

export function fip(s: PitchingStats, ctx: LeagueContext): number {
  const ip = s.outs / 3;
  if (ip === 0) return 0;
  return (13 * s.hr + 3 * (s.bb + s.hbp) - 2 * s.so) / ip + ctx.cFip;
}

/** 走塁の得点（盗塁のみ） */
function baserunningRuns(s: BattingStats): number {
  return s.sb * STOLEN_BASE_RUNS + s.cs * CAUGHT_STEALING_RUNS;
}

/** 守備位置補正の得点。出場した枠ごとに、162試合あたりの値を出場試合数で按分する */
export function positionalRuns(s: BattingStats): number {
  let runs = 0;
  for (const slot of LINEUP_SLOTS) {
    runs += POSITIONAL_ADJUSTMENT_PER_162[slot] * (s.appearances[slot] / 162);
  }
  return runs;
}

/** 野手の WAR。守備は未算入 */
export function battingWar(s: BattingStats, ctx: LeagueContext): number {
  if (s.pa === 0) return 0;
  const runs =
    wraa(s, ctx) +
    baserunningRuns(s) +
    positionalRuns(s) +
    ctx.leagueAdjustmentPerPa * s.pa +
    ctx.replacementRunsPerPa * s.pa;
  return runs / ctx.runsPerWin;
}

/**
 * 投手の WAR。FIP を土台にする FanGraphs 方式。
 *
 *   FIPR9    = FIP + (lgRA9 − lgERA)            … FIP を失点の尺度に
 *   RAAP9    = lgFIPR9 − FIPR9                   … 9回あたりの平均との差（得点）
 *   dRPW     = ((18 − IP/G)×lgFIPR9 + (IP/G)×FIPR9)/18 × 1.5 + 3 … 投手自身の失点環境を織り込んだ1勝あたり得点
 *   WPGAA    = RAAP9 / dRPW                      … 1試合(9回)あたりの平均との差（勝）
 *   代替水準 = 0.03×(1 − GS/G) + 0.12×(GS/G)     … 1試合あたりの勝。平均(.500)に対し先発の代替は .380、救援は .470
 *   WAR      = (WPGAA + 代替水準) × IP/9
 *
 * 代替水準は「勝/試合」であり「失点の割合」ではない。以前は lgFIPR9 × 1.12 と失点の割合として
 * 適用しており、投手 WAR が定義の 44% しか出ていなかった（FIP 2.57 の先発で 3.1、正しくは約 4.2）。
 */
export function pitchingWar(s: PitchingStats, ctx: LeagueContext): number {
  const ip = s.outs / 3;
  if (ip === 0 || s.g === 0) return 0;

  const fipR9 = fip(s, ctx) + (ctx.leagueRa9 - ctx.leagueEra);
  const leagueFipR9 = ctx.leagueRa9;

  const ipPerGame = ip / s.g;
  const dynamicRpw = (((18 - ipPerGame) * leagueFipR9 + ipPerGame * fipR9) / 18) * 1.5 + 3;
  const winsPerGameAboveAverage = (leagueFipR9 - fipR9) / dynamicRpw;

  const starterShare = s.gs / s.g;
  const replacementLevel = 0.03 * (1 - starterShare) + 0.12 * starterShare;

  return (winsPerGameAboveAverage + replacementLevel) * (ip / 9);
}
