/**
 * リーグ設定・日程・ロスター・試合・シーズン状態の型。ロジックは持たない。
 */

import type { Player, Position } from './player.js';
import type { Club } from './club.js';
import type { BattingStats, PitchingStats, PlateAppearanceEvent } from './stats.js';
import type { RngStreams } from '../rng.js';

export interface LeagueDefinition {
  /** 球団が参照するリーグID */
  id: string;
  name: string;
  /**
   * 指名打者制。本拠地のリーグのルールを試合に適用する（交流戦の扱いは NPB と同じ）。
   * 決定は両リーグ DH だが、リーグ再編オプションで DH なしのリーグも設定で作れるように残す
   */
  dh: boolean;
}

export interface LeagueConfig {
  clubs: readonly Club[];
  leagues: readonly LeagueDefinition[];
  /** 同一リーグ内の1カードあたりの試合数（NPB: 25） */
  gamesVsSameLeague: number;
  /** 他リーグの1カードあたりの試合数（NPB: 3） */
  gamesVsOtherLeague: number;
}

export interface Lineup {
  /** 打順1〜9。DH制なしの場合9番は投手 */
  order: Player[];
  /** 守備位置 → 選手。投手は含まない */
  defense: Map<Position, Player>;
  /** 指名打者。DH制でない試合は null */
  dh: Player | null;
  startingPitcher: Player;
}

/** ブルペンの役割分担 */
export interface Bullpen {
  /** 守護神。リードした9回に投げる */
  closer: Player;
  /**
   * セットアッパー3人（勝ちパターンの7回・8回・9回要員）。接戦の終盤に投げ、それ以外では温存する。
   * 2人では接戦終盤の需要（年間180登板前後）を賄えず、1人が95登板に達した
   */
  setup: Player[];
  /** 中継ぎ。接戦以外の場面を担う */
  middle: Player[];
}

export interface ScheduledGame {
  /** 日程内の通し番号。試合用乱数の派生キーになる */
  id: number;
  /** 開幕を1日目とする通算日 */
  day: number;
  homeClubId: string;
  awayClubId: string;
  /** 交流戦か */
  interleague: boolean;
}

export interface ClubRecord {
  clubId: string;
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

export interface SeasonState {
  /** すべての乱数ストリームの根。セーブデータに保存する値 */
  masterSeed: number;
  /** シーズン年。試合用乱数の派生キーの一部 */
  year: number;
  /** 用途別・試合別の乱数。試合ごとに game(year, day, gameId) で払い出す */
  streams: RngStreams;
  /** リーグ構成。DH の有無・試合数・順位表はここから導出する */
  config: LeagueConfig;
  /** 球団ID → 球団 */
  clubs: Map<string, Club>;
  rosters: Map<string, Roster>;
  schedule: ScheduledGame[];
  scheduleByDay: Map<number, ScheduledGame[]>;
  /** 次に進める日（1始まり） */
  currentDay: number;
  lastDay: number;
  records: Map<string, ClubRecord>;
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

export interface SeasonOptions {
  /** シーズン年（既定 1） */
  year?: number;
  /** 乱数ストリームの差し替え口。テストで特定の試合の乱数消費を変えるために使う */
  streams?: RngStreams;
  /** リーグ構成（既定は NPB 準拠・両リーグ DH） */
  config?: LeagueConfig;
}

export interface Roster {
  club: Club;
  batters: Player[];
  pitchers: Player[];
}

/**
 * 投手のコンディション。試合をまたぐ疲労はシーズン側が持ち、
 * 試合シミュレーションはこの問い合わせ口を通してのみ参照する。
 */
export interface PitcherCondition {
  /** 疲労度 0〜100。0 が完全回復。登板で増え、休養で回復する */
  fatigue(p: Player): number;
}

/**
 * この試合に適用するルール。リーグ設定から季節側が決めて渡す。
 * 試合シミュレーションはリーグの存在を知らない
 */
export interface GameRules {
  /** 指名打者制 */
  dh: boolean;
}

export interface GameResult {
  homeClubId: string;
  awayClubId: string;
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
