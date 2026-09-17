/**
 * 打席単位のイベント記録。
 *
 * シーズン集計だけでは RE24・WPA・線形ウェイトの導出ができないため、
 * 打席ごとに「前後の状況」を残す。1シーズンで約 64,000 件、数 MB。
 *
 * 保存戦略（将来）: 自球団の試合は全打席、他球団はボックススコアのみ、
 * という非対称化を想定しているが、プロトタイプでは全試合を保持する。
 */

import { BASE_FIRST, BASE_SECOND, BASE_THIRD, type BaseState } from '../types/stats.js';

export function encodeBases(first: boolean, second: boolean, third: boolean): BaseState {
  return (first ? BASE_FIRST : 0) | (second ? BASE_SECOND : 0) | (third ? BASE_THIRD : 0);
}

/** 24状態（アウト数 × 走者）の添字。RE24 の表で使う */
export function baseOutIndex(outs: number, bases: BaseState): number {
  return outs * 8 + bases;
}
