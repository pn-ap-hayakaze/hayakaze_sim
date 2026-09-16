/**
 * 1試合のシミュレーション。
 *
 * 状態は「イニング・表裏・アウトカウント・走者」の4つ。
 * 打席ごとに Odds Ratio で結果を抽選し、走者を進める。
 *
 * NPB ルール: 延長12回まで、それでも決しなければ引き分け。
 */

import { Rng } from '../rng.js';
import type { Roster } from '../player/generate.js';
import type { Player, Position } from '../player/ratings.js';
import { buildLineup, bullpen, pitcherValue, type Lineup } from '../league/lineup.js';
import type { Team } from '../../data/teams.js';
import { usesDh } from '../../data/teams.js';
import { applyFielding, applyParkFactor, batterProfile, pitcherProfile } from './profile.js';
import { combine, sampleOutcome, type PaOutcome } from './oddsRatio.js';
import {
  emptyBatting,
  emptyPitching,
  type BattingStats,
  type PitchingStats,
} from './stats.js';
import { encodeBases, type PlateAppearanceEvent } from './events.js';

const MAX_INNINGS = 12;

/**
 * 投手のコンディション。試合をまたぐ疲労はシーズン側が持ち、
 * 試合シミュレーションはこの問い合わせ口を通してのみ参照する。
 */
export interface PitcherCondition {
  /** 疲労度 0〜100。0 が完全回復。登板で増え、休養で回復する */
  fatigue(p: Player): number;
}

/** 全員が完全回復している状態。単体テストや検証用 */
export const ALL_FRESH: PitcherCondition = {
  fatigue: () => 0,
};

/** この疲労度以上の投手は登板させない。体力の限界であり、連投日数のルールではない */
const FATIGUE_UNAVAILABLE = 60;
/** 疲労度1あたりの能力値低下 */
const FATIGUE_RATING_PENALTY = 0.15;
/** 継投順の判断で疲労度1あたりに引く能力値相当。疲労20で能力値12点、階層1つ分に相当する */
const FATIGUE_SELECTION_PENALTY = 0.6;

export interface GameResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  innings: number;
  /** 引き分け */
  tie: boolean;
  batting: Map<string, BattingStats>;
  pitching: Map<string, PitchingStats>;
  /** 打席ごとの記録。RE24・線形ウェイト・WPA の元データ */
  events: PlateAppearanceEvent[];
}

/** 攻撃中のチームの可変状態 */
interface TeamState {
  roster: Roster;
  lineup: Lineup;
  orderIndex: number;
  score: number;
  /** 現在の投手 */
  currentPitcher: Player;
  /** 現在の投手の推定投球数（疲労の代理変数） */
  pitcherPitches: number;
  /** 今日登板できるセットアッパー（能力−疲労の順） */
  setupAvailable: Player[];
  /** 今日登板できる中継ぎ（能力−疲労の順） */
  middleAvailable: Player[];
  closer: Player;
  closerUsed: boolean;
  /** 勝敗投手の判定に使う */
  startingPitcher: Player;
  condition: PitcherCondition;
}

interface Bases {
  first: Player | null;
  second: Player | null;
  third: Player | null;
}

export function simulateGame(
  homeRoster: Roster,
  awayRoster: Roster,
  homeStarter: Player,
  awayStarter: Player,
  homeTeam: Team,
  rng: Rng,
  condition: PitcherCondition = ALL_FRESH,
): GameResult {
  // 本拠地球場のリーグでDHの有無が決まる
  const dh = usesDh(homeTeam.league);

  const batting = new Map<string, BattingStats>();
  const pitching = new Map<string, PitchingStats>();
  const events: PlateAppearanceEvent[] = [];

  const home = createTeamState(homeRoster, homeStarter, dh, condition);
  const away = createTeamState(awayRoster, awayStarter, dh, condition);

  for (const state of [home, away]) {
    for (const p of state.lineup.order) statLine(batting, p.id).g += 1;
    const sp = statLine2(pitching, state.startingPitcher.id);
    sp.g += 1;
    sp.gs += 1;
  }

  let inning = 1;
  for (; inning <= MAX_INNINGS; inning++) {
    playHalfInning(away, home, homeTeam, rng, batting, pitching, events, inning, true);

    // 9回裏以降、ホームがリードしていれば裏の攻撃は不要（サヨナラ勝ちの逆）
    if (inning >= 9 && home.score > away.score) break;

    playHalfInning(home, away, homeTeam, rng, batting, pitching, events, inning, false);

    if (inning >= 9 && home.score !== away.score) break;
  }

  const result: GameResult = {
    homeTeamId: homeRoster.team.id,
    awayTeamId: awayRoster.team.id,
    homeScore: home.score,
    awayScore: away.score,
    innings: Math.min(inning, MAX_INNINGS),
    tie: home.score === away.score,
    batting,
    pitching,
    events,
  };

  assignDecisions(result, home, away, pitching);
  return result;
}

