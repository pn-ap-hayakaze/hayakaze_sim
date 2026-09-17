/**
 * リーグ構成の設定。
 *
 * 球団数・リーグ数・リーグごとの球団数・試合数はハードコードしない（設計決定）。
 * 日程・順位表・DH の有無はすべてこの設定から導出する。
 * シーズン1の既定値は NPB 準拠（12球団 2リーグ 6球団、同一リーグ25試合×5、交流戦3試合×6 = 143試合）。
 */

import type { Team } from '../data/teams.js';

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
  teams: readonly Team[];
  leagues: readonly LeagueDefinition[];
  /** 同一リーグ内の1カードあたりの試合数（NPB: 25） */
  gamesVsSameLeague: number;
  /** 他リーグの1カードあたりの試合数（NPB: 3） */
  gamesVsOtherLeague: number;
}

export function leagueOf(config: LeagueConfig, teamId: string): LeagueDefinition {
  const team = config.teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`不明な球団ID: ${teamId}`);
  const league = config.leagues.find((l) => l.id === team.league);
  if (!league) throw new Error(`球団 ${teamId} のリーグ ${team.league} が設定にありません`);
  return league;
}

export function teamsInLeague(config: LeagueConfig, leagueId: string): Team[] {
  return config.teams.filter((t) => t.league === leagueId);
}

/** 1球団の年間試合数。同一リーグの他球団 × 同リーグ試合数 + 他リーグの球団 × 交流戦試合数 */
export function gamesPerTeam(config: LeagueConfig, teamId: string): number {
  const league = leagueOf(config, teamId);
  const sameLeague = teamsInLeague(config, league.id).length - 1;
  const otherLeague = config.teams.length - sameLeague - 1;
  return sameLeague * config.gamesVsSameLeague + otherLeague * config.gamesVsOtherLeague;
}

/** 設定の整合性を確認する。壊れた設定で日程生成に入って原因不明のエラーになるのを防ぐ */
export function validateConfig(config: LeagueConfig): void {
  if (config.teams.length < 2) throw new Error('球団は2つ以上必要です');
  if (config.leagues.length < 1) throw new Error('リーグは1つ以上必要です');
  const ids = new Set<string>();
  for (const t of config.teams) {
    if (ids.has(t.id)) throw new Error(`球団IDが重複しています: ${t.id}`);
    ids.add(t.id);
    leagueOf(config, t.id);
  }
  for (const l of config.leagues) {
    if (teamsInLeague(config, l.id).length === 0) {
      throw new Error(`リーグ ${l.id} に球団がありません`);
    }
  }
  if (config.gamesVsSameLeague < 0 || config.gamesVsOtherLeague < 0) {
    throw new Error('試合数は0以上にしてください');
  }
}
