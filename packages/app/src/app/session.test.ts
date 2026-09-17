import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { standings } from '@hayakaze/engine';
import { useAppStore } from './store.js';
import { advanceDay, load, newGame, save } from './session.js';

describe('GameSession', () => {
  beforeEach(() => {
    useAppStore.setState({ season: null, todayResults: [], running: null, revision: 0 });
  });

  it('newGame → advanceDay で日が進み、試合のある日には結果が入る', () => {
    newGame(20260915);
    advanceDay();
    expect(useAppStore.getState().season?.currentDay).toBe(2);
    // 1日目は月曜（移動日）で試合がない。2日目を進めると結果が入る
    advanceDay();
    const { season, todayResults } = useAppStore.getState();
    expect(season?.currentDay).toBe(3);
    expect(todayResults.length).toBeGreaterThan(0);
  });

  it('save → load で順位表と現在日が一致する', async () => {
    newGame(20260915);
    for (let i = 0; i < 10; i++) advanceDay();
    const before = useAppStore.getState().season!;
    const beforeStandings = JSON.stringify(standings(before, 'CENTRAL'));
    await save();
    useAppStore.setState({ season: null });
    expect(await load()).toBe(true);
    const after = useAppStore.getState().season!;
    expect(after.currentDay).toBe(before.currentDay);
    expect(JSON.stringify(standings(after, 'CENTRAL'))).toBe(beforeStandings);
  });
});