function createTeamState(
  roster: Roster,
  starter: Player,
  dh: boolean,
  condition: PitcherCondition,
): TeamState {
  const { closer, setup, middle } = bullpen(roster);

  // 疲れている投手ほど優先度を下げる。疲労度10で能力値6点相当。
  // 疲労を見ずに最上位の救援を毎試合使うと、年間136登板・222回という
  // 現実には存在しない成績が生まれた。
  const usageScore = (p: Player) =>
    pitcherValue(p) - condition.fatigue(p) * FATIGUE_SELECTION_PENALTY;
  const usable = (arms: Player[]) =>
    arms
      .filter((p) => condition.fatigue(p) < FATIGUE_UNAVAILABLE)
      .sort((a, b) => usageScore(b) - usageScore(a));

  const setupAvailable = usable(setup);
  const middleAvailable = usable(middle);

  // 守護神が疲れ切っている日は、登板可能なセットアッパーの筆頭がその役を担う
  let todaysCloser = closer;
  if (condition.fatigue(closer) >= FATIGUE_UNAVAILABLE) {
    todaysCloser = setupAvailable.shift() ?? middleAvailable.shift() ?? closer;
  }

  return {
    roster,
    lineup: buildLineup(roster, starter, dh),
    orderIndex: 0,
    score: 0,
    currentPitcher: starter,
    pitcherPitches: 0,
    setupAvailable,
    middleAvailable,
    closer: todaysCloser,
    closerUsed: false,
    startingPitcher: starter,
    condition,
  };
}

function statLine(map: Map<string, BattingStats>, id: string): BattingStats {
  let s = map.get(id);
  if (!s) {
    s = emptyBatting();
    map.set(id, s);
  }
  return s;
}

function statLine2(map: Map<string, PitchingStats>, id: string): PitchingStats {
  let s = map.get(id);
  if (!s) {
    s = emptyPitching();
    map.set(id, s);
  }
  return s;
}

/**
 * 守備力を2つの独立した指標に分解する。
 *  range: 打球への到達力。安打をアウトに変える力（守備範囲・反応）
 *  hands: 確実に処理する力。失策の少なさ（守備力・送球の正確さ）
 * この2つは別物で、範囲は広いがエラーも多い選手が成立する。
 */
interface DefenseLevel {
  range: number;
  hands: number;
}

function defenseLevel(lineup: Lineup): DefenseLevel {
  let rangeTotal = 0;
  let handsTotal = 0;
  let weightTotal = 0;
  for (const [pos, player] of lineup.defense) {
    const r = player.ratings;
    const reaction =
      (r.reaction.forward + r.reaction.backward + r.reaction.right + r.reaction.left) / 4;
    // 遊撃・二塁・中堅の守備は打球処理への寄与が大きい
    const weight = pos === 'SS' || pos === '2B' || pos === 'CF' ? 1.6 : 1.0;
    const fielding = r.fielding[pos as Position];
    rangeTotal += (fielding * 0.55 + reaction * 0.45) * weight;
    handsTotal += (fielding * 0.6 + r.throwing.armAccuracy * 0.4) * weight;
    weightTotal += weight;
  }
  return { range: rangeTotal / weightTotal, hands: handsTotal / weightTotal };
}

/**
 * インプレー打球が失策になる確率。
 * NPB の失策は1球団1試合あたり約0.6個、インプレー打球のおよそ2%にあたる。
 */
function errorRate(hands: number): number {
  return 0.027 * Math.exp((-0.25 * (hands - 50)) / 10);
}

