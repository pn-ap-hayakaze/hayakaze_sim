/**
 * クラッチ（勝負強さ）の生成。
 *
 * 設計決定:
 *  - ミートや階層とは独立に生成する
 *  - 「そうそう高くならない」。上側の裾が薄い分布で、正規分布ではない
 *  - 平均 50・標準偏差 10 は保つ。20-80 スケール（σ10 = 1グレード）との 1:1 対応を崩さないため。
 *    「稀にしか高くならない」は σ ではなく分布の形で表現する
 *
 * 分布: clutch = 70 − Gamma(shape 4, scale 5)
 *   平均 70 − 4×5 = 50、σ = 5×√4 = 10。上限は 70（Gamma は非負）。
 *   65 超は約 1.4%（正規なら 6.1%）、70 超は 0。30 未満は約 4%（正規なら 2%）で下側はやや厚い。
 *   中央値 52、90%点 61、99%点 66。
 *   shape 4 の Gamma は指数乱数 4 つの和（Erlang）なので専用のサンプラーが要らない。
 *
 * 投手のクラッチも同じ分布で、hits とは独立に引く（打者側と対称）。
 */

import type { Rng } from '../rng.js';

/** クラッチの上限。Gamma の下限 0 がここに写る */
export const CLUTCH_CEILING = 70;
export const CLUTCH_GAMMA_SHAPE = 4;
export const CLUTCH_GAMMA_SCALE = 5;

export function drawClutch(rng: Rng): number {
  let gamma = 0;
  for (let i = 0; i < CLUTCH_GAMMA_SHAPE; i++) gamma += rng.exponential();
  const value = CLUTCH_CEILING - CLUTCH_GAMMA_SCALE * gamma;
  return Math.round(Math.min(99, Math.max(1, value)));
}
