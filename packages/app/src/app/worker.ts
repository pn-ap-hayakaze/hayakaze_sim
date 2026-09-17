/**
 * Web Worker: 複数日の進行をメインスレッドの外で実行する。
 * 入力はセーブ形式の直列化データ、出力も同じ形式。進捗は日ごとに送る。
 */
import { advanceOneDay, deserializeSeason, isSeasonOver, serializeSeason } from '@hayakaze/engine';
import type { WorkerRequest, WorkerResponse } from './workerClient.js';

const post = (msg: WorkerResponse): void => self.postMessage(msg);

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'advanceToEnd') {
      const season = deserializeSeason(req.save);
      while (!isSeasonOver(season)) {
        advanceOneDay(season);
        post({ type: 'progress', day: season.currentDay });
      }
      post({ type: 'done', save: serializeSeason(season) });
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