function playHalfInning(
  offense: TeamState,
  defense: TeamState,
  homeTeam: Team,
  rng: Rng,
  batting: Map<string, BattingStats>,
  pitching: Map<string, PitchingStats>,
  events: PlateAppearanceEvent[],
  inning: number,
  top: boolean,
): void {
  const bases: Bases = { first: null, second: null, third: null };
  let outs = 0;
  const defLevel = defenseLevel(defense.lineup);
  // 失策が出た後にそのイニングで入った得点は自責点にしない（簡略化した自責点計算）
  let errorThisInning = false;

  while (outs < 3) {
    maybeChangePitcher(defense, offense, inning, rng, (p) => {
      statLine2(pitching, p.id).g += 1;
    });

    const batter = offense.lineup.order[offense.orderIndex % 9];
    offense.orderIndex++;
    const pitcher = defense.currentPitcher;

    // 盗塁の試み（一塁走者がいて二塁が空いている場合）
    if (bases.first && !bases.second && outs < 2) {
      const steal = attemptSteal(bases.first, defense.lineup, rng);
      if (steal !== 'none') {
        const runnerStats = statLine(batting, bases.first.id);
        if (steal === 'success') {
          runnerStats.sb += 1;
          bases.second = bases.first;
        } else {
          runnerStats.cs += 1;
          outs++;
          // アウトは盗塁を刺した時点の投手に記録する
          statLine2(pitching, defense.currentPitcher.id).outs += 1;
          if (outs >= 3) {
            bases.first = null;
            break;
          }
        }
        bases.first = null;
      }
    }

    // 盗塁の処理が終わった時点の状況を「打席前」として記録する
    const basesBefore = encodeBases(
      bases.first !== null,
      bases.second !== null,
      bases.third !== null,
    );
    const scoreDiffBefore = offense.score - defense.score;

    // 得点圏（二塁または三塁に走者）ではクラッチ能力が適用される
    const risp = bases.second !== null || bases.third !== null;
    const fatigue = defense.condition.fatigue(pitcher);
    const outcome = resolvePlateAppearance(
      batter,
      pitcher,
      defLevel.range,
      homeTeam,
      risp,
      fatigue,
      rng,
    );
    const pitches = estimatePitches(outcome);
    defense.pitcherPitches += pitches;

    const bStats = statLine(batting, batter.id);
    const pStats = statLine2(pitching, pitcher.id);
    bStats.pa += 1;
    pStats.bf += 1;
    pStats.pitches += pitches;

    const runsBefore = offense.score;
    const outsBefore = outs;
    let reachedOnError = false;

    switch (outcome) {
      case 'K':
        bStats.ab += 1;
        bStats.so += 1;
        pStats.so += 1;
        outs++;
        break;
      case 'BB':
        bStats.bb += 1;
        pStats.bb += 1;
        walkRunners(bases, batter, offense, batting);
        break;
      case 'HBP':
        bStats.hbp += 1;
        pStats.hbp += 1;
        walkRunners(bases, batter, offense, batting);
        break;
      case 'HR': {
        bStats.ab += 1;
        bStats.h += 1;
        bStats.hr += 1;
        pStats.h += 1;
        pStats.hr += 1;
        const runners = clearBases(bases);
        for (const r of runners) scoreRun(r, offense, batting);
        scoreRun(batter, offense, batting);
        break;
      }
      case 'TRIPLE': {
        bStats.ab += 1;
        bStats.h += 1;
        bStats.triple += 1;
        pStats.h += 1;
        for (const r of clearBases(bases)) scoreRun(r, offense, batting);
        bases.third = batter;
        break;
      }
      case 'DOUBLE': {
        bStats.ab += 1;
        bStats.h += 1;
        bStats.double += 1;
        pStats.h += 1;
        advanceOnDouble(bases, batter, offense, batting, rng);
        break;
      }
      case 'SINGLE': {
        bStats.ab += 1;
        bStats.h += 1;
        pStats.h += 1;
        advanceOnSingle(bases, batter, offense, batting, rng);
        break;
      }
      case 'OUT_IN_PLAY': {
        bStats.ab += 1;
        if (rng.chance(errorRate(defLevel.hands))) {
          // 失策。打者は出塁し、走者は1つ進む。アウトは増えない
          bStats.roe += 1;
          reachedOnError = true;
          errorThisInning = true;
          advanceOnError(bases, batter, offense, batting);
        } else {
          outs += resolveBattedOut(bases, batter, offense, batting, outs, rng);
        }
        break;
      }
    }

    const runsScored = offense.score - runsBefore;
    bStats.rbi += outcome === 'OUT_IN_PLAY' ? Math.min(runsScored, 1) : runsScored;
    pStats.r += runsScored;
    pStats.er += errorThisInning ? 0 : runsScored;
    // この打席で発生したアウトは、投げていた投手に記録する
    pStats.outs += outs - outsBefore;

    events.push({
      inning,
      top,
      batterId: batter.id,
      pitcherId: pitcher.id,
      outcome,
      reachedOnError,
      outsBefore,
      basesBefore,
      outsAfter: outs,
      basesAfter: encodeBases(
        bases.first !== null,
        bases.second !== null,
        bases.third !== null,
      ),
      runs: runsScored,
      scoreDiffBefore,
    });

    // サヨナラ: 9回裏以降にホーム（裏の攻撃側）が勝ち越したら即終了。
    // 以前は3アウトまで攻撃が続き、決勝点の後に毎シーズン約150打席・30得点が水増しされていた
    if (!top && inning >= 9 && offense.score > defense.score) break;
  }
}

