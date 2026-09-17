import { describe, expect, it } from 'vitest';
import { advanceToDay, advanceToEnd, createSeason } from '../../../src/league/season.js';
import { deserializeSeason, serializeSeason } from '../../../src/save/serialize.js';
import { snapshotSeason } from '../../helpers/snapshot.js';

const SEED = 20260915;

describe('セーブ形式 v1', () => {
  it('30日目で保存して復元し、最後まで進めた結果が保存せずに進めた場合と完全に一致する', () => {
    const straight = createSeason(SEED);
    advanceToEnd(straight);

    const season = createSeason(SEED);
    advanceToDay(season, 30);
    // JSON を経由して、Map や参照共有に頼っていないことを確かめる
    const json = JSON.stringify(serializeSeason(season));
    const restored = deserializeSeason(JSON.parse(json));
    expect(restored.currentDay).toBe(season.currentDay);
    advanceToEnd(restored);

    expect(snapshotSeason(restored)).toEqual(snapshotSeason(straight));
  });

  it('復元後の players 索引は rosters と同じオブジェクトを指す', () => {
    const season = createSeason(SEED);
    advanceToDay(season, 3);
    const restored = deserializeSeason(JSON.parse(JSON.stringify(serializeSeason(season))));
    const roster = [...restored.rosters.values()][0];
    const p = roster.batters[0];
    expect(restored.players.get(p.id)).toBe(p);
    expect(roster.club).toBe(restored.clubs.get(roster.club.id));
  });

  it('未対応のバージョンは拒否する', () => {
    const save = serializeSeason(createSeason(SEED));
    expect(() => deserializeSeason({ ...save, version: 99 as 1 })).toThrow(/バージョン/);
  });
});
