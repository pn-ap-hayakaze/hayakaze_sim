/**
 * 較正診断: 救援の登板数が誰に偏っているかを球団単位で見る。
 *
 *   npm run diag:bullpen -- [seed]
 *
 * 目安: セットアッパー55〜68登板、中継ぎ40〜65、守護神45〜60。
 * 1人が80を超えたら役割分担か疲労係数を疑う。
 */
import { advanceToEnd, createSeason } from '../src/league/season.js';
import { pitcherValue } from '../src/league/lineup.js';
import { era } from '../src/sim/stats.js';

const season = createSeason(Number(process.argv[2] ?? 20260915));
advanceToEnd(season);

for (const roster of [...season.rosters.values()].slice(0, 3)) {
  console.log(`\n=== ${roster.team.name} ===`);
  console.log('役割 選手          能力  スタミナ  登板  投球回  防御率  平均球数/登板');
  const relievers = roster.pitchers
    .filter((p) => p.pitcherRole !== 'SP')
    .sort((a, b) => pitcherValue(b) - pitcherValue(a));
  for (const p of relievers) {
    const s = season.pitchingStats.get(p.id);
    if (!s) continue;
    console.log(
      `${p.pitcherRole!.padEnd(3)}  ${p.name.padEnd(8, '　')} ${pitcherValue(p).toFixed(0).padStart(4)} ` +
        `${String(p.ratings.pitching!.stamina).padStart(7)} ${String(s.g).padStart(5)} ${(s.outs / 3).toFixed(0).padStart(7)} ` +
        `${era(s).toFixed(2).padStart(7)} ${(s.pitches / s.g).toFixed(1).padStart(9)}`,
    );
  }
}