/**
 * 打席結果1つあたりの推定投球数。
 * 三振と四球は球数を要し、初球打ちの凡打は少ない。リーグ平均はおよそ3.9球。
 * 打者数ではなく球数で疲労を測ることで、奪三振型の投手が
 * 「同じ打者数でより長いイニングを投げる」不合理を防ぐ。
 */
function estimatePitches(outcome: PaOutcome): number {
  switch (outcome) {
    case 'K':
      return 4.8;
    case 'BB':
      return 5.5;
    case 'HBP':
      return 3.2;
    case 'HR':
      return 3.6;
    case 'SINGLE':
    case 'DOUBLE':
    case 'TRIPLE':
      return 3.4;
    case 'OUT_IN_PLAY':
      return 3.3;
  }
}

function resolvePlateAppearance(
  batter: Player,
  pitcher: Player,
  defenseRange: number,
  homeTeam: Team,
  risp: boolean,
  fatigue: number,
  rng: Rng,
): PaOutcome {
  const bProfile = batterProfile(batter, pitcher.throws, risp);
  const pProfile = pitcherProfile(pitcher, risp, fatigue * FATIGUE_RATING_PENALTY);
  let rates = combine(bProfile, pProfile);
  rates = applyFielding(rates, defenseRange);
  rates = applyParkFactor(rates, homeTeam.homeRunFactor);
  return sampleOutcome(rates, rng);
}

/** 盗塁の試み。走者の盗塁技術と捕手の肩で決まる */
function attemptSteal(
  runner: Player,
  defenseLineup: Lineup,
  rng: Rng,
): 'none' | 'success' | 'caught' {
  const r = runner.ratings.running;
  // 盗塁企図率。分母260では盗塁王が21個、75では66個になった（現実は25〜45個）
  const aggression = (r.stealing * 0.6 + r.speed * 0.4 - 45) / 95;
  if (!rng.chance(Math.min(Math.max(aggression, 0.004), 0.35))) return 'none';

  const catcher = defenseLineup.defense.get('C');
  const arm = catcher
    ? catcher.ratings.throwing.armStrength * 0.6 + catcher.ratings.throwing.armAccuracy * 0.4
    : 50;
  const runnerSkill = r.stealing * 0.7 + r.speed * 0.3;
  const successRate = 0.7 + (runnerSkill - arm) * 0.006;
  return rng.chance(Math.min(Math.max(successRate, 0.3), 0.95)) ? 'success' : 'caught';
}

function scoreRun(
  runner: Player,
  offense: TeamState,
  batting: Map<string, BattingStats>,
): void {
  offense.score++;
  statLine(batting, runner.id).r += 1;
}

function clearBases(bases: Bases): Player[] {
  const runners = [bases.third, bases.second, bases.first].filter(
    (p): p is Player => p !== null,
  );
  bases.first = null;
  bases.second = null;
  bases.third = null;
  return runners;
}

/** 四死球による押し出し進塁 */
function walkRunners(
  bases: Bases,
  batter: Player,
  offense: TeamState,
  batting: Map<string, BattingStats>,
): void {
  if (bases.first) {
    if (bases.second) {
      if (bases.third) scoreRun(bases.third, offense, batting);
      bases.third = bases.second;
    }
    bases.second = bases.first;
  }
  bases.first = batter;
}

