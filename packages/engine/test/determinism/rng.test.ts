/**
 * 乱数ストリームの独立性。
 *
 * 単一ストリームだった頃は、10日目に rng.next() を1回余分に呼ぶだけで
 * 12球団すべての勝敗が変わり優勝球団が入れ替わった。
 * 試合ごとに hash(masterSeed, year, day, gameId) から派生させることで、
 * ある試合の乱数消費が他の試合に波及しないことをここで保証する。
 */
import { describe, expect, it } from 'vitest';
import { createRngStreams, deriveSeed, Rng, RNG_PURPOSE, type RngStreams } from '../../src/rng.js';
import { advanceToEnd, createSeason } from '../../src/league/season.js';
import type { GameResult } from '../../src/types/game.js';

describe('Rng', () => {
  it('serialize/restore で以後の乱数列が完全に一致する', () => {
    const a = new Rng(12345);
    for (let i = 0; i < 100; i++) a.next();
    const snapshot = a.serialize();
    const b = Rng.restore(snapshot);
    for (let i = 0; i < 1000; i++) expect(b.next()).toBe(a.next());
  });

  it('同じシードから同じ列が出る', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('deriveSeed', () => {
  it('キーの順序に依存する', () => {
    expect(deriveSeed(1, 1, 0)).not.toBe(deriveSeed(1, 0, 1));
    expect(deriveSeed(1, RNG_PURPOSE.GAME, 1, 10, 3)).not.toBe(
      deriveSeed(1, RNG_PURPOSE.GAME, 1, 3, 10),
    );
  });

  it('用途が違えば別のシードになる', () => {
    expect(deriveSeed(1, RNG_PURPOSE.ROSTER)).not.toBe(deriveSeed(1, RNG_PURPOSE.SCHEDULE));
  });

  it('決定的である', () => {
    expect(deriveSeed(20260915, 3, 1, 10, 42)).toBe(deriveSeed(20260915, 3, 1, 10, 42));
  });

  it('隣接する試合IDで乱数列が相関しない（先頭100個の一致がない）', () => {
    const streams = createRngStreams(20260915);
    const a = streams.game(1, 10, 40);
    const b = streams.game(1, 10, 41);
    let same = 0;
    for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
    expect(same).toBe(0);
  });
});

/** 試合の結果を比較しやすい形に落とす */
function summarize(r: GameResult) {
  return {
    home: r.homeClubId,
    away: r.awayClubId,
    score: `${r.homeScore}-${r.awayScore}`,
    innings: r.innings,
    pa: r.events.length,
  };
}

describe('試合ごとの乱数の独立性', () => {
  const SEED = 20260915;
  const PERTURB_DAY = 10;

  // 通常のシーズン
  const normal = createSeason(SEED);
  advanceToEnd(normal);

  // 10日目の最初の試合だけ乱数を1回余分に消費するシーズン
  const targetGame = normal.scheduleByDay.get(PERTURB_DAY)![0];
  const base = createRngStreams(SEED);
  const perturbed: RngStreams = {
    masterSeed: SEED,
    forPurpose: base.forPurpose,
    game: (year, day, gameId) => {
      const rng = base.game(year, day, gameId);
      if (day === PERTURB_DAY && gameId === targetGame.id) rng.next();
      return rng;
    },
  };
  const other = createSeason(SEED, { streams: perturbed });
  advanceToEnd(other);

  const byId = (results: GameResult[], season: typeof normal) => {
    const map = new Map<number, GameResult>();
    // results は日程順に積まれる。schedule の順と1対1なので添字で対応づける
    season.schedule.forEach((g, i) => map.set(g.id, results[i]));
    return map;
  };
  const normalById = byId(normal.results, normal);
  const otherById = byId(other.results, other);

  it('日程が同一である（乱数派生の変更はロスター・日程に影響しない）', () => {
    expect(other.schedule).toEqual(normal.schedule);
  });

  it('摂動した試合そのものは結果が変わる', () => {
    expect(summarize(otherById.get(targetGame.id)!)).not.toEqual(
      summarize(normalById.get(targetGame.id)!),
    );
  });

  it('摂動した日以前の他の全試合は同一', () => {
    const games = normal.schedule.filter((g) => g.day <= PERTURB_DAY && g.id !== targetGame.id);
    expect(games.length).toBeGreaterThan(40);
    for (const g of games) {
      expect(summarize(otherById.get(g.id)!)).toEqual(summarize(normalById.get(g.id)!));
    }
  });

  it('翌日のうち摂動した試合の2球団が関わらない試合は同一', () => {
    const involved = new Set([targetGame.homeClubId, targetGame.awayClubId]);
    const games = normal.schedule.filter(
      (g) =>
        g.day === PERTURB_DAY + 1 && !involved.has(g.homeClubId) && !involved.has(g.awayClubId),
    );
    expect(games.length).toBeGreaterThan(0);
    for (const g of games) {
      expect(summarize(otherById.get(g.id)!)).toEqual(summarize(normalById.get(g.id)!));
    }
  });

  it('シーズン全体が破綻せず終わる', () => {
    expect(other.results.length).toBe(normal.results.length);
  });
});
