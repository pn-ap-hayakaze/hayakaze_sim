/**
 * リーグ構成の設定。
 *
 * 球団数・リーグ数・リーグごとの球団数・試合数はハードコードしない（設計決定）。
 * 日程・順位表・DH の有無はすべてこの設定から導出する。
 * シーズン1の既定値は NPB 準拠（12球団 2リーグ 6球団、同一リーグ25試合×5、交流戦3試合×6 = 143試合）。
 */

import type { Club } from '../data/clubs.js';

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

export function leagueOf(config: LeagueConfig, clubId: string): LeagueDefinition {
  const club = config.clubs.find((t) => t.id === clubId);
  if (!club) throw new Error(`不明な球団ID: ${clubId}`);
  const league = config.leagues.find((l) => l.id === club.league);
  if (!league) throw new Error(`球団 ${clubId} のリーグ ${club.league} が設定にありません`);
  return league;
}

export function clubsInLeague(config: LeagueConfig, leagueId: string): Club[] {
  return config.clubs.filter((t) => t.league === leagueId);
}

/** 1球団の年間試合数。同一リーグの他球団 × 同リーグ試合数 + 他リーグの球団 × 交流戦試合数 */
export function gamesPerClub(config: LeagueConfig, clubId: string): number {
  const league = leagueOf(config, clubId);
  const sameLeague = clubsInLeague(config, league.id).length - 1;
  const otherLeague = config.clubs.length - sameLeague - 1;
  return sameLeague * config.gamesVsSameLeague + otherLeague * config.gamesVsOtherLeague;
}

/** 設定の整合性を確認する。壊れた設定で日程生成に入って原因不明のエラーになるのを防ぐ */
export function validateConfig(config: LeagueConfig): void {
  if (config.clubs.length < 2) throw new Error('球団は2つ以上必要です');
  if (config.leagues.length < 1) throw new Error('リーグは1つ以上必要です');
  const ids = new Set<string>();
  for (const t of config.clubs) {
    if (ids.has(t.id)) throw new Error(`球団IDが重複しています: ${t.id}`);
    ids.add(t.id);
    leagueOf(config, t.id);
  }
  for (const l of config.leagues) {
    if (clubsInLeague(config, l.id).length === 0) {
      throw new Error(`リーグ ${l.id} に球団がありません`);
    }
  }
  if (config.gamesVsSameLeague < 0 || config.gamesVsOtherLeague < 0) {
    throw new Error('試合数は0以上にしてください');
  }
}
