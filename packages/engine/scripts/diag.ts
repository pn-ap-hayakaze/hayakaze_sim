/**
 * 較正診断: 派生投手指標の水準と、個人成績の散らばり。
 *
 *   npm run diag -- [seed]
 *
 * validate.ts がリーグ全体の水準を見るのに対し、こちらは「個人成績が現実的に散っているか」を見る。
 * 傾き(SLOPE)を変えたときは必ず両方を確認する。
 */
import { advanceToEnd, createSeason } from '../src/league/season.js';
import { era, ops, avg, whip } from '../src/sim/stats.js';
import type { Player } from '../src/types/player.js';

const season = createSeason(Number(process.argv[2] ?? 20260915));
advanceToEnd(season);
const find = (id: string): Player | undefined => {
  for (const r of season.rosters.values()) {
    const p = r.pitchers.find((x) => x.id === id) ?? r.batters.find((x) => x.id === id);
    if (p) return p;
  }
  return undefined;
};
const stat = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { m, sd: Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) };
};

// --- 派生投手指標の水準（投球回で重み付け） ---
const keys = [
  'hits',
  'homeRuns',
  'strikeouts',
  'walks',
  'clutch',
  'speed',
  'breakAmount',
  'control',
  'stamina',
] as const;
const acc: Record<string, { sp: number; rp: number; spW: number; rpW: number }> = {};
for (const k of keys) acc[k] = { sp: 0, rp: 0, spW: 0, rpW: 0 };
let arsenalSizes = 0,
  nPitchers = 0;
for (const [id, s] of season.pitchingStats) {
  const p = find(id);
  if (!p?.ratings.pitching) continue;
  const isSp = p.pitcherRole === 'SP';
  arsenalSizes += p.ratings.pitching.arsenal.length;
  nPitchers++;
  for (const k of keys) {
    const v = p.ratings.pitching[k];
    if (isSp) {
      acc[k].sp += v * s.outs;
      acc[k].spW += s.outs;
    } else {
      acc[k].rp += v * s.outs;
      acc[k].rpW += s.outs;
    }
  }
}
console.log('=== 派生投手指標の投球回加重平均（基準は50）===');
console.log('指標          先発    救援');
for (const k of keys) {
  console.log(
    `${k.padEnd(12)} ${(acc[k].sp / acc[k].spW).toFixed(1).padStart(6)} ${(acc[k].rp / acc[k].rpW).toFixed(1).padStart(7)}`,
  );
}
console.log(`平均球種数 ${(arsenalSizes / nPitchers).toFixed(2)}`);

// --- 個人成績の散らばり ---
const spEra: number[] = [],
  spWhip: number[] = [];
let spOuts = 0,
  rpOuts = 0,
  spStarts = 0;
for (const [id, s] of season.pitchingStats) {
  const p = find(id);
  if (!p?.pitcherRole) continue;
  if (p.pitcherRole === 'SP') {
    spOuts += s.outs;
    spStarts += s.gs;
    if (s.outs >= 400) {
      spEra.push(era(s));
      spWhip.push(whip(s));
    }
  } else rpOuts += s.outs;
}
const e = stat(spEra);
console.log(`\n=== 個人成績の散らばり ===`);
console.log(
  `規定級の先発 ${spEra.length}人: 防御率 平均${e.m.toFixed(2)} 標準偏差${e.sd.toFixed(2)} (現実: 平均3.4 / 標準偏差0.65)`,
);
console.log(
  `  防御率 最良${Math.min(...spEra).toFixed(2)} 最悪${Math.max(...spEra).toFixed(2)} (現実: 1.8〜4.5)`,
);
console.log(
  `  WHIP   最良${Math.min(...spWhip).toFixed(2)} 最悪${Math.max(...spWhip).toFixed(2)} (現実: 0.95〜1.55)`,
);
console.log(
  `先発の投球回比率 ${((spOuts / (spOuts + rpOuts)) * 100).toFixed(1)}% (現実: 約60%) / 1先発${(spOuts / 3 / spStarts).toFixed(2)}回 (現実: 5.8〜6.2)`,
);

const regs = [...season.battingStats.entries()].filter(
  ([id, s]) => s.pa >= 443 && find(id)?.primaryPosition !== 'P',
);
const o = stat(regs.map(([, s]) => ops(s)));
const hrs = regs.map(([, s]) => s.hr).sort((x, y) => y - x);
const sbs = [...season.battingStats.values()].map((s) => s.sb).sort((x, y) => y - x);
console.log(
  `規定打席の野手 ${regs.length}人: OPS 平均${o.m.toFixed(3)} 標準偏差${o.sd.toFixed(3)} (現実: 平均.720 / 標準偏差.090)`,
);
console.log(
  `  打率 最高${Math.max(...regs.map(([, s]) => avg(s))).toFixed(3)} (現実の首位打者: .320〜.350)`,
);
console.log(`  本塁打 最多${hrs[0]} 2位${hrs[1]} (現実の本塁打王: 30〜40本)`);
console.log(`  盗塁 最多${sbs[0]} 2位${sbs[1]} (現実の盗塁王: 25〜45個)`);

// --- 救援投手の登板数（連投制限の効果確認） ---
const rpGames: number[] = [],
  rpIp: number[] = [],
  clGames: number[] = [],
  clSaves: number[] = [];
for (const [id, s] of season.pitchingStats) {
  const p = find(id);
  if (p?.pitcherRole === 'RP') {
    rpGames.push(s.g);
    rpIp.push(s.outs / 3);
  }
  if (p?.pitcherRole === 'CL') {
    clGames.push(s.g);
    clSaves.push(s.sv);
  }
}
rpGames.sort((a, b) => b - a);
rpIp.sort((a, b) => b - a);
clGames.sort((a, b) => b - a);
clSaves.sort((a, b) => b - a);
console.log(`\n=== 救援の登板数 ===`);
console.log(
  `中継ぎ 登板数 最多${rpGames[0]} 2位${rpGames[1]} 中央値${rpGames[Math.floor(rpGames.length / 2)]} (現実: 最多60〜70)`,
);
console.log(`中継ぎ 投球回 最多${rpIp[0].toFixed(0)} (現実: 最多60〜75回)`);
console.log(
  `守護神 登板数 最多${clGames[0]} 中央値${clGames[Math.floor(clGames.length / 2)]} / セーブ 最多${clSaves[0]} (現実: 登板50〜65、セーブ王30〜45)`,
);
