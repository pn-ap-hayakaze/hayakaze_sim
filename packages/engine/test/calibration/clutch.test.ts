/**
 * クラッチ係数の較正。
 *
 *  - 真のクラッチ才能（得点圏 wOBA − 通常 wOBA の選手間 σ）が 6〜8 wOBA ポイント
 *  - 係数の有無でリーグ得点が変わらない（E[f] = 1）
 *  - 階層差とプラトーン差が得点圏で保たれる（置換方式では消えていた）
 *  - 生成分布は平均50・σ10・上限70
 */
import { describe, expect, it } from 'vitest';
import { advanceToEnd, createSeason } from '../../src/league/season.js';
import { generateLeague } from '../../src/player/generate.js';
import { analyzeClutch } from '../../src/metrics/clutchAnalysis.js';
import { leagueLevel } from '../../src/metrics/leagueLevel.js';
import { clutchFactor } from '../../src/sim/profile.js';
import { CLUTCH_CEILING, drawClutch } from '../../src/player/clutch.js';
import { Rng } from '../../src/rng.js';
import { TEAMS } from '../../src/data/teams.js';

const SEEDS = [20260915, 1, 2, 3, 4, 5];

describe('係数 f', () => {
  it('f(50) = 1.0', () => {
    expect(clutchFactor(50)).toBe(1);
  });
  it('50 を中心に対称で単調増加', () => {
    expect(clutchFactor(60) - 1).toBeCloseTo(1 - clutchFactor(40), 10);
    expect(clutchFactor(70)).toBeGreaterThan(clutchFactor(60));
  });
});

describe('クラッチの生成分布', () => {
  const rng = new Rng(99);
  const xs: number[] = [];
  for (let i = 0; i < 100_000; i++) xs.push(drawClutch(rng));
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);

  it('平均 50 ± 0.3、σ 10 ± 0.3', () => {
    expect(mean).toBeGreaterThan(49.7);
    expect(mean).toBeLessThan(50.3);
    expect(sd).toBeGreaterThan(9.7);
    expect(sd).toBeLessThan(10.3);
  });
  it('70 を超えない（上側の裾が薄い）', () => {
    expect(Math.max(...xs)).toBeLessThanOrEqual(CLUTCH_CEILING);
  });
  it('65 超は 0.5〜3%（正規分布なら 6%）', () => {
    const above = xs.filter((x) => x > 65).length / xs.length;
    expect(above).toBeGreaterThan(0.005);
    expect(above).toBeLessThan(0.03);
  });
});

describe('真のクラッチ才能（解析値）', () => {
  const results = SEEDS.map((seed) => analyzeClutch(generateLeague(seed, TEAMS)));
  const mean = (f: (r: (typeof results)[number]) => number) =>
    results.reduce((a, r) => a + f(r), 0) / results.length;

  it('スタメンの（得点圏 wOBA − 通常 wOBA）の選手間 σ が 6〜8 wOBA ポイント', () => {
    const sd = mean((r) => r.talentSd);
    expect(
      sd,
      `シードごと: ${results.map((r) => r.talentSd.toFixed(1)).join(' / ')}`,
    ).toBeGreaterThanOrEqual(6);
    expect(sd).toBeLessThanOrEqual(8);
  });

  it('控えを含む全野手ではスタメンより小さい（乗算型: 実力の増幅）', () => {
    for (const r of results) expect(r.talentSdAll).toBeLessThan(r.talentSd);
  });

  it('才能の平均は 0 付近（E[f]=1）', () => {
    expect(Math.abs(mean((r) => r.talentMean))).toBeLessThan(1);
  });

  it('階層差が得点圏でも 0.9 倍以上保たれる', () => {
    for (const r of results) expect(r.tierGapRisp / r.tierGapNormal).toBeGreaterThan(0.9);
  });

  it('プラトーン差が得点圏でも保たれる（相関 0.95 以上）', () => {
    for (const r of results) expect(r.platoonCorrelation).toBeGreaterThan(0.95);
  });

  it('投手側にも同型の係数が効いている（打者の 0.2〜1.0 倍）', () => {
    // 同じ係数でも投手側の効きは小さい。pitcherHit の傾き（−0.06）は打者のミートの傾きより
    // 意図的に緩く、防御率の散らばりを合わせるための既存の非対称がそのまま現れる。
    // 現実でも投手のクラッチ才能は打者より小さいとされる（防御率−FIP の年度間相関 0.15〜0.25）
    const ratio = mean((r) => r.pitcherTalentSd) / mean((r) => r.talentSd);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(1.0);
  });
});

describe('リーグ得点の保存', () => {
  it('係数あり と 全員クラッチ50 で 6シード平均の 1試合平均得点の差が ±1%', () => {
    let withClutch = 0;
    let neutral = 0;
    for (const seed of SEEDS) {
      const a = createSeason(seed);
      advanceToEnd(a);
      withClutch += leagueLevel(a).runsPerGame;

      const b = createSeason(seed);
      for (const p of b.players.values()) {
        p.ratings.batting.clutch = 50;
        if (p.ratings.pitching) p.ratings.pitching.clutch = 50;
      }
      advanceToEnd(b);
      neutral += leagueLevel(b).runsPerGame;
    }
    const ratio = withClutch / neutral;
    expect(
      ratio,
      `係数あり ${(withClutch / SEEDS.length).toFixed(3)} / 全員50 ${(neutral / SEEDS.length).toFixed(3)}`,
    ).toBeGreaterThan(0.99);
    expect(ratio).toBeLessThan(1.01);
  });
});
