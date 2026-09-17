/**
 * 較正診断: 複数シードのリーグ水準と個人成績の散らばりを1枚の表にする。
 *
 *   npm run diag:levels -- [seed ...]
 *
 * LEAGUE_AVERAGE / SLOPE を触る前後でこの表を取り、README の較正表に転記する。
 */
import { advanceToEnd, createSeason } from '../src/league/season.js';
import { gamesPerClub } from '../src/league/config.js';
import { leagueLevel } from '../src/metrics/leagueLevel.js';
import { avg, era, ops } from '../src/sim/stats.js';

const seeds =
  process.argv.length > 2 ? process.argv.slice(2).map(Number) : [20260915, 1, 2, 3, 4, 5];

const sd = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

interface Row {
  seed: number;
  avg: number;
  obp: number;
  ops: number;
  rpg: number;
  era: number;
  whip: number;
  k: number;
  bb: number;
  hr: number;
  sba: number;
  sbPct: number;
  topAvg: number;
  topHr: number;
  topSb: number;
  eraSd: number;
  opsSd: number;
  topWrc: number;
}
const rows: Row[] = [];
for (const seed of seeds) {
  const s = createSeason(seed);
  advanceToEnd(s);
  const l = leagueLevel(s);
  const games = gamesPerClub(s.config, s.config.clubs[0].id);
  const batters = [...s.battingStats.entries()].filter(
    ([id]) => s.players.get(id)!.primaryPosition !== 'P',
  );
  const qualified = batters.filter(([, st]) => st.pa >= games * 3.1).map(([, st]) => st);
  const qualifiedP = [...s.pitchingStats.values()].filter((st) => st.outs >= games * 3);
  rows.push({
    seed,
    avg: l.avg,
    obp: l.obp,
    ops: l.ops,
    rpg: l.runsPerGame,
    era: l.era,
    whip: l.whip,
    k: l.kRate,
    bb: l.bbRate,
    hr: l.hrRate,
    sba: l.stealAttemptsPerClub,
    sbPct: l.stealSuccessRate,
    topAvg: Math.max(...qualified.map(avg)),
    topHr: Math.max(...batters.map(([, st]) => st.hr)),
    topSb: Math.max(...batters.map(([, st]) => st.sb)),
    eraSd: sd(qualifiedP.map(era)),
    opsSd: sd(qualified.map(ops)),
    topWrc: 0,
  });
}

const f3 = (v: number) => v.toFixed(3).replace(/^0/, '');
const cols: [string, (r: Row) => string][] = [
  ['打率', (r) => f3(r.avg)],
  ['出塁率', (r) => f3(r.obp)],
  ['OPS', (r) => f3(r.ops)],
  ['R/G', (r) => r.rpg.toFixed(2)],
  ['防御率', (r) => r.era.toFixed(2)],
  ['WHIP', (r) => r.whip.toFixed(3)],
  ['K%', (r) => (r.k * 100).toFixed(1)],
  ['BB%', (r) => (r.bb * 100).toFixed(1)],
  ['HR%', (r) => (r.hr * 100).toFixed(2)],
  ['企図', (r) => r.sba.toFixed(0)],
  ['盗塁率', (r) => f3(r.sbPct)],
  ['首位打者', (r) => f3(r.topAvg)],
  ['HR王', (r) => String(r.topHr)],
  ['盗塁王', (r) => String(r.topSb)],
  ['ERAσ', (r) => r.eraSd.toFixed(2)],
  ['OPSσ', (r) => r.opsSd.toFixed(3)],
];
console.log(['seed', ...cols.map(([n]) => n)].map((c) => c.padStart(8)).join(''));
for (const r of rows)
  console.log([String(r.seed), ...cols.map(([, f]) => f(r))].map((c) => c.padStart(8)).join(''));
const mean = (f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
console.log(
  [
    '平均',
    f3(mean((r) => r.avg)),
    f3(mean((r) => r.obp)),
    f3(mean((r) => r.ops)),
    mean((r) => r.rpg).toFixed(2),
    mean((r) => r.era).toFixed(2),
    mean((r) => r.whip).toFixed(3),
    (mean((r) => r.k) * 100).toFixed(1),
    (mean((r) => r.bb) * 100).toFixed(1),
    (mean((r) => r.hr) * 100).toFixed(2),
    mean((r) => r.sba).toFixed(0),
    f3(mean((r) => r.sbPct)),
    f3(mean((r) => r.topAvg)),
    mean((r) => r.topHr).toFixed(1),
    mean((r) => r.topSb).toFixed(1),
    mean((r) => r.eraSd).toFixed(2),
    mean((r) => r.opsSd).toFixed(3),
  ]
    .map((c) => c.padStart(8))
    .join(''),
);
console.log(
  '目標:  打率 .240〜.260 / 出塁率 .305〜.325 / OPS .660〜.715 / R/G 3.6〜4.3 / 防御率 3.00〜3.60 / WHIP 1.24〜1.35',
);
console.log(
  '       首位打者 .320〜.350 / HR王 30〜40 / 盗塁王 25〜45 / 規定投球回 ERAσ ≈0.65 / 規定打席 OPSσ ≈.090',
);
