/**
 * 能力値の型定義。
 * すべての能力値は 1〜99 の 100 段階。50 がリーグ平均、標準偏差は概ね 10。
 * 「平均が 50」という基準を崩すと Odds Ratio の合成式が壊れるので注意。
 */

import type { BatSide, BattingRatings, Handedness } from '../types/player.js';

/** 打席で実際に適用される左右。両打ちは投手と逆の打席に入る */
export function effectiveBatSide(bats: BatSide, pitcherThrows: Handedness): Handedness {
  if (bats === 'S') return pitcherThrows === 'R' ? 'L' : 'R';
  return bats;
}

/** 対戦相手の利き腕に応じたミート値 */
export function meetAgainst(b: BattingRatings, pitcherThrows: Handedness): number {
  return pitcherThrows === 'R' ? b.meetVsR : b.meetVsL;
}

/** 対戦相手の利き腕に応じたパワー値 */
export function powerAgainst(b: BattingRatings, pitcherThrows: Handedness): number {
  return pitcherThrows === 'R' ? b.powerVsR : b.powerVsL;
}
