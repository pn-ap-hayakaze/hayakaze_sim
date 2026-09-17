/**
 * リーグ全体の水準。較正テスト・validate・診断で共通に使う。
 * 「1チームあたり」の値は球団数から導出し、12 を埋め込まない。
 */

import type { SeasonState } from '../league/season.js';
import { avg, era, obp, ops, sumBatting, sumPitching, whip } from '../sim/stats.js';

export interface LeagueLevel {
  avg: number;
  obp: number;
  ops: number;
  /** 1チーム1試合あたりの得点 */
  runsPerGame: number;
  era: number;
  whip: number;
  /** 1チーム1シーズンあたりの盗塁企図（成功 + 失敗） */
  stealAttemptsPerTeam: number;
  stealSuccessRate: number;
  kRate: number;
  bbRate: number;
  hrRate: number;
}

export function leagueLevel(season: SeasonState): LeagueLevel {
  const b = sumBatting(season.battingStats.values());
  const p = sumPitching(season.pitchingStats.values());
  const teams = season.rosters.size;
  const teamGames = season.results.length * 2;
  const attempts = b.sb + b.cs;
  return {
    avg: avg(b),
    obp: obp(b),
    ops: ops(b),
    runsPerGame: teamGames > 0 ? b.r / teamGames : 0,
    era: era(p),
    whip: whip(p),
    stealAttemptsPerTeam: teams > 0 ? attempts / teams : 0,
    stealSuccessRate: attempts > 0 ? b.sb / attempts : 0,
    kRate: b.pa > 0 ? b.so / b.pa : 0,
    bbRate: b.pa > 0 ? b.bb / b.pa : 0,
    hrRate: b.pa > 0 ? b.hr / b.pa : 0,
  };
}
