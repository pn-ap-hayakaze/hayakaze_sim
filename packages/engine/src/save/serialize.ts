/**
 * セーブ形式 v1。SeasonState を JSON にできるプレーンな構造に落とし、復元する。
 *
 * 保存しないもの（復元時に導出する）:
 *  - streams: masterSeed から createRngStreams で再構築する。試合用乱数は game(year, day, gameId) で
 *    状態を持たずに派生するので、Rng の内部状態を保存する必要がない
 *  - clubs: config.clubs から
 *  - players: rosters から（同一の Player オブジェクトを共有させる）
 *  - scheduleByDay: schedule から
 *
 * 打席イベント（results[].events）は v1 では全件保存する。GM 球団以外を集計して破棄する方針
 * （docs/functional-design.md 4.3）は GM 球団の概念が入る作業で実装する。
 */

import { createRngStreams } from '../rng.js';
import { groupByDay } from '../league/schedule.js';
import type { Player } from '../types/player.js';
import type { Club } from '../types/club.js';
import type {
  ClubRecord,
  GameResult,
  LeagueConfig,
  PitcherFatigue,
  Roster,
  ScheduledGame,
  SeasonState,
} from '../types/game.js';
import type { BattingStats, PitchingStats, PlateAppearanceEvent } from '../types/stats.js';

export const SAVE_VERSION = 1;

/** GameResult の Map を配列にしたもの */
export interface SerializedGameResult {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  innings: number;
  tie: boolean;
  batting: [string, BattingStats][];
  pitching: [string, PitchingStats][];
  events: PlateAppearanceEvent[];
}

export interface SeasonSave {
  version: typeof SAVE_VERSION;
  masterSeed: number;
  year: number;
  config: LeagueConfig;
  rosters: { clubId: string; batters: Player[]; pitchers: Player[] }[];
  schedule: ScheduledGame[];
  currentDay: number;
  lastDay: number;
  records: ClubRecord[];
  battingStats: [string, BattingStats][];
  pitchingStats: [string, PitchingStats][];
  gamesPlayed: [string, number][];
  pitcherFatigue: [string, PitcherFatigue][];
  results: SerializedGameResult[];
}

function serializeResult(r: GameResult): SerializedGameResult {
  return {
    homeClubId: r.homeClubId,
    awayClubId: r.awayClubId,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    innings: r.innings,
    tie: r.tie,
    batting: [...r.batting.entries()],
    pitching: [...r.pitching.entries()],
    events: r.events,
  };
}

function deserializeResult(r: SerializedGameResult): GameResult {
  return {
    homeClubId: r.homeClubId,
    awayClubId: r.awayClubId,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    innings: r.innings,
    tie: r.tie,
    batting: new Map(r.batting),
    pitching: new Map(r.pitching),
    events: r.events,
  };
}

/** SeasonState をプレーンな構造にする。返り値は JSON.stringify できる（Map を含まない） */
export function serializeSeason(season: SeasonState): SeasonSave {
  return {
    version: SAVE_VERSION,
    masterSeed: season.masterSeed,
    year: season.year,
    config: season.config,
    rosters: [...season.rosters.values()].map((r) => ({
      clubId: r.club.id,
      batters: r.batters,
      pitchers: r.pitchers,
    })),
    schedule: season.schedule,
    currentDay: season.currentDay,
    lastDay: season.lastDay,
    records: [...season.records.values()],
    battingStats: [...season.battingStats.entries()],
    pitchingStats: [...season.pitchingStats.entries()],
    gamesPlayed: [...season.gamesPlayed.entries()],
    pitcherFatigue: [...season.pitcherFatigue.entries()],
    results: season.results.map(serializeResult),
  };
}

/** セーブから SeasonState を復元する。以後の進行は保存せずに続けた場合と完全に一致する */
export function deserializeSeason(save: SeasonSave): SeasonState {
  if (save.version !== SAVE_VERSION) {
    throw new Error(`未対応のセーブ形式バージョンです: ${save.version}`);
  }
  const clubs = new Map<string, Club>(save.config.clubs.map((c) => [c.id, c]));
  const rosters = new Map<string, Roster>();
  const players = new Map<string, Player>();
  for (const r of save.rosters) {
    const club = clubs.get(r.clubId);
    if (!club) throw new Error(`セーブ内の球団IDが設定にありません: ${r.clubId}`);
    rosters.set(r.clubId, { club, batters: r.batters, pitchers: r.pitchers });
    for (const p of [...r.batters, ...r.pitchers]) players.set(p.id, p);
  }
  return {
    masterSeed: save.masterSeed,
    year: save.year,
    streams: createRngStreams(save.masterSeed),
    config: save.config,
    clubs,
    rosters,
    schedule: save.schedule,
    scheduleByDay: groupByDay(save.schedule),
    currentDay: save.currentDay,
    lastDay: save.lastDay,
    records: new Map(save.records.map((r) => [r.clubId, r])),
    battingStats: new Map(save.battingStats),
    pitchingStats: new Map(save.pitchingStats),
    gamesPlayed: new Map(save.gamesPlayed),
    players,
    pitcherFatigue: new Map(save.pitcherFatigue),
    results: save.results.map(deserializeResult),
  };
}
