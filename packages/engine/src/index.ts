/**
 * @hayakaze/engine の公開面。
 * アプリケーション層はここからだけ import する（package.json の exports で深い import を遮断している）。
 * 公開する関数は docs/functional-design.md 8.1 と、初期実装の design.md 2.3 に従う。
 */

// 型
export type * from './types/player.js';
export type * from './types/club.js';
export type * from './types/game.js';
export type * from './types/stats.js';
export { POSITIONS, LINEUP_SLOTS, BREAK_DIRECTIONS } from './types/player.js';

// シーズン進行
export {
  createSeason,
  advanceOneDay,
  advanceToDay,
  advanceToEnd,
  isSeasonOver,
  standings,
  gamesBehind,
  winPct,
} from './league/season.js';
export { leagueOf, clubsInLeague, gamesPerClub } from './league/config.js';
export { NPB_DEFAULT_CONFIG, CLUBS } from './data/clubs.js';

// 成績
export {
  avg,
  obp,
  slg,
  ops,
  era,
  whip,
  inningsPitched,
  fmtRate,
  sumBatting,
  sumPitching,
} from './sim/stats.js';
export { leagueLevel } from './metrics/leagueLevel.js';

// 永続化
export { SAVE_VERSION, serializeSeason, deserializeSeason } from './save/serialize.js';
export type { SeasonSave, SerializedGameResult } from './save/serialize.js';
