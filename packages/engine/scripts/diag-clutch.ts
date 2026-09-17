/**
 * 較正診断: クラッチ係数の効き方。
 *
 *   npm run diag:clutch -- [seed]
 *
 * 目標:
 *   真のクラッチ才能（得点圏 wOBA − 通常 wOBA の選手間 σ）が 6〜8 wOBA ポイント（The Book の推定は約8）
 *   リーグ得点が係数の有無で変わらない（E[f] = 1）
 *   階層差・プラトーン差が得点圏でも保たれる
 *   規定級投手の（防御率 − FIP）σ が現実の目安 0.45 から大きく外れない
 */
import { advanceToEnd, createSeason, type SeasonState } from '../src/league/season.js';
import { analyzeClutch, correlation, mean, stdev } from '../src/metrics/clutchAnalysis.js';
import { leagueLevel } from '../src/metrics/leagueLevel.js';
import { buildLeagueContext, fip, battingWar } from '../src/metrics/advanced.js';
import { BASE_SECOND, BASE_THIRD } from '../src/sim/events.js';
import { avg, era } from '../src/sim/stats.js';
import { CLUTCH_GAIN_PER_10 } from '../src/sim/profile.js';

const seed = Number(process.argv[2] ?? 20260915);
const season = createSeason(seed);
const a = analyzeClutch([...season.rosters.values()]);

console.log(
  `=== クラッチ係数の診断 (seed ${seed}, 係数 +10 あたり ×${(1 + CLUTCH_GAIN_PER_10).toFixed(2)}) ===`,
);
console.log(
  `クラッチ値の分布（全野手）: 平均 ${a.clutchMean.toFixed(1)} σ ${a.clutchSd.toFixed(1)} 最大 ${a.clutchMax} 65超 ${(a.clutchAbove65 * 100).toFixed(1)}%   (目標: 平均50 σ10、上側の裾が薄い)`,
);
console.log(
  `真のクラッチ才能 σ: スタメン ${a.batters} 人 ${a.talentSd.toFixed(1)} wOBApt（平均 ${a.talentMean >= 0 ? '+' : ''}${a.talentMean.toFixed(2)}） / 控え込み全野手 ${a.talentSdAll.toFixed(1)} / 投手 ${a.pitcherTalentSd.toFixed(1)}   (目標: スタメンで 6〜8)`,
);
console.log(
  `階層差（上位10% − 下位10% の wOBA）: 通常 ${a.tierGapNormal.toFixed(1)}pt → 得点圏 ${a.tierGapRisp.toFixed(1)}pt（比 ${(a.tierGapRisp / a.tierGapNormal).toFixed(2)}）   (目標: 0.9 以上)`,
);
console.log(
  `プラトーン差の相関（通常 vs 得点圏）: ${a.platoonCorrelation.toFixed(3)}   (目標: 0.95 以上)`,
);

// --- 実シーズン: 得点保存と実測の相関 ---
advanceToEnd(season);
const neutral = createSeason(seed);
for (const p of neutral.players.values()) {
  p.ratings.batting.clutch = 50;
  if (p.ratings.pitching) p.ratings.pitching.clutch = 50;
}
advanceToEnd(neutral);
const withClutch = leagueLevel(season);
const without = leagueLevel(neutral);
console.log(
  `\nリーグ得点（1試合）: 係数あり ${withClutch.runsPerGame.toFixed(3)} / 全員50 ${without.runsPerGame.toFixed(3)} (差 ${((withClutch.runsPerGame / without.runsPerGame - 1) * 100).toFixed(2)}%)   (目標: ±1%。1シードでは乱数差を含む)`,
);

function rispShare(s: SeasonState): { share: number; runShare: number } {
  let pa = 0,
    risp = 0,
    runs = 0,
    rispRuns = 0;
  for (const g of s.results)
    for (const e of g.events) {
      pa++;
      runs += e.runs;
      if ((e.basesBefore & (BASE_SECOND | BASE_THIRD)) !== 0) {
        risp++;
        rispRuns += e.runs;
      }
    }
  return { share: risp / pa, runShare: rispRuns / runs };
}
const rs = rispShare(season);
console.log(
  `得点圏の打席比率 ${(rs.share * 100).toFixed(1)}%（得点圏で入った得点の割合 ${(rs.runShare * 100).toFixed(1)}%）   (実測の目安: 24.9%)`,
);

// 実測: クラッチと 得点圏打率−通常打率、クラッチと WAR の相関（規定打席）
const ctx = buildLeagueContext(season);
const per = new Map<string, { ab: number; h: number; rab: number; rh: number }>();
for (const g of season.results)
  for (const e of g.events) {
    const isAb = e.outcome !== 'BB' && e.outcome !== 'HBP';
    const isHit =
      e.outcome === 'SINGLE' ||
      e.outcome === 'DOUBLE' ||
      e.outcome === 'TRIPLE' ||
      e.outcome === 'HR';
    const risp = (e.basesBefore & (BASE_SECOND | BASE_THIRD)) !== 0;
    let r = per.get(e.batterId);
    if (!r) {
      r = { ab: 0, h: 0, rab: 0, rh: 0 };
      per.set(e.batterId, r);
    }
    if (isAb) {
      r.ab++;
      if (risp) r.rab++;
    }
    if (isHit) {
      r.h++;
      if (risp) r.rh++;
    }
  }
const games = season.schedule.length / (season.rosters.size / 2);
const qualified = [...season.battingStats.entries()].filter(
  ([id, s]) => s.pa >= games * 3.1 && season.players.get(id)!.primaryPosition !== 'P',
);
const clutches = qualified.map(([id]) => season.players.get(id)!.ratings.batting.clutch);
const rispDiff = qualified.map(([id]) => {
  const r = per.get(id)!;
  return r.rh / r.rab - r.h / r.ab;
});
const wars = qualified.map(([, s]) => battingWar(s, ctx));
console.log(
  `規定打席 ${qualified.length} 人の実測: corr(クラッチ, 得点圏打率−通常打率) ${correlation(clutches, rispDiff).toFixed(3)} / corr(クラッチ, WAR) ${correlation(clutches, wars).toFixed(3)}   (置換方式では 0.179 / 0.061)`,
);
console.log(
  `  （得点圏打率 − 通常打率）の実測 σ ${(stdev(rispDiff) * 1000).toFixed(1)}pt（二項ノイズ込み。置換方式の真の σ は約20pt）`,
);

// 投手: 防御率 − FIP の σ。全員50（係数なし）のシーズンと比べ、投手クラッチが乖離をどれだけ増やすかを見る
const eraFipSd = (s: SeasonState) => {
  const c = buildLeagueContext(s);
  const rows = [...s.pitchingStats.values()].filter((st) => st.outs >= 100 * 3);
  return { n: rows.length, sd: stdev(rows.map((st) => era(st) - fip(st, c))) };
};
const ef = eraFipSd(season);
const efNeutral = eraFipSd(neutral);
console.log(
  `100回以上の投手 ${ef.n} 人: (防御率 − FIP) σ ${ef.sd.toFixed(3)} / 全員50なら ${efNeutral.sd.toFixed(3)}   (現実の目安: 規定投球回で約0.45)`,
);
console.log(
  `規定打席者の得点圏打率 平均 ${mean(
    qualified.map(([id]) => {
      const r = per.get(id)!;
      return r.rh / r.rab;
    }),
  ).toFixed(3)} / 通常打率 平均 ${mean(qualified.map(([, s]) => avg(s))).toFixed(3)}`,
);
