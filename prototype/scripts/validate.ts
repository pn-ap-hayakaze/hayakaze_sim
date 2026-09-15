/**
 * 1シーズンを回し、リーグ全体の成績が現実の NPB に近いかを検証する。
 *
 *   npx tsx scripts/validate.ts [seed]
 *
 * ここで出る数字が現実離れしていたら、engine/sim/profile.ts の SLOPE か
 * engine/sim/oddsRatio.ts の LEAGUE_AVERAGE を調整する。
 */

import { teamById } from '../src/data/teams.js';
import {
  advanceToEnd,
  createSeason,
  gamesBehind,
  standings,
  winPct,
  type SeasonState,
} from '../src/engine/league/season.js';
import {
  avg,
  era,
  fmtRate,
  inningsPitched,
  obp,
  ops,
  slg,
  whip,
  type BattingStats,
  type PitchingStats,
} from '../src/engine/sim/stats.js';
import type { Player } from '../src/engine/player/ratings.js';

const seed = Number(process.argv[2] ?? 20260915);

console.log(`\n=== シーズン生成 (seed=${seed}) ===`);
const started = Date.now();
const season = createSeason(seed);
const generated = Date.now();
advanceToEnd(season);
const finished = Date.now();

const totalGames = season.results.length;
console.log(
  `選手生成: ${generated - started}ms / ${totalGames}試合: ${finished - generated}ms ` +
    `(1試合あたり ${((finished - generated) / totalGames).toFixed(2)}ms)`,
);

// --- 順位表 ---
for (const league of ['CENTRAL', 'PACIFIC'] as const) {
  const label = league === 'CENTRAL' ? 'セントラル・リーグ' : 'パシフィック・リーグ';
  console.log(`\n=== ${label} ===`);
  console.log('順位 球団           試合  勝  敗 分   勝率   差   得点  失点');
  const table = standings(season, league);
  table.forEach((r, i) => {
    const team = teamById(r.teamId);
    const g = r.wins + r.losses + r.ties;
    const gb = i === 0 ? '  -' : gamesBehind(table[0], r).toFixed(1).padStart(4);
    console.log(
      `${String(i + 1).padStart(2)}  ${team.name.padEnd(12, '　')} ${String(g).padStart(4)} ` +
        `${String(r.wins).padStart(3)} ${String(r.losses).padStart(3)} ${String(r.ties).padStart(2)} ` +
        ` ${fmtRate(winPct(r))} ${gb}  ${String(r.runsScored).padStart(4)} ${String(r.runsAllowed).padStart(5)}`,
    );
  });
}

// --- リーグ全体の打撃成績 ---
const leagueBatting = sumBatting(season);
const leaguePitching = sumPitching(season);
const pa = leagueBatting.pa;

console.log('\n=== リーグ全体の水準（現実のNPBとの比較）===');
console.log('指標              本シミュレーション     実際のNPB(近年)');
row('打率', fmtRate(avg(leagueBatting)), '.240 〜 .260');
row('出塁率', fmtRate(obp(leagueBatting)), '.305 〜 .325');
row('長打率', fmtRate(slg(leagueBatting)), '.350 〜 .390');
row('OPS', fmtRate(ops(leagueBatting)), '.660 〜 .715');
row('三振率(K%)', pct(leagueBatting.so / pa), '18% 〜 21%');
row('四球率(BB%)', pct(leagueBatting.bb / pa), '7.5% 〜 9%');
row('本塁打率(HR%)', pct(leagueBatting.hr / pa), '2.0% 〜 2.6%');
row('1試合平均得点', (leagueBatting.r / (totalGames * 2)).toFixed(2), '3.6 〜 4.3');
row('防御率', era(leaguePitching).toFixed(2), '3.00 〜 3.60');
row('失策率(ROE%)', pct(leagueBatting.roe / pa), '1.3% 〜 1.8%');
row('自責点比率', pct(leaguePitching.er / leagueBatting.r), '90% 〜 94%');
row('WHIP', whip(leaguePitching).toFixed(3), '1.24 〜 1.35');

// --- 個人タイトル ---
const qualified = qualifiedBatters(season, totalGames);
console.log('\n=== 打率ランキング（規定打席到達）===');
printBatters(qualified.sort((a, b) => avg(b.stats) - avg(a.stats)).slice(0, 10));

console.log('\n=== 本塁打ランキング ===');
printBatters(allBatters(season).sort((a, b) => b.stats.hr - a.stats.hr).slice(0, 10));

console.log('\n=== 盗塁ランキング ===');
printBatters(allBatters(season).sort((a, b) => b.stats.sb - a.stats.sb).slice(0, 5));

