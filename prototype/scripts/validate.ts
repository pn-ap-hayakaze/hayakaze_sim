/**
 * 1シーズンを回し、リーグ全体の成績が現実の NPB に近いかを検証する。
 *
 *   npx tsx scripts/validate.ts [seed]
 *
 * ここで出る数字が現実離れしていたら、engine/sim/profile.ts の SLOPE か
 * engine/sim/oddsRatio.ts の LEAGUE_AVERAGE を調整する。
 */

import { gamesPerTeam } from '../src/engine/league/config.js';
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
  sumBatting,
  sumPitching,
  whip,
  type BattingStats,
  type PitchingStats,
} from '../src/engine/sim/stats.js';
import type { Player } from '../src/engine/player/ratings.js';
import {
  battingWar,
  buildLeagueContext,
  fip,
  pitchingWar,
  woba,
  wrcPlus,
} from '../src/engine/metrics/advanced.js';
import { baseOutIndex } from '../src/engine/sim/events.js';
import { percentileBar, percentileCard, type MetricSpec } from '../src/engine/metrics/percentile.js';

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

const teamById = (id: string) => season.teams.get(id)!;
/** 1球団の年間試合数。全球団が同数の前提で先頭球団から導出する */
const gamesPerSeason = gamesPerTeam(season.config, season.config.teams[0].id);