/** 失策による出塁。走者は1つずつ進む */
function advanceOnError(
  bases: Bases,
  batter: Player,
  offense: TeamState,
  batting: Map<string, BattingStats>,
): void {
  if (bases.third) scoreRun(bases.third, offense, batting);
  bases.third = bases.second;
  bases.second = bases.first;
  bases.first = batter;
}

/** 単打での進塁。走塁意識と走力で追加進塁の可否が決まる */
function advanceOnSingle(
  bases: Bases,
  batter: Player,
  offense: TeamState,
  batting: Map<string, BattingStats>,
  rng: Rng,
): void {
  if (bases.third) scoreRun(bases.third, offense, batting);
  bases.third = null;

  if (bases.second) {
    const r = bases.second.ratings.running;
    const chance = 0.55 + (r.speed * 0.6 + r.baserunning * 0.4 - 50) * 0.005;
    if (rng.chance(Math.min(Math.max(chance, 0.3), 0.9))) {
      scoreRun(bases.second, offense, batting);
    } else {
      bases.third = bases.second;
    }
    bases.second = null;
  }

  if (bases.first) {
    const r = bases.first.ratings.running;
    const chance = 0.28 + (r.speed * 0.6 + r.baserunning * 0.4 - 50) * 0.005;
    if (!bases.third && rng.chance(Math.min(Math.max(chance, 0.1), 0.6))) {
      bases.third = bases.first;
    } else if (!bases.second) {
      bases.second = bases.first;
    }
    bases.first = null;
  }

  bases.first = batter;
}

/** 二塁打での進塁 */
function advanceOnDouble(
  bases: Bases,
  batter: Player,
  offense: TeamState,
  batting: Map<string, BattingStats>,
  rng: Rng,
): void {
  if (bases.third) scoreRun(bases.third, offense, batting);
  if (bases.second) scoreRun(bases.second, offense, batting);
  bases.third = null;
  bases.second = null;

  if (bases.first) {
    const r = bases.first.ratings.running;
    const chance = 0.45 + (r.speed * 0.6 + r.baserunning * 0.4 - 50) * 0.006;
    if (rng.chance(Math.min(Math.max(chance, 0.2), 0.85))) {
      scoreRun(bases.first, offense, batting);
    } else {
      bases.third = bases.first;
    }
    bases.first = null;
  }

  bases.second = batter;
}

/**
 * インプレーのアウト。併殺・進塁打・犠飛を処理し、増えたアウト数を返す。
 */
function resolveBattedOut(
  bases: Bases,
  batter: Player,
  offense: TeamState,
  batting: Map<string, BattingStats>,
  outs: number,
  rng: Rng,
): number {
  // 併殺（一塁に走者、2アウト未満）
  if (bases.first && outs < 2) {
    const speed = batter.ratings.running.speed;
    const dpChance = 0.26 - (speed - 50) * 0.0022;
    if (rng.chance(Math.min(Math.max(dpChance, 0.08), 0.4))) {
      bases.first = null;
      // 併殺の間に三塁走者が生還するケース。ゴロ併殺では守備側が二塁・一塁で2つ取るので
      // 三塁走者はほぼ生還する。35% にしていたときは一塁走者の価値が過小評価され、
      // RE24 で「無死三塁 ≈ 無死一三塁」という単調性違反が出た。
      // 併殺で3アウトになる場合（1アウトから）はフォースアウト成立で得点は入らない。
      // 生還しなければ三塁に残る。以前は無条件に消していて、毎シーズン50〜65人の走者が
      // アウトにも残塁にもならず盤面から失われていた。
      if (bases.third && outs === 0 && rng.chance(0.85)) {
        scoreRun(bases.third, offense, batting);
        bases.third = null;
      }
      return 2;
    }
  }

  // 犠飛（三塁に走者、2アウト未満）
  if (bases.third && outs < 2 && rng.chance(0.28)) {
    scoreRun(bases.third, offense, batting);
    bases.third = null;
    return 1;
  }

  // 進塁打
  if (outs < 2 && rng.chance(0.18)) {
    if (bases.second && !bases.third) {
      bases.third = bases.second;
      bases.second = null;
    } else if (bases.first && !bases.second) {
      bases.second = bases.first;
      bases.first = null;
    }
  }

  return 1;
}

