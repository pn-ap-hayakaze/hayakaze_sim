/**
 * ゲームセッション。エンジンを呼ぶのはこのモジュールだけ（UI は store を読むだけ）。
 * 初期実装ではプロトタイプの SeasonState をそのまま動かす。
 */
import {
  advanceOneDay,
  createSeason,
  deserializeSeason,
  isSeasonOver,
  serializeSeason,
} from '@hayakaze/engine';
import { useAppStore } from './store.js';
import { runToEnd } from './workerClient.js';
import { getSave, hasSave, putSave } from './persistence/indexedDb.js';

const SLOT = 'default';

function bump(partial: Partial<ReturnType<typeof useAppStore.getState>> = {}): void {
  useAppStore.setState((s) => ({ ...partial, revision: s.revision + 1 }));
}

export function newGame(seed: number): void {
  const season = createSeason(seed);
  bump({ season, todayResults: [], running: null, error: null });
}

/** 1日進める（メインスレッド）。1日 < 100 ms の要件を満たす想定 */
export function advanceDay(): void {
  const { season, running } = useAppStore.getState();
  if (!season || running || isSeasonOver(season)) return;
  const results = advanceOneDay(season);
  bump({ season, todayResults: results });
}

/** シーズン末まで進める（Worker）。直列化した状態を往復させる */
export async function advanceToEnd(): Promise<void> {
  const { season, running } = useAppStore.getState();
  if (!season || running || isSeasonOver(season)) return;
  const lastDay = season.lastDay;
  bump({ running: { day: season.currentDay, lastDay } });
  const started = performance.now();
  try {
    const save = serializeSeason(season);
    const done = await runToEnd(save, (day) => bump({ running: { day, lastDay } }));
    const restored = deserializeSeason(done);
    console.info(`advanceToEnd: ${Math.round(performance.now() - started)} ms`);
    bump({ season: restored, todayResults: [], running: null });
  } catch (e) {
    bump({ running: null, error: e instanceof Error ? e.message : String(e) });
  }
}

export async function save(): Promise<void> {
  const { season } = useAppStore.getState();
  if (!season) return;
  await putSave(SLOT, serializeSeason(season));
  bump({ hasSave: true });
}

export async function load(): Promise<boolean> {
  const stored = await getSave(SLOT);
  if (!stored) return false;
  bump({ season: deserializeSeason(stored), todayResults: [], running: null, error: null });
  return true;
}

export async function refreshHasSave(): Promise<void> {
  bump({ hasSave: await hasSave(SLOT) });
}
