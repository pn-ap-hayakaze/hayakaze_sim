/**
 * シーズン進行。
 *
 * 時間送りは「1日 = 1ティック」に統一する。
 * 1試合ずつ送る／イベントまでスキップ／日付指定でスキップ のどれも、
 * advanceOneDay() の呼び出し回数が違うだけにする。挙動の乖離を防ぐため。
 */

import { Rng } from '../rng.js';
import { generateLeague, type Roster } from '../player/generate.js';
import { generateSchedule, groupByDay, type ScheduledGame } from './schedule.js';
import { rotationFor } from './lineup.js';
import { simulateGame, type GameResult, type PitcherCondition } from '../sim/game.js';
import type { Player } from '../player/ratings.js';
import { teamById } from '../../data/teams.js';
import {
  addBatting,
  addPitching,
  emptyBatting,
  emptyPitching,
  type BattingStats,
  type PitchingStats,
} from '../sim/stats.js';

export interface TeamRecord {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  runsScored: number;
  runsAllowed: number;
}

/**
 * 投手の疲労。
 * 登板すると球数に応じて増え、毎日スタミナに応じて回復する。
 * 「3連投禁止」のような日数ルールは置かず、疲労が体力の限界を決める。
 */
export interface PitcherFatigue {
  /** 疲労度 0〜100 */
  fatigue: number;
}

/**
 * 登板1回あたりの固定コスト（肩を作る負荷）。短い登板でも連投すれば積み上がる。
 * 8 では救援の登板時疲労度が中央値0にとどまり、最上位の救援が年間139登板した。
 */
const FATIGUE_PER_APPEARANCE = 22;
/** 1球あたりの疲労。先発の95球で約66（固定コストと合わせて約88）、救援の18球で約13 */
const FATIGUE_PER_PITCH = 0.7;

/**
 * 1日あたりの回復量。投手の「回復」能力で決まる。
 *   回復50: 20/日 → 先発（疲労約88）は中4日で回復しきる。中3日では疲労が残る
 *   回復30: 16/日、回復70: 24/日
 * 救援の1登板（約35）は回復50なら翌日15が残る。連投すると積み上がる。
 *
 * 以前はスタミナで回復を決めていたが、スタミナは「1試合で投げられる球数」であり
 * 日々の回復とは別の特性。混ぜると、能力もスタミナも高い救援だけが毎日選ばれた。
 */
function dailyRecovery(p: Player): number {
  const recovery = p.ratings.pitching?.recovery ?? 50;
  return 10 + recovery * 0.2;
}

export interface SeasonState {
  rng: Rng;
  rosters: Map<string, Roster>;
  schedule: ScheduledGame[];
  scheduleByDay: Map<number, ScheduledGame[]>;
  /** 次に進める日（1始まり） */
  currentDay: number;
  lastDay: number;
  records: Map<string, TeamRecord>;
  battingStats: Map<string, BattingStats>;
  pitchingStats: Map<string, PitchingStats>;
  /** 球団ごとの消化試合数。ローテーション決定に使う */
  gamesPlayed: Map<string, number>;
  /** 選手ID → 選手。疲労の回復計算などで使う索引 */
  players: Map<string, Player>;
  /** 投手ごとの疲労 */
  pitcherFatigue: Map<string, PitcherFatigue>;
  results: GameResult[];
}

export function createSeason(seed: number): SeasonState {
  const rosters = new Map<string, Roster>();
  const players = new Map<string, Player>();
  for (const roster of generateLeague(seed)) {
    rosters.set(roster.team.id, roster);
    for (const p of [...roster.batters, ...roster.pitchers]) players.set(p.id, p);
  }

  const schedule = generateSchedule(seed + 1);
  const records = new Map<string, TeamRecord>();
  const gamesPlayed = new Map<string, number>();
  for (const teamId of rosters.keys()) {
    records.set(teamId, {
      teamId,
      wins: 0,
      losses: 0,
      ties: 0,
      runsScored: 0,
      runsAllowed: 0,
    });
    gamesPlayed.set(teamId, 0);
  }

  return {
    rng: new Rng(seed + 2),
    rosters,
    schedule,
    scheduleByDay: groupByDay(schedule),
    currentDay: 1,
    lastDay: schedule.length > 0 ? schedule[schedule.length - 1].day : 0,
    records,
    battingStats: new Map(),
    pitchingStats: new Map(),
    gamesPlayed,
    players,
    pitcherFatigue: new Map(),
    results: [],
  };
}