/**
 * 継投判断。
 * 先発は打者数がスタミナに基づく限界を超えたら降板。
 * リードしている9回は守護神を投入する。
 */
function maybeChangePitcher(
  defense: TeamState,
  offense: TeamState,
  inning: number,
  rng: Rng,
  onPitcherEntered: (p: Player) => void,
): void {
  const current = defense.currentPitcher;
  const stamina = current.ratings.pitching?.stamina ?? 50;

  // 9回、3点差以内のリード → 守護神
  const leading = defense.score > offense.score && defense.score - offense.score <= 3;
  if (inning >= 9 && leading && !defense.closerUsed && current !== defense.closer) {
    defense.currentPitcher = defense.closer;
    defense.closerUsed = true;
    defense.pitcherPitches = 0;
    onPitcherEntered(defense.closer);
    return;
  }

  // スタミナ由来の限界球数。先発は約100球（6回前後）、リリーフは約25球（1回強）。
  // 以前は打者数で管理していたが、奪三振型の投手が同じ打者数でより長い
  // イニングを投げてしまい、規定投球回の先発の防御率が平均2.9まで下がった。
  const fullLimit =
    current.pitcherRole === 'SP'
      ? 67 + stamina * 0.5 + rng.normal(0, 8)
      : 6 + stamina * 0.4 + rng.normal(0, 4);
  // 疲労が残っている投手は、その分だけ投げられる球数が減る。
  // 疲労度と同率で縮めると「疲れる→短くなる→登板数が増える→さらに疲れる」の
  // 悪循環に入ったので、半分の率にとどめる（疲労60で球数7割）
  const limit = fullLimit * (1 - defense.condition.fatigue(current) / 200);

  const armsLeft = defense.setupAvailable.length + defense.middleAvailable.length;
  if (defense.pitcherPitches >= limit && armsLeft > 0) {
    // 場面の重要度で役割を使い分ける。
    // 接戦の終盤はセットアッパー、それ以外は中継ぎ。役割の投手が尽きたら他方から補う。
    // 常に「いちばん良い投手」を選ぶと年間90登板の救援が生まれた。
    const margin = Math.abs(defense.score - offense.score);
    // 勝ちパターン投入の条件: 7回以降で、同点・3点以内のリード・1点ビハインドまで。
    // 「3点差以内なら常に」としたときは負け試合の終盤にもセットアッパーが出て、
    // 接戦終盤の需要が年間250登板に膨らみ、筆頭が94登板に達した。
    const lead = defense.score - offense.score;
    const highLeverage = inning >= 7 && lead >= -1 && lead <= 3;
    const setup = defense.setupAvailable;
    const middle = defense.middleAvailable;

    let next: Player | undefined;
    if (highLeverage) {
      next = setup.shift() ?? middle.shift();
    } else if (margin >= 6) {
      // 大差なら下位の中継ぎで消化する
      next = takeRandom(middle, Math.max(0, middle.length - 2), middle.length - 1, rng) ?? setup.pop();
    } else {
      // 中継ぎの上位から。同じ層の中は乱数で散らして負荷を均す
      next = takeRandom(middle, 0, Math.min(middle.length - 1, 2), rng) ?? setup.pop();
    }
    if (!next) return;

    defense.currentPitcher = next;
    defense.pitcherPitches = 0;
    onPitcherEntered(next);
  }
}

/** 配列の [from, to] の範囲から1人を乱数で取り出す。空なら undefined */
function takeRandom(arms: Player[], from: number, to: number, rng: Rng): Player | undefined {
  if (arms.length === 0) return undefined;
  const index = rng.int(from, to);
  return arms.splice(index, 1)[0];
}

/** 勝敗投手・セーブの割り当て（簡略版） */
function assignDecisions(
  result: GameResult,
  home: TeamState,
  away: TeamState,
  pitching: Map<string, PitchingStats>,
): void {
  if (result.tie) return;

  const homeWon = result.homeScore > result.awayScore;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;

  statLine2(pitching, winner.startingPitcher.id).w += 1;
  statLine2(pitching, loser.startingPitcher.id).l += 1;

  const margin = Math.abs(result.homeScore - result.awayScore);
  if (winner.closerUsed && margin <= 3) {
    statLine2(pitching, winner.closer.id).sv += 1;
  }
}
