/**
 * 日程生成。
 *
 * リーグ設定（LeagueConfig）から総当たりの対戦カードを作り、日付に落とす。
 * NPB 既定では
 *   同一リーグ 25 試合 × 5 球団 = 125 試合
 *   交流戦     3 試合 × 6 球団 =  18 試合
 *   合計                          143 試合
 * だが、球団数・リーグ数・試合数は設定から導出し、ここには埋め込まない。
 *
 * 日付は「開幕からの通算日数」で持つ。実カレンダーへの対応は後段で行う。
 * 月曜は原則試合なし（移動日）。
 */

import { Rng } from '../rng.js';
import type { Team } from '../../data/teams.js';
import { validateConfig, type LeagueConfig } from './config.js';

export interface ScheduledGame {
  /** 日程内の通し番号。試合用乱数の派生キーになる */
  id: number;
  /** 開幕を1日目とする通算日 */
  day: number;
  homeTeamId: string;
  awayTeamId: string;
  /** 交流戦か */
  interleague: boolean;
}

interface Matchup {
  homeTeamId: string;
  awayTeamId: string;
  interleague: boolean;
}

/** 総当たりの対戦カードを作る（ホーム／ビジターの振り分けを含む） */
function buildMatchups(rng: Rng, config: LeagueConfig): Matchup[] {
  const matchups: Matchup[] = [];
  const teams = config.teams;

  const addPair = (a: Team, b: Team, games: number, interleague: boolean) => {
    // ホームゲームを半分ずつに割り振る。奇数分は乱数で決める
    const aHome = Math.floor(games / 2) + (games % 2 === 1 && rng.chance(0.5) ? 1 : 0);
    for (let i = 0; i < games; i++) {
      const isAHome = i < aHome;
      matchups.push({
        homeTeamId: isAHome ? a.id : b.id,
        awayTeamId: isAHome ? b.id : a.id,
        interleague,
      });
    }
  };

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i];
      const b = teams[j];
      if (a.league === b.league) {
        addPair(a, b, config.gamesVsSameLeague, false);
      } else {
        addPair(a, b, config.gamesVsOtherLeague, true);
      }
    }
  }

  return matchups;
}

/**
 * 対戦カードを日程に落とす。
 * 各球団は1日1試合まで。月曜（day % 7 === 1）は試合を置かない。
 *
 * 貪欲法で埋める。厳密な最適化はしないが、143試合を破綻なく配置できる。
 */
export function generateSchedule(seed: number, config: LeagueConfig): ScheduledGame[] {
  validateConfig(config);
  const rng = new Rng(seed);
  const remaining = rng.shuffle(buildMatchups(rng, config));
  const games: ScheduledGame[] = [];
  const teamCount = config.teams.length;

  let day = 0;
  const gamesPlayed = new Map<string, number>(config.teams.map((t) => [t.id, 0]));
  // 上限日数は総試合数に比例させる。1日に最大 floor(球団数/2) 試合なので、その3倍あれば十分
  const maxDays = Math.max(400, Math.ceil((remaining.length / Math.floor(teamCount / 2)) * 3));

  while (remaining.length > 0) {
    day++;
    if (day % 7 === 1) continue; // 移動日
    if (day > maxDays) throw new Error('日程を生成できませんでした');

    const busy = new Set<string>();
    // 消化試合数が少ない球団を優先し、偏りを抑える
    remaining.sort(
      (a, b) =>
        Math.min(gamesPlayed.get(a.homeTeamId)!, gamesPlayed.get(a.awayTeamId)!) -
        Math.min(gamesPlayed.get(b.homeTeamId)!, gamesPlayed.get(b.awayTeamId)!),
    );

    for (let i = 0; i < remaining.length && busy.size < teamCount - 1; i++) {
      const m = remaining[i];
      if (busy.has(m.homeTeamId) || busy.has(m.awayTeamId)) continue;
      busy.add(m.homeTeamId);
      busy.add(m.awayTeamId);
      games.push({ id: -1, day, ...m });
      gamesPlayed.set(m.homeTeamId, gamesPlayed.get(m.homeTeamId)! + 1);
      gamesPlayed.set(m.awayTeamId, gamesPlayed.get(m.awayTeamId)! + 1);
      remaining.splice(i, 1);
      i--;
    }
  }

  games.sort((a, b) => a.day - b.day);
  games.forEach((g, i) => (g.id = i));
  return games;
}

/** 日ごとに試合をまとめる */
export function groupByDay(games: ScheduledGame[]): Map<number, ScheduledGame[]> {
  const byDay = new Map<number, ScheduledGame[]>();
  for (const g of games) {
    const list = byDay.get(g.day) ?? [];
    list.push(g);
    byDay.set(g.day, list);
  }
  return byDay;
}
