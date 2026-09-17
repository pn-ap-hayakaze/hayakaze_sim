/** シーズンの結果を比較可能な文字列にする（順位表と全選手の成績） */
import type { SeasonState } from '../../src/types/game.js';

export function snapshotSeason(season: SeasonState): string {
  const records = [...season.records.values()].sort((a, b) => a.clubId.localeCompare(b.clubId));
  const batting = [...season.battingStats.entries()].sort(([a], [b]) => a.localeCompare(b));
  const pitching = [...season.pitchingStats.entries()].sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ currentDay: season.currentDay, records, batting, pitching });
}