console.log('\n=== 防御率ランキング（規定投球回到達）===');
const qualifiedPitchers = allPitchers(season).filter(
  (p) => p.stats.outs >= 143 * 3,
);
console.log('選手              球団         登板  勝  敗  投球回  防御率  奪三振  WHIP');
for (const { player, stats } of qualifiedPitchers
  .sort((a, b) => era(a.stats) - era(b.stats))
  .slice(0, 10)) {
  console.log(
    `${player.name.padEnd(10, '　')} ${teamById(player.teamId).name.padEnd(10, '　')} ` +
      `${String(stats.g).padStart(4)} ${String(stats.w).padStart(3)} ${String(stats.l).padStart(3)} ` +
      `${inningsPitched(stats).padStart(7)} ${era(stats).toFixed(2).padStart(7)} ` +
      `${String(stats.so).padStart(6)} ${whip(stats).toFixed(2).padStart(6)}`,
  );
}

// --- 健全性チェック ---
console.log('\n=== 健全性チェック ===');
check('全球団が143試合を消化', [...season.records.values()].every(
  (r) => r.wins + r.losses + r.ties === 143,
));
check('リーグ全体の得失点が一致', leagueTotalsBalance(season));
check('規定打席到達者が各球団2人以上', qualified.length >= 24);
check('打率が .230〜.270 に収まる', avg(leagueBatting) > 0.23 && avg(leagueBatting) < 0.27);
check(
  '防御率が 2.80〜3.90 に収まる',
  era(leaguePitching) > 2.8 && era(leaguePitching) < 3.9,
);

// ---------- ヘルパー ----------

function row(label: string, actual: string, expected: string): void {
  console.log(`${label.padEnd(14, '　')} ${actual.padStart(12)}     ${expected}`);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function check(label: string, ok: boolean): void {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
}

function sumBatting(s: SeasonState): BattingStats {
  const total = { ...emptyLike() };
  for (const stats of s.battingStats.values()) {
    for (const key of Object.keys(total) as (keyof BattingStats)[]) {
      total[key] += stats[key];
    }
  }
  return total;
}

function emptyLike(): BattingStats {
  return {
    g: 0, pa: 0, ab: 0, h: 0, double: 0, triple: 0, hr: 0,
    bb: 0, hbp: 0, so: 0, r: 0, rbi: 0, sb: 0, cs: 0, roe: 0,
  };
}

function sumPitching(s: SeasonState): PitchingStats {
  const total: PitchingStats = {
    g: 0, gs: 0, outs: 0, bf: 0, h: 0, hr: 0, bb: 0,
    hbp: 0, so: 0, pitches: 0, r: 0, er: 0, w: 0, l: 0, sv: 0, hld: 0,
  };
  for (const stats of s.pitchingStats.values()) {
    for (const key of Object.keys(total) as (keyof PitchingStats)[]) {
      total[key] += stats[key];
    }
  }
  return total;
}

function findPlayer(s: SeasonState, playerId: string): Player {
  for (const roster of s.rosters.values()) {
    const found =
      roster.batters.find((p) => p.id === playerId) ??
      roster.pitchers.find((p) => p.id === playerId);
    if (found) return found;
  }
  throw new Error(`選手が見つかりません: ${playerId}`);
}

function allBatters(s: SeasonState): { player: Player; stats: BattingStats }[] {
  return [...s.battingStats.entries()]
    .map(([id, stats]) => ({ player: findPlayer(s, id), stats }))
    .filter((e) => e.player.primaryPosition !== 'P');
}

function allPitchers(s: SeasonState): { player: Player; stats: PitchingStats }[] {
  return [...s.pitchingStats.entries()].map(([id, stats]) => ({
    player: findPlayer(s, id),
    stats,
  }));
}

/** 規定打席 = チーム試合数 × 3.1 */
function qualifiedBatters(s: SeasonState, _totalGames: number) {
  return allBatters(s).filter((e) => e.stats.pa >= 143 * 3.1);
}

function printBatters(entries: { player: Player; stats: BattingStats }[]): void {
  console.log('選手              球団         打率  試合  打数  安打  本   点  盗  四球  三振   OPS');
  for (const { player, stats } of entries) {
    console.log(
      `${player.name.padEnd(10, '　')} ${teamById(player.teamId).name.padEnd(10, '　')} ` +
        `${fmtRate(avg(stats))} ${String(stats.g).padStart(5)} ${String(stats.ab).padStart(5)} ` +
        `${String(stats.h).padStart(5)} ${String(stats.hr).padStart(3)} ${String(stats.rbi).padStart(4)} ` +
        `${String(stats.sb).padStart(3)} ${String(stats.bb).padStart(5)} ${String(stats.so).padStart(5)} ` +
        ` ${fmtRate(ops(stats))}`,
    );
  }
}

function leagueTotalsBalance(s: SeasonState): boolean {
  let scored = 0;
  let allowed = 0;
  for (const r of s.records.values()) {
    scored += r.runsScored;
    allowed += r.runsAllowed;
  }
  return scored === allowed;
}
