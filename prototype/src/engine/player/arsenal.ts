/**
 * 球種構成（arsenal）の生成と、そこから投球の結果指標を派生させる処理。
 *
 * 設計方針:
 *  - 球種ごとの speed / breakAmount / control が「素材」。
 *  - 投手全体の speed / breakAmount / control は所持球種の平均。
 *  - シミュレーションが使う結果指標（hits, homeRuns, strikeouts, walks）は
 *    素材から派生させる。素材と結果を両方独立に持つと、能力差が二重に効く。
 *  - 各球種の breakAmount は「その球種としての質」（50 = 平均）。
 *    絶対的な変化の大きさにすると、直球を含む平均が 40 前後にずれて較正が崩れる。
 */

import type { Rng } from '../rng.js';
import type {
  BreakDirection,
  Handedness,
  Pitch,
  PitchingRatings,
  PitchKind,
} from './ratings.js';

/** 球種テンプレート。方向は右投手・捕手視点。左投手は左右を鏡映する */
interface PitchTemplate {
  name: string;
  kind: PitchKind;
  direction: BreakDirection;
  /** 直球を基準とした速度差の中心値（負なら遅い） */
  speedOffset: number;
  slowerIsBetter: boolean;
}

const FASTBALL: PitchTemplate = {
  name: 'ストレート',
  kind: 'FASTBALL',
  direction: 'STRAIGHT',
  speedOffset: 0,
  slowerIsBetter: false,
};

/** 直球以外の球種候補 */
const BREAKING_BALLS: readonly PitchTemplate[] = [
  { name: 'ツーシーム', kind: 'BREAKING', direction: 'STRAIGHT', speedOffset: -3, slowerIsBetter: false },
  { name: 'カットボール', kind: 'BREAKING', direction: 'LEFT', speedOffset: -5, slowerIsBetter: false },
  { name: 'スライダー', kind: 'BREAKING', direction: 'LEFT', speedOffset: -12, slowerIsBetter: false },
  { name: 'カーブ', kind: 'BREAKING', direction: 'DOWN_LEFT', speedOffset: -28, slowerIsBetter: true },
  { name: 'フォーク', kind: 'BREAKING', direction: 'DOWN', speedOffset: -14, slowerIsBetter: false },
  { name: 'チェンジアップ', kind: 'BREAKING', direction: 'DOWN_RIGHT', speedOffset: -20, slowerIsBetter: true },
  { name: 'シンカー', kind: 'BREAKING', direction: 'DOWN_RIGHT', speedOffset: -16, slowerIsBetter: true },
  { name: 'シュート', kind: 'BREAKING', direction: 'RIGHT', speedOffset: -6, slowerIsBetter: false },
];

const MIRROR: Record<BreakDirection, BreakDirection> = {
  STRAIGHT: 'STRAIGHT',
  LEFT: 'RIGHT',
  DOWN_LEFT: 'DOWN_RIGHT',
  DOWN: 'DOWN',
  DOWN_RIGHT: 'DOWN_LEFT',
  RIGHT: 'LEFT',
};

function clamp(v: number): number {
  return Math.round(Math.min(99, Math.max(1, v)));
}

/** 直球。常に arsenal の先頭に置く */
export function fastballOf(arsenal: Pitch[]): Pitch {
  const fastball = arsenal.find((p) => p.kind === 'FASTBALL');
  if (!fastball) throw new Error('直球を持たない球種構成です');
  return fastball;
}

/**
 * 球種構成を生成する。直球 + 2〜4 種の変化球。
 *
 * @param talent 投手の総合的な力量（階層平均 + 球団補正）
 * @param fastballSpeed 直球の速さ。リリーフは短いイニングで力を出せるため高め
 */
