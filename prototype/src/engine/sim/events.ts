/**
 * 打席単位のイベント記録。
 *
 * シーズン集計だけでは RE24・WPA・線形ウェイトの導出ができないため、
 * 打席ごとに「前後の状況」を残す。1シーズンで約 64,000 件、数 MB。
 *
 * 保存戦略（将来）: 自球団の試合は全打席、他球団はボックススコアのみ、
 * という非対称化を想定しているが、プロトタイプでは全試合を保持する。
 */

import type { PaOutcome } from './oddsRatio.js';

/**
 * 走者状態のビット表現。
 *   1 = 一塁, 2 = 二塁, 4 = 三塁
 * 0 = 走者なし … 7 = 満塁。アウト数(0〜2)と組み合わせて 24 状態になる。
 */
export type BaseState = number;

export const BASE_FIRST = 1;
export const BASE_SECOND = 2;
export const BASE_THIRD = 4;

export function encodeBases(first: boolean, second: boolean, third: boolean): BaseState {
  return (first ? BASE_FIRST : 0) | (second ? BASE_SECOND : 0) | (third ? BASE_THIRD : 0);
}

/** 24状態（アウト数 × 走者）の添字。RE24 の表で使う */
export function baseOutIndex(outs: number, bases: BaseState): number {
  return outs * 8 + bases;
}

export interface PlateAppearanceEvent {
  inning: number;
  /** 表（ビジターの攻撃）なら true */
  top: boolean;
  batterId: string;
  pitcherId: string;
  outcome: PaOutcome;
  /** インプレーのアウトが失策で出塁になった打席 */
  reachedOnError: boolean;
  /** 打席前のアウト数 0〜2 */
  outsBefore: number;
  basesBefore: BaseState;
  /** 打席後のアウト数 0〜3 */
  outsAfter: number;
  basesAfter: BaseState;
  /** この打席で入った得点 */
  runs: number;
  /** 打席前の得点差（攻撃側 − 守備側） */
  scoreDiffBefore: number;
}
