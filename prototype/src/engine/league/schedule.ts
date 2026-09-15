/**
 * 日程生成。
 *
 * NPB の 143 試合制を再現する:
 *   同一リーグ 25 試合 × 5 球団 = 125 試合
 *   交流戦     3 試合 × 6 球団 =  18 試合
 *   合計                          143 試合
 *
 * 日付は「開幕からの通算日数」で持つ。実カレンダーへの対応は後段で行う。
 * 月曜は原則試合なし（移動日）。
 */

import { Rng } from '../rng.js';
import { TEAMS, type Team } from '../../data/teams.js';

export interface ScheduledGame {
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
function buildMatchups(rng: Rng): Matchup[] {
  const matchups: Matchup[] = [];

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

  for (let i = 0; i < TEAMS.length; i++) {
    for (let j = i + 1; j < TEAMS.length; j++) {
      const a = TEAMS[i];
      const b = TEAMS[j];
      if (a.league === b.league) {
        addPair(a, b, 25, false);
      } else {
        addPair(a, b, 3, true);
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
export function generateSchedule(seed: number): ScheduledGame[] {
  const rng = new Rng(seed);
  const remaining = rng.shuffle(buildMatchups(rng));
  const games: ScheduledGame[] = [];

  let day = 0;
  const gamesPlayed = new Map<string, number>(TEAMS.map((t) => [t.id, 0]));

  while (remaining.length > 0) {
    day++;
    if (day % 7 === 1) continue; // 移動日
    if (day > 400) throw new Error('日程を生成できませんでした');

    const busy = new Set<string>();
    // 消化試合数が少ない球団を優先し、偏りを抑える
    remaining.sort(
      (a, b) =>
        Math.min(gamesPlayed.get(a.homeTeamId)!, gamesPlayed.get(a.awayTeamId)!) -
        Math.min(gamesPlayed.get(b.homeTeamId)!, gamesPlayed.get(b.awayTeamId)!),
    );

    for (let i = 0; i < remaining.length && busy.size < TEAMS.length - 1; i++) {
      const m = remaining[i];
      if (busy.has(m.homeTeamId) || busy.has(m.awayTeamId)) continue;
      busy.add(m.homeTeamId);
      busy.add(m.awayTeamId);
      games.push({ day, ...m });
      gamesPlayed.set(m.homeTeamId, gamesPlayed.get(m.homeTeamId)! + 1);
      gamesPlayed.set(m.awayTeamId, gamesPlayed.get(m.awayTeamId)! + 1);
      remaining.splice(i, 1);
      i--;
    }
  }

  return games.sort((a, b) => a.day - b.day);
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