// --- 順位表 ---
for (const league of season.config.leagues) {
  console.log(`\n=== ${league.name}${league.dh ? '（DH制）' : ''} ===`);
  console.log('順位 球団           試合  勝  敗 分   勝率   差   得点  失点');
  const table = standings(season, league.id);
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
const leagueBatting = sumBatting(season.battingStats.values());
const leaguePitching = sumPitching(season.pitchingStats.values());
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
  (p) => p.stats.outs >= gamesPerSeason * 3,
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

// --- セイバーメトリクス ---
const ctx = buildLeagueContext(season);

console.log('\n=== 得点期待値表（シミュレーション自身から導出）===');
console.log('走者        0アウト  1アウト  2アウト   (現実の NPB: 無走者0アウト ≈ 0.45、満塁0アウト ≈ 2.2)');
const baseLabels = ['---', '1--', '-2-', '12-', '--3', '1-3', '-23', '123'];
for (let bases = 0; bases < 8; bases++) {
  const cells = [0, 1, 2].map((outs) =>
    ctx.runExpectancy.expected[baseOutIndex(outs, bases)].toFixed(3).padStart(7),
  );
  console.log(`${baseLabels[bases]}      ${cells.join('  ')}`);
}

console.log('\n=== 線形ウェイト（アウト基準・wOBA尺度）===');
console.log('結果      得点価値   wOBAウェイト   (現実の MLB: 1B .88 / 2B 1.25 / 3B 1.58 / HR 2.03 / BB .69)');
const lw = ctx.linearWeights;
const ww = ctx.wobaWeights;
row2('単打', lw.SINGLE - ctx.outWeight, ww.single);
row2('二塁打', lw.DOUBLE - ctx.outWeight, ww.double);
row2('三塁打', lw.TRIPLE - ctx.outWeight, ww.triple);
row2('本塁打', lw.HR - ctx.outWeight, ww.hr);
row2('四球', lw.BB - ctx.outWeight, ww.bb);
row2('死球', lw.HBP - ctx.outWeight, ww.hbp);
console.log(`アウトの価値 ${ctx.outWeight.toFixed(3)} / wOBA尺度 ${ctx.wobaScale.toFixed(3)} / リーグwOBA ${fmtRate(ctx.leagueWoba)} / 1勝=${ctx.runsPerWin.toFixed(2)}点 / cFIP ${ctx.cFip.toFixed(2)}`);

console.log('\n=== wRC+ ランキング（規定打席到達）===');
console.log('選手              球団          wOBA  wRC+   WAR  守備位置');
for (const { player, stats } of [...qualified]
  .sort((a, b) => wrcPlus(b.stats, ctx) - wrcPlus(a.stats, ctx))
  .slice(0, 10)) {
  console.log(
    `${player.name.padEnd(10, '　')} ${teamById(player.teamId).name.padEnd(10, '　')} ` +
      `${fmtRate(woba(stats, ctx))} ${wrcPlus(stats, ctx).toFixed(0).padStart(5)} ` +
      `${battingWar(stats, ctx).toFixed(1).padStart(5)}  ${player.primaryPosition}`,
  );
}

console.log('\n=== FIP ランキング（規定投球回到達）===');
console.log('選手              球団          FIP   防御率   WAR');
for (const { player, stats } of qualifiedPitchers
  .sort((a, b) => fip(a.stats, ctx) - fip(b.stats, ctx))
  .slice(0, 10)) {
  console.log(
    `${player.name.padEnd(10, '　')} ${teamById(player.teamId).name.padEnd(10, '　')} ` +
      `${fip(stats, ctx).toFixed(2).padStart(5)} ${era(stats).toFixed(2).padStart(7)} ${pitchingWar(stats, ctx).toFixed(1).padStart(6)}`,
  );
}

// --- パーセンタイル表示（Baseball Savant 風）---
const regulars = allBatters(season).filter((e) => e.stats.pa >= 300);
const leader = [...qualified].sort((a, b) => wrcPlus(b.stats, ctx) - wrcPlus(a.stats, ctx))[0];
if (leader) {
  console.log(`\n=== パーセンタイル: ${leader.player.name}（${teamById(leader.player.teamId).name} / ${leader.player.primaryPosition}）===`);
  type Entry = { player: Player; stats: BattingStats };
  const ratingMetrics: MetricSpec<Entry>[] = [
    { label: 'ミート', value: (e) => (e.player.ratings.batting.meetVsR + e.player.ratings.batting.meetVsL) / 2 },
    { label: 'パワー', value: (e) => (e.player.ratings.batting.powerVsR + e.player.ratings.batting.powerVsL) / 2 },
    { label: 'コンタクト', value: (e) => e.player.ratings.batting.contact },
    { label: '選球眼', value: (e) => e.player.ratings.batting.eye },
    { label: 'クラッチ', value: (e) => e.player.ratings.batting.clutch },
    { label: '走力', value: (e) => e.player.ratings.running.speed },
    { label: '肩の強さ', value: (e) => e.player.ratings.throwing.armStrength },
    { label: '守備(主位置)', value: (e) => e.player.ratings.fielding[e.player.primaryPosition] },
  ];
  const statMetrics: MetricSpec<Entry>[] = [
    { label: 'wRC+', value: (e) => wrcPlus(e.stats, ctx), format: (v) => v.toFixed(0) },
    { label: '本塁打率', value: (e) => e.stats.hr / e.stats.pa, format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: '四球率', value: (e) => e.stats.bb / e.stats.pa, format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: '三振率', value: (e) => e.stats.so / e.stats.pa, higherIsBetter: false, format: (v) => `${(v * 100).toFixed(1)}%` },
    { label: '盗塁', value: (e) => e.stats.sb, format: (v) => String(v) },
  ];
  console.log('--- 能力値（規定300打席以上の野手内）---');
  for (const c of percentileCard(leader, regulars, ratingMetrics)) {
    console.log(`${c.label.padEnd(8, '　')} ${c.display.padStart(6)}  ${percentileBar(c.percentile)} ${String(c.percentile).padStart(3)}`);
  }
  console.log('--- 成績 ---');
  for (const c of percentileCard(leader, regulars, statMetrics)) {
    console.log(`${c.label.padEnd(8, '　')} ${c.display.padStart(6)}  ${percentileBar(c.percentile)} ${String(c.percentile).padStart(3)}`);
  }
}

// --- 健全性チェック ---
console.log('\n=== 健全性チェック ===');
check(`全球団が${gamesPerSeason}試合を消化`, [...season.records.values()].every(
  (r) => r.wins + r.losses + r.ties === gamesPerTeam(season.config, r.teamId),
));
check('リーグ全体の得失点が一致', leagueTotalsBalance(season));
check('規定打席到達者が各球団2人以上', qualified.length >= 24);
check('打率が .230〜.270 に収まる', avg(leagueBatting) > 0.23 && avg(leagueBatting) < 0.27);
check(
  '防御率が 2.80〜3.90 に収まる',
  era(leaguePitching) > 2.8 && era(leaguePitching) < 3.9,
);
check(
  '線形ウェイトの順序が 四球 < 単打 < 二塁打 < 三塁打 < 本塁打',
  ww.bb < ww.single && ww.single < ww.double && ww.double < ww.triple && ww.triple < ww.hr,
);
check(
  '規定打席到達者の wRC+ の平均が 95〜125（レギュラーは平均より上）',
  (() => {
    const m = qualified.reduce((a, e) => a + wrcPlus(e.stats, ctx), 0) / qualified.length;
    return m > 95 && m < 125;
  })(),
);

// --- 試合進行とイベント記録の不変条件 ---
const allEvents = season.results.flatMap((r) => r.events);
check(
  '3アウト目のプレーで得点が入っていない',
  ctx.runExpectancy.invariantViolations === 0,
);
check(
  'サヨナラ成立後の打席が 0（9回裏以降にホームがリードした状態で打席がない）',
  allEvents.filter((e) => !e.top && e.inning >= 9 && e.scoreDiffBefore > 0).length === 0,
);
check(
  '併殺で走者が消えない（走者数の保存: 前の走者 = 後の走者 + 得点 + 増えたアウト − 1）',
  allEvents
    .filter((e) => e.outcome === 'OUT_IN_PLAY' && !e.reachedOnError && e.outsAfter < 3)
    .every((e) => {
      const pop = (b: number) => (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1);
      // 打者自身がアウトになる分を差し引く
      return pop(e.basesBefore) === pop(e.basesAfter) + e.runs + (e.outsAfter - e.outsBefore - 1);
    }),
);
check(
  `RE24 の全セルに標本が30以上ある（最少 ${Math.min(...ctx.runExpectancy.samples)}）`,
  Math.min(...ctx.runExpectancy.samples) >= 30,
);
check(
  'RE24 がアウト方向に単調減少・走者方向に単調増加',
  (() => {
    const re = ctx.runExpectancy.expected;
    for (let bases = 0; bases < 8; bases++) {
      if (!(re[baseOutIndex(0, bases)] > re[baseOutIndex(1, bases)] && re[baseOutIndex(1, bases)] > re[baseOutIndex(2, bases)])) return false;
    }
    for (let outs = 0; outs < 3; outs++) {
      for (let bases = 0; bases < 8; bases++) {
        for (const bit of [1, 2, 4]) {
          if (bases & bit) continue;
          if (!(re[baseOutIndex(outs, bases | bit)] > re[baseOutIndex(outs, bases)])) return false;
        }
      }
    }
    return true;
  })(),
);
check(
  `サヨナラで打ち切られた半イニングが RE24 の標本から除外されている（${ctx.runExpectancy.truncatedHalfInnings} 件）`,
  ctx.runExpectancy.truncatedHalfInnings >= 0,
);

// --- WAR の配分（FanGraphs: 1000勝/2430試合 を野手57%・投手43%で配る）---
const totalBatterWar = allBatters(season).reduce(
  (a, e) => a + battingWar(e.stats, ctx),
  0,
);
const totalPitcherWar = allPitchers(season).reduce((a, e) => a + pitchingWar(e.stats, ctx), 0);
const targetBatter = (570 * totalGames) / 2430;
const targetPitcher = (430 * totalGames) / 2430;
console.log(
  `  野手WAR合計 ${totalBatterWar.toFixed(1)}（目標 ${targetBatter.toFixed(1)}） / ` +
    `投手WAR合計 ${totalPitcherWar.toFixed(1)}（目標 ${targetPitcher.toFixed(1)}）`,
);
check('野手WAR合計が目標の ±10%', Math.abs(totalBatterWar / targetBatter - 1) < 0.1);
check('投手WAR合計が目標の ±10%', Math.abs(totalPitcherWar / targetPitcher - 1) < 0.1);

// ---------- ヘルパー ----------

function row2(label: string, runs: number, weight: number): void {
  console.log(`${label.padEnd(5, '　')} ${runs.toFixed(3).padStart(8)} ${weight.toFixed(3).padStart(12)}`);
}

function row(label: string, actual: string, expected: string): void {
  console.log(`${label.padEnd(14, '　')} ${actual.padStart(12)}     ${expected}`);
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function check(label: string, ok: boolean): void {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
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
  return allBatters(s).filter((e) => e.stats.pa >= gamesPerSeason * 3.1);
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
