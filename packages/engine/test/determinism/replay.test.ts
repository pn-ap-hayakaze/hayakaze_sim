import { describe, expect, it } from 'vitest';
import { advanceToEnd, createSeason } from '../../src/league/season.js';
import { snapshotSeason } from '../helpers/snapshot.js';

describe('決定性', () => {
  it('同じシードで2回シーズンを回すと順位表と全成績が一致する', () => {
    const a = createSeason(20260915);
    const b = createSeason(20260915);
    advanceToEnd(a);
    advanceToEnd(b);
    expect(snapshotSeason(a)).toBe(snapshotSeason(b));
  });

  it('異なるシードでは結果が異なる', () => {
    const a = createSeason(1);
    const b = createSeason(2);
    advanceToEnd(a);
    advanceToEnd(b);
    expect(snapshotSeason(a)).not.toBe(snapshotSeason(b));
  });
});
