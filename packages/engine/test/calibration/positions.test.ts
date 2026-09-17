/**
 * DH は守備位置ではなく打順の枠である。
 *  - POSITIONS は守備位置 9 つのまま
 *  - LINEUP_SLOTS に DH が含まれる
 *  - FieldingByPosition に DH の守備力は存在しない（型レベル）
 *  - DH 制の試合では DH の出場が記録され、守備位置の出場としては記録されない
 */
import { describe, expect, it } from 'vitest';
import { ALL_FRESH, simulateGame } from '../../src/sim/game.js';
import { generateLeague } from '../../src/player/generate.js';
import { rotationFor } from '../../src/league/lineup.js';
import {
  LINEUP_SLOTS,
  POSITIONS,
  type FieldingByPosition,
  type LineupSlot,
} from '../../src/player/ratings.js';
import { Rng } from '../../src/rng.js';
import { emptyBatting, addBatting } from '../../src/sim/stats.js';
import { TEAMS } from '../../src/data/teams.js';

describe('守備位置と打順枠の型', () => {
  it('POSITIONS は守備位置 9 つで DH を含まない', () => {
    expect(POSITIONS).toHaveLength(9);
    expect((POSITIONS as readonly string[]).includes('DH')).toBe(false);
  });

  it('LINEUP_SLOTS は POSITIONS + DH', () => {
    expect(LINEUP_SLOTS).toHaveLength(10);
    expect(LINEUP_SLOTS).toContain('DH');
  });

  it('FieldingByPosition に DH は存在しない（型レベル）', () => {
    const fielding: FieldingByPosition = {
      P: 1,
      C: 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      SS: 1,
      LF: 1,
      CF: 1,
      RF: 1,
    };
    // @ts-expect-error DH は守備位置ではないので FieldingByPosition のキーにならない
    const withDh: FieldingByPosition = { ...fielding, DH: 1 };
    expect(Object.keys(fielding)).not.toContain('DH');
    expect(withDh).toBeDefined();
  });

  it('appearances の加算は枠ごとに行われる', () => {
    const a = emptyBatting();
    const b = emptyBatting();
    a.appearances.SS = 2;
    b.appearances.SS = 3;
    b.appearances.DH = 1;
    addBatting(a, b);
    expect(a.appearances.SS).toBe(5);
    expect(a.appearances.DH).toBe(1);
    expect(a.appearances.C).toBe(0);
  });
});

describe('試合での出場枠の記録', () => {
  const rosters = generateLeague(20260915, TEAMS);
  const home = rosters[0];
  const away = rosters[6];

  function play(dh: boolean) {
    return simulateGame(
      home,
      away,
      rotationFor(home, 0),
      rotationFor(away, 0),
      home.team,
      new Rng(1),
      ALL_FRESH,
      { dh },
    );
  }

  function slotsOf(result: ReturnType<typeof play>, teamId: string) {
    const totals = {} as Record<LineupSlot, number>;
    for (const slot of LINEUP_SLOTS) totals[slot] = 0;
    for (const [id, s] of result.batting) {
      const player = [...home.batters, ...home.pitchers, ...away.batters, ...away.pitchers].find(
        (p) => p.id === id,
      )!;
      if (player.teamId !== teamId) continue;
      for (const slot of LINEUP_SLOTS) totals[slot] += s.appearances[slot];
    }
    return totals;
  }

  it('DH 制では両軍とも DH 1 人・投手 0 人が打順に入る', () => {
    const result = play(true);
    for (const teamId of [home.team.id, away.team.id]) {
      const slots = slotsOf(result, teamId);
      expect(slots.DH).toBe(1);
      expect(slots.P).toBe(0);
      for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const) {
        expect(slots[pos]).toBe(1);
      }
    }
  });

  it('DH 制でなければ DH 0 人・投手 1 人が打順に入る', () => {
    const result = play(false);
    for (const teamId of [home.team.id, away.team.id]) {
      const slots = slotsOf(result, teamId);
      expect(slots.DH).toBe(0);
      expect(slots.P).toBe(1);
    }
  });

  it('DH は守備位置の出場としては記録されない', () => {
    const result = play(true);
    const dhId = [...result.batting.entries()].find(([, s]) => s.appearances.DH === 1)![0];
    const s = result.batting.get(dhId)!;
    const fieldingAppearances = POSITIONS.reduce((a, pos) => a + s.appearances[pos], 0);
    expect(fieldingAppearances).toBe(0);
  });
});
