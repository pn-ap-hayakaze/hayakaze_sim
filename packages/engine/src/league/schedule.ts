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
import { validateConfig } from './config.js';
import type { Club } from '../types/club.js';
import type { LeagueConfig, ScheduledGame } from '../types/game.js';

interface Matchup {
  homeClubId: string;
  awayClubId: string;
  interleague: boolean;
}

/** 総当たりの対戦カードを作る（ホーム／ビジターの振り分けを含む） */
function buildMatchups(rng: Rng, config: LeagueConfig): Matchup[] {
  const matchups: Matchup[] = [];
  const clubs = config.clubs;

  const addPair = (a: Club, b: Club, games: number, interleague: boolean) => {
    // ホームゲームを半分ずつに割り振る。奇数分は乱数で決める
    const aHome = Math.floor(games / 2) + (games % 2 === 1 && rng.chance(0.5) ? 1 : 0);
    for (let i = 0; i < games; i++) {
      const isAHome = i < aHome;
      matchups.push({
        homeClubId: isAHome ? a.id : b.id,
        awayClubId: isAHome ? b.id : a.id,
        interleague,
      });
    }
  };

  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      const a = clubs[i];
      const b = clubs[j];
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
  const clubCount = config.clubs.length;

  let day = 0;
  const gamesPlayed = new Map<string, number>(config.clubs.map((t) => [t.id, 0]));
  // 上限日数は総試合数に比例させる。1日に最大 floor(球団数/2) 試合なので、その3倍あれば十分
  const maxDays = Math.max(400, Math.ceil((remaining.length / Math.floor(clubCount / 2)) * 3));

  while (remaining.length > 0) {
    day++;
    if (day % 7 === 1) continue; // 移動日
    if (day > maxDays) throw new Error('日程を生成できませんでした');

    const busy = new Set<string>();
    // 消化試合数が少ない球団を優先し、偏りを抑える
    remaining.sort(
      (a, b) =>
        Math.min(gamesPlayed.get(a.homeClubId)!, gamesPlayed.get(a.awayClubId)!) -
        Math.min(gamesPlayed.get(b.homeClubId)!, gamesPlayed.get(b.awayClubId)!),
    );

    for (let i = 0; i < remaining.length && busy.size < clubCount - 1; i++) {
      const m = remaining[i];
      if (busy.has(m.homeClubId) || busy.has(m.awayClubId)) continue;
      busy.add(m.homeClubId);
      busy.add(m.awayClubId);
      games.push({ id: -1, day, ...m });
      gamesPlayed.set(m.homeClubId, gamesPlayed.get(m.homeClubId)! + 1);
      gamesPlayed.set(m.awayClubId, gamesPlayed.get(m.awayClubId)! + 1);
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
