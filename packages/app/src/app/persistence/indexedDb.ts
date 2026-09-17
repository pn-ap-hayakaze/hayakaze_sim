/** IndexedDB への保存・読込（idb）。スロット名をキーにする */
import { openDB, type DBSchema } from 'idb';
import type { SeasonSave } from '@hayakaze/engine';

interface HayakazeDb extends DBSchema {
  saves: {
    key: string;
    value: { savedAt: string; save: SeasonSave };
  };
}

const DB_NAME = 'hayakaze';
const DB_VERSION = 1;

function db() {
  return openDB<HayakazeDb>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore('saves');
    },
  });
}

export async function putSave(slot: string, save: SeasonSave): Promise<void> {
  const d = await db();
  await d.put('saves', { savedAt: new Date().toISOString(), save }, slot);
  d.close();
}

export async function getSave(slot: string): Promise<SeasonSave | null> {
  const d = await db();
  const v = await d.get('saves', slot);
  d.close();
  return v?.save ?? null;
}

export async function hasSave(slot: string): Promise<boolean> {
  const d = await db();
  const key = await d.getKey('saves', slot);
  d.close();
  return key !== undefined;
}
