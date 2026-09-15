/**
 * 較正診断: 疲労モデルの挙動。登板時点の疲労度を日ごとにサンプリングする。
 *
 *   npm run diag:fatigue -- [seed]
 *
 * 先発は登板時に疲労0（完全回復）であるべき。救援の登板時疲労は90%点で30前後が目安。
 * 中央値が30を超えたらブルペン全体が慢性疲労で、回復か需要のどちらかがおかしい。
 */
import { advanceOneDay, createSeason, isSeasonOver } from '../src/engine/league/season.js';
import { rotationFor } from '../src/engine/league/lineup.js';
import type { Player } from '../src/engine/player/ratings.js';

const season = createSeason(Number(process.argv[2] ?? 20260915));
// season.ts の dailyRecovery と同じ式（診断用に写している）
const recovery = (p: Player) => 10 + (p.ratings.pitching?.stamina ?? 40) * 0.25;

const spFatigueAtStart: number[] = [];
const rpFatigueAtEntry: number[] = [];
let rpTiredEntries = 0, rpEntries = 0;

while (!isSeasonOver(season)) {
  // 今日の回復後・試合前の疲労度を再現する
  const preGame = new Map<string, number>();
  for (const [id, st] of season.pitcherFatigue) {
    const p = season.players.get(id)!;
    preGame.set(id, Math.max(0, st.fatigue - recovery(p)));
  }
  const gBefore = new Map<string, number>();
  for (const [id, s] of season.pitchingStats) gBefore.set(id, s.g);

  const todaysGames = season.scheduleByDay.get(season.currentDay) ?? [];
  for (const g of todaysGames) {
    for (const teamId of [g.homeTeamId, g.awayTeamId]) {
      const roster = season.rosters.get(teamId)!;
      const sp = rotationFor(roster, season.gamesPlayed.get(teamId)!);
      spFatigueAtStart.push(preGame.get(sp.id) ?? 0);
    }
  }

  const results = advanceOneDay(season);

  for (const r of results) {
    for (const [id, s] of r.pitching) {
      if (s.g === 0) continue;
      const p = season.players.get(id)!;
      if (p.pitcherRole === 'SP') continue;
      rpEntries++;
      const f = preGame.get(id) ?? 0;
      rpFatigueAtEntry.push(f);
      if (f >= 30) rpTiredEntries++;
    }
  }
}

const stat = (xs: number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { m, p50: sorted[Math.floor(xs.length * 0.5)], p90: sorted[Math.floor(xs.length * 0.9)], max: sorted[xs.length - 1] };
};
const sp = stat(spFatigueAtStart), rp = stat(rpFatigueAtEntry);
console.log(`=== 疲労モデル診断 ===`);
console.log(`先発の登板時疲労度: 平均${sp.m.toFixed(1)} 中央値${sp.p50.toFixed(0)} 90%点${sp.p90.toFixed(0)} 最大${sp.max.toFixed(0)}  (0なら完全回復で登板)`);
console.log(`救援の登板時疲労度: 平均${rp.m.toFixed(1)} 中央値${rp.p50.toFixed(0)} 90%点${rp.p90.toFixed(0)} 最大${rp.max.toFixed(0)}`);
console.log(`救援の登板 ${rpEntries}回のうち疲労30以上での登板 ${rpTiredEntries}回 (${((rpTiredEntries / rpEntries) * 100).toFixed(1)}%)`);