export function generateArsenal(
  rng: Rng,
  talent: number,
  fastballSpeed: number,
  throws: Handedness,
): Pitch[] {
  const arsenal: Pitch[] = [];
  const mirror = (d: BreakDirection) => (throws === 'L' ? MIRROR[d] : d);

  // 制球は球種ごとに散るが、中心は投手の力量に従う
  const controlCenter = talent + rng.normal(0, 6);

  arsenal.push({
    name: FASTBALL.name,
    kind: FASTBALL.kind,
    direction: FASTBALL.direction,
    speed: clamp(fastballSpeed),
    // 伸び。速い直球ほど伸びも出やすいが、独立した個性として大きく散らす
    breakAmount: clamp(talent + (fastballSpeed - talent) * 0.3 + rng.normal(0, 11)),
    // 直球は最も投げ慣れている球種なので制球が安定する
    control: rng.rating(controlCenter + 4, 7),
    slowerIsBetter: false,
  });

  const count = rng.int(2, 4);
  const candidates = rng.shuffle([...BREAKING_BALLS]);
  for (const t of candidates.slice(0, count)) {
    arsenal.push({
      name: t.name,
      kind: t.kind,
      direction: mirror(t.direction),
      speed: clamp(fastballSpeed + t.speedOffset + rng.normal(0, 3)),
      // 得意球種が生まれるよう、質の散らばりを大きめにとる
      breakAmount: clamp(talent + rng.normal(0, 10)),
      control: rng.rating(controlCenter - 3, 8),
      slowerIsBetter: t.slowerIsBetter,
    });
  }

  return arsenal;
}

/**
 * 所持球種から投手全体の速さを集計する。
 * 遅い方が良い球種は「直球との速度差」で評価する。
 * 直球150km/hに対して125km/hのカーブは、遅いことが価値になる。
 */
export function aggregateSpeed(arsenal: Pitch[]): number {
  const fastballSpeed = fastballOf(arsenal).speed;

  let total = 0;
  for (const p of arsenal) {
    if (p.slowerIsBetter) {
      // 速度差 25 でおよそ 65 点。差が大きいほど高評価
      const differential = fastballSpeed - p.speed;
      total += clamp(35 + differential * 1.2);
    } else {
      total += p.speed;
    }
  }
  return Math.round(total / arsenal.length);
}

/** 変化。直球の伸びも含めた所持球種の平均 */
export function aggregateBreak(arsenal: Pitch[]): number {
  return Math.round(arsenal.reduce((sum, p) => sum + p.breakAmount, 0) / arsenal.length);
}

export function aggregateControl(arsenal: Pitch[]): number {
  return Math.round(arsenal.reduce((sum, p) => sum + p.control, 0) / arsenal.length);
}

/** 変化球（直球以外）の質の平均。直球を持たない構成はないので必ず1つ以上ある想定 */
function breakingBallQuality(arsenal: Pitch[]): number {
  const breaking = arsenal.filter((p) => p.kind === 'BREAKING');
  if (breaking.length === 0) return 50;
  return breaking.reduce((sum, p) => sum + p.breakAmount, 0) / breaking.length;
}

/**
 * 球種構成から結果指標を派生させ、PitchingRatings を組み立てる。
 *
 * 派生の考え方:
 *   K/9  ← 速さ、変化球の質、直球の伸び。空振りを取る力。
 *          伸びのある直球は浮き上がるように見え、打者のバットが下を通る
 *   BB/9 ← コントロール。ゾーンに収める力
 *   H/9  ← 変化とコントロール。芯を外す力
 *   HR/9 ← 速さとコントロール。甘い球を減らす力
 * 派生には個体差ノイズを乗せる。素材が同じでも結果が同じにはならない。
 *
 * 各素材は 50 を中心に散っているので、結果指標も 50 を中心に組む。
 */
export function derivePitching(
  rng: Rng,
  arsenal: Pitch[],
  stamina: number,
  recovery: number,
): PitchingRatings {
  const speed = aggregateSpeed(arsenal);
  const breakAmount = aggregateBreak(arsenal);
  const control = aggregateControl(arsenal);

  const dSpeed = speed - 50;
  const dBreak = breakAmount - 50;
  const dControl = control - 50;
  const dBreaking = breakingBallQuality(arsenal) - 50;
  const dRise = fastballOf(arsenal).breakAmount - 50;

  const strikeouts = clamp(50 + dSpeed * 0.4 + dBreaking * 0.3 + dRise * 0.3 + rng.normal(0, 5));
  const walks = clamp(50 + dControl * 0.85 + dBreak * 0.15 + rng.normal(0, 5));
  const hits = clamp(50 + dBreak * 0.5 + dControl * 0.3 + dSpeed * 0.2 + rng.normal(0, 5));
  const homeRuns = clamp(50 + dSpeed * 0.4 + dControl * 0.4 + dBreak * 0.2 + rng.normal(0, 6));
  // クラッチは被安打抑止力を中心に、個体差として散らす
  const clutch = clamp(hits + rng.normal(0, 7));

  return {
    hits,
    homeRuns,
    strikeouts,
    walks,
    stamina,
    recovery,
    clutch,
    arsenal,
    speed,
    breakAmount,
    control,
  };
}