function pitcherCondition(season: SeasonState): PitcherCondition {
  return {
    fatigue: (p: Player) => season.pitcherFatigue.get(p.id)?.fatigue ?? 0,
  };
}

/** 1日分の回復。試合のない移動日にも進む */
function recoverFatigue(season: SeasonState): void {
  for (const [playerId, state] of season.pitcherFatigue) {
    const player = season.players.get(playerId);
    if (!player) continue;
    state.fatigue = Math.max(0, state.fatigue - dailyRecovery(player));
  }
}

/** 今日登板した投手に疲労を加算する */
function accumulateFatigue(season: SeasonState, result: GameResult): void {
  for (const [playerId, stats] of result.pitching) {
    if (stats.g === 0) continue;
    const state = season.pitcherFatigue.get(playerId) ?? { fatigue: 0 };
    state.fatigue = Math.min(
      100,
      state.fatigue + FATIGUE_PER_APPEARANCE + stats.pitches * FATIGUE_PER_PITCH,
    );
    season.pitcherFatigue.set(playerId, state);
  }
}

/** 1日進める。その日に行われた試合を返す */
export function advanceOneDay(season: SeasonState): GameResult[] {
  // 前日からの回復を先に反映してから今日の試合に入る
  recoverFatigue(season);

  const today = season.scheduleByDay.get(season.currentDay) ?? [];
  const played: GameResult[] = [];
  const condition = pitcherCondition(season);

  for (const game of today) {
    const homeRoster = season.rosters.get(game.homeTeamId)!;
    const awayRoster = season.rosters.get(game.awayTeamId)!;

    const homeStarter = rotationFor(homeRoster, season.gamesPlayed.get(game.homeTeamId)!);
    const awayStarter = rotationFor(awayRoster, season.gamesPlayed.get(game.awayTeamId)!);

    const result = simulateGame(
      homeRoster,
      awayRoster,
      homeStarter,
      awayStarter,
      teamById(game.homeTeamId),
      season.rng,
      condition,
    );

    applyResult(season, result);
    accumulateFatigue(season, result);
    played.push(result);
    season.results.push(result);
  }

  season.currentDay++;
  return played;
}

/** 指定日まで進める */
export function advanceToDay(season: SeasonState, targetDay: number): void {
  while (season.currentDay <= targetDay && !isSeasonOver(season)) {
    advanceOneDay(season);
  }
}

/** シーズン終了まで進める */
export function advanceToEnd(season: SeasonState): void {
  while (!isSeasonOver(season)) {
    advanceOneDay(season);
  }
}

export function isSeasonOver(season: SeasonState): boolean {
  return season.currentDay > season.lastDay;
}

function applyResult(season: SeasonState, result: GameResult): void {
  const home = season.records.get(result.homeTeamId)!;
  const away = season.records.get(result.awayTeamId)!;

  home.runsScored += result.homeScore;
  home.runsAllowed += result.awayScore;
  away.runsScored += result.awayScore;
  away.runsAllowed += result.homeScore;

  if (result.tie) {
    home.ties++;
    away.ties++;
  } else if (result.homeScore > result.awayScore) {
    home.wins++;
    away.losses++;
  } else {
    away.wins++;
    home.losses++;
  }

  season.gamesPlayed.set(result.homeTeamId, season.gamesPlayed.get(result.homeTeamId)! + 1);
  season.gamesPlayed.set(result.awayTeamId, season.gamesPlayed.get(result.awayTeamId)! + 1);

  for (const [playerId, stats] of result.batting) {
    let target = season.battingStats.get(playerId);
    if (!target) {
      target = emptyBatting();
      season.battingStats.set(playerId, target);
    }
    addBatting(target, stats);
  }
  for (const [playerId, stats] of result.pitching) {
    let target = season.pitchingStats.get(playerId);
    if (!target) {
      target = emptyPitching();
      season.pitchingStats.set(playerId, target);
    }
    addPitching(target, stats);
  }
}

/** 勝率。引き分けは分母から除く（NPB方式） */
export function winPct(record: TeamRecord): number {
  const decided = record.wins + record.losses;
  return decided > 0 ? record.wins / decided : 0;
}

/** リーグ順位表 */
export function standings(season: SeasonState, league: 'CENTRAL' | 'PACIFIC'): TeamRecord[] {
  return [...season.records.values()]
    .filter((r) => teamById(r.teamId).league === league)
    .sort((a, b) => winPct(b) - winPct(a));
}

/** 首位とのゲーム差 */
export function gamesBehind(leader: TeamRecord, team: TeamRecord): number {
  return ((leader.wins - team.wins) + (team.losses - leader.losses)) / 2;
}
