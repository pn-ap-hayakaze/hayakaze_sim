/**
 * 較正診断: 投手起用と走塁の実測。モデルの修正判断のために「今どうなっているか」を測る。
 *
 *   npm run diag:usage -- [seed]
 *
 * 目標（npb-calibration-targets）:
 *   救援の連投   3連投は1チーム年1〜2回、4連投以上は発生させない
 *   完投         1チーム年6〜8回
 *   1試合最多球数 137〜143球（150球は発生しない）
 *   先発の登板間隔 中5日以下 3〜4% / 中6日 49〜53% / 中7〜8日 16〜20% / 中10日以上 22〜23%
 *   盗塁企図     1チーム 105〜110、成功率 .65〜.75
 */
import { advanceToEnd, createSeason } from '../src/league/season.js';
import { leagueLevel } from '../src/metrics/leagueLevel.js';

const season = createSeason(Number(process.argv[2] ?? 20260915));
advanceToEnd(season);
const clubs = season.rosters.size;

// --- 登板日の一覧を投手ごとに作る ---
const appearanceDays = new Map<string, number[]>();
const startDays = new Map<string, number[]>();
let completeGames = 0;
let maxPitches = 0;
let maxPitchesBy = '';
const pitchesPerStart: number[] = [];

season.results.forEach((result, i) => {
  const day = season.schedule[i].day;
  // 球団ごとの登板投手数（完投判定）
  const pitchersByClub = new Map<string, number>();
  for (const [id, s] of result.pitching) {
    if (s.g === 0) continue;
    const clubId = season.players.get(id)!.clubId;
    pitchersByClub.set(clubId, (pitchersByClub.get(clubId) ?? 0) + 1);
    const days = appearanceDays.get(id) ?? [];
    days.push(day);
    appearanceDays.set(id, days);
    if (s.gs > 0) {
      const sd = startDays.get(id) ?? [];
      sd.push(day);
      startDays.set(id, sd);
      pitchesPerStart.push(s.pitches);
      if (s.pitches > maxPitches) {
        maxPitches = s.pitches;
        maxPitchesBy = season.players.get(id)!.name;
      }
    }
  }
  for (const count of pitchersByClub.values()) if (count === 1) completeGames++;
});

// --- 連投（救援のみ。連続した日に登板した最大長ごとに数える） ---
let streak3 = 0,
  streak4 = 0,
  streak5plus = 0,
  streak2 = 0,
  rpAppearances = 0;
for (const [id, days] of appearanceDays) {
  const p = season.players.get(id)!;
  if (p.pitcherRole === 'SP') continue;
  rpAppearances += days.length;
  let run = 1;
  const close = (len: number) => {
    if (len === 2) streak2++;
    else if (len === 3) streak3++;
    else if (len === 4) streak4++;
    else if (len >= 5) streak5plus++;
  };
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i - 1] + 1) run++;
    else {
      close(run);
      run = 1;
    }
  }
  close(run);
}

// --- 先発の登板間隔 ---
let gaps5orLess = 0,
  gap6 = 0,
  gap7to8 = 0,
  gap9 = 0,
  gap10plus = 0,
  gapTotal = 0;
for (const days of startDays.values()) {
  for (let i = 1; i < days.length; i++) {
    const rest = days[i] - days[i - 1] - 1; // 「中N日」
    gapTotal++;
    if (rest <= 5) gaps5orLess++;
    else if (rest === 6) gap6++;
    else if (rest <= 8) gap7to8++;
    else if (rest === 9) gap9++;
    else gap10plus++;
  }
}

const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sorted = [...pitchesPerStart].sort((a, b) => a - b);
const mean = pitchesPerStart.reduce((a, b) => a + b, 0) / pitchesPerStart.length;
const sd = Math.sqrt(
  pitchesPerStart.reduce((a, b) => a + (b - mean) ** 2, 0) / pitchesPerStart.length,
);
const level = leagueLevel(season);

console.log(`=== 投手起用と走塁の実測 (seed ${season.masterSeed}, ${clubs}球団) ===`);
console.log(
  `救援の連投（連続登板の塊の数）: 2連投 ${streak2} / 3連投 ${streak3} / 4連投 ${streak4} / 5連投以上 ${streak5plus}`,
);
console.log(
  `  1チームあたり: 3連投 ${(streak3 / clubs).toFixed(1)} / 4連投 ${(streak4 / clubs).toFixed(1)} / 5連投以上 ${(streak5plus / clubs).toFixed(1)}   (目標: 3連投 1〜2、4連投以上 0)`,
);
console.log(
  `  2連投の登板が救援登板に占める割合 ${pct(streak2 * 2, rpAppearances)}   (目標: 主力の登板の18〜19%)`,
);
console.log(`完投 ${completeGames} (1チーム ${(completeGames / clubs).toFixed(2)})   (目標: 6〜8)`);
console.log(
  `先発の球数: 平均 ${mean.toFixed(1)} σ ${sd.toFixed(1)} 90%点 ${sorted[Math.floor(sorted.length * 0.9)].toFixed(0)} 最多 ${maxPitches.toFixed(0)} (${maxPitchesBy})   (目標: 平均93、最多137〜143、σ≈17)`,
);
console.log(
  `先発の登板間隔: 中5日以下 ${pct(gaps5orLess, gapTotal)} / 中6日 ${pct(gap6, gapTotal)} / 中7〜8日 ${pct(gap7to8, gapTotal)} / 中9日 ${pct(gap9, gapTotal)} / 中10日以上 ${pct(gap10plus, gapTotal)}`,
);
console.log(`  (目標: 3〜4% / 49〜53% / 16〜20% / — / 22〜23%)`);
console.log(
  `盗塁企図 ${level.stealAttemptsPerClub.toFixed(1)}/チーム 成功率 ${level.stealSuccessRate.toFixed(3)}   (目標: 105〜110 / .65〜.75)`,
);
console.log(`使用投手数 ${(season.pitchingStats.size / clubs).toFixed(1)}/チーム   (目標: 28〜30)`);
