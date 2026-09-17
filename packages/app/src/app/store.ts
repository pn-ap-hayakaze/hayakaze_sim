/**
 * アプリケーションの状態（Zustand）。
 * SeasonState はエンジンが in-place で変更するので、変更のたびに revision を上げて再描画を促す。
 */
import { create } from 'zustand';
import type { GameResult, SeasonState } from '@hayakaze/engine';

export interface RunningState {
  /** 進行中の日 */
  day: number;
  lastDay: number;
}

export interface AppState {
  season: SeasonState | null;
  /** 直近に進めた日の試合結果 */
  todayResults: GameResult[];
  /** Worker で複数日を進めている間だけ非 null */
  running: RunningState | null;
  /** 保存スロットにデータがあるか（タイトル画面のロードボタン用） */
  hasSave: boolean;
  error: string | null;
  /** season の in-place 変更を購読者に伝えるためのカウンタ */
  revision: number;
}

export const useAppStore = create<AppState>(() => ({
  season: null,
  todayResults: [],
  running: null,
  hasSave: false,
  error: null,
  revision: 0,
}));
