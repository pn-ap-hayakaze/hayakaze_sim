/** Worker との型付き postMessage の橋渡し */
import type { SeasonSave } from '@hayakaze/engine';

export type WorkerRequest = { type: 'advanceToEnd'; save: SeasonSave };
export type WorkerResponse =
  | { type: 'progress'; day: number }
  | { type: 'done'; save: SeasonSave }
  | { type: 'error'; message: string };

export function runToEnd(save: SeasonSave, onProgress: (day: number) => void): Promise<SeasonSave> {
  const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress(msg.day);
      else if (msg.type === 'done') {
        worker.terminate();
        resolve(msg.save);
      } else {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    const req: WorkerRequest = { type: 'advanceToEnd', save };
    worker.postMessage(req);
  });
}
