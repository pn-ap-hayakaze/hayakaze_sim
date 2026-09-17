/**
 * 選手の自動生成。
 *
 * 設計方針:
 *  1. 各球団のロスターは「主力〜控え」の階層構造を持つ。全員が平均的な集団にはしない。
 *  2. ポジションごとに要求される能力が違う（守備位置の難易度順に打力が下がる）。
 *  3. 能力値は階層の期待値を中心に散らす。同じ階層でも一芸特化型が生まれる。
 *  4. 球団ごとに戦力差をつける。全球団が同じ強さだと順位表が無意味になる。
 */

import { Rng } from '../rng.js';
import { derivePitching, generateArsenal } from './arsenal.js';
import { drawClutch } from './clutch.js';
import { GIVEN_NAMES, SURNAMES } from '../data/names.js';
import type { Club } from '../data/clubs.js';
import {
  POSITIONS,
  type BatSide,
  type FieldingByPosition,
  type Handedness,
  type Player,
  type Position,
} from './ratings.js';

/** ロスター階層。mean は選手の総合的な力量の中心値 */
interface Tier {
  count: number;
  mean: number;
  label: string;
}

/**
 * 野手17人の階層構成。1球団あたり。
 *
 * 重要: 能力値50の基準は「実際に試合に出ている選手の平均」であって
 * 「登録選手全員の平均」ではない。控えを含めた17人の平均を50にすると、
 * スタメンの平均が56まで上がってリーグ全体の打率が跳ね上がる（実測で.292）。
 * したがって、スタメン9人の平均がおよそ50になるように階層を置く。
 */
const BATTER_TIERS: Tier[] = [
  { count: 1, mean: 62, label: '主砲' },
  { count: 2, mean: 55, label: '中心打者' },
  { count: 4, mean: 48, label: 'レギュラー' },
  { count: 3, mean: 42, label: '準レギュラー' },
  { count: 7, mean: 35, label: '控え' },
];

/**
 * 投手14人の階層構成。投球回で重み付けした平均が50になるよう置く。
 * 救援は守護神を含めて8人。7人では1試合約3.3人の救援需要を賄えず、
 * 中継ぎの年間登板が最多94に達した（現実の最多は60〜70）。
 */
const PITCHER_TIERS: (Tier & { role: 'SP' | 'RP' | 'CL' })[] = [
  { count: 1, mean: 63, label: 'エース', role: 'SP' },
  { count: 2, mean: 54, label: '先発2〜3番手', role: 'SP' },
  { count: 3, mean: 45, label: '先発4〜6番手', role: 'SP' },
  { count: 1, mean: 58, label: '守護神', role: 'CL' },
  { count: 3, mean: 51, label: 'セットアッパー', role: 'RP' },
  { count: 4, mean: 42, label: '中継ぎ', role: 'RP' },
];

/**
 * ポジション別の能力補正。
 * 守備負担の重い位置ほど打力が下がり、守備・走塁が上がる（現実の分業構造）。
 */
const POSITION_PROFILE: Record<
  Exclude<Position, 'P'>,
  { power: number; meet: number; speed: number; fielding: number; arm: number }
> = {
  C: { power: -3, meet: -5, speed: -16, fielding: 8, arm: 12 },
  '1B': { power: 8, meet: 2, speed: -10, fielding: -6, arm: -6 },
  '2B': { power: -6, meet: 1, speed: 6, fielding: 6, arm: -2 },
  '3B': { power: 5, meet: 0, speed: -3, fielding: 3, arm: 6 },
  SS: { power: -7, meet: -1, speed: 7, fielding: 9, arm: 7 },
  LF: { power: 5, meet: 1, speed: 0, fielding: -4, arm: -4 },
  CF: { power: -4, meet: 1, speed: 11, fielding: 5, arm: 0 },
  RF: { power: 6, meet: 1, speed: 1, fielding: -2, arm: 8 },
};

/** 1球団に必要な野手のポジション構成（17人） */
const BATTER_POSITION_SLOTS: Exclude<Position, 'P'>[] = [
  'C',
  'C',
  'C',
  '1B',
  '1B',
  '2B',
  '2B',
  '3B',
  '3B',
  'SS',
  'SS',
  'LF',
  'LF',
  'CF',
  'CF',
  'RF',
  'RF',
];

class NamePool {
  private used = new Set<string>();
  constructor(private rng: Rng) {}

  take(): string {
    for (let attempt = 0; attempt < 500; attempt++) {
      const name = `${this.rng.pick(SURNAMES)} ${this.rng.pick(GIVEN_NAMES)}`;
      if (!this.used.has(name)) {
        this.used.add(name);
        return name;
      }
    }
    const fallback = `選手${this.used.size + 1}`;
    this.used.add(fallback);
    return fallback;
  }
}

/** 階層平均 talent を中心に、偏差 spread で能力値を引く */
function draw(rng: Rng, talent: number, offset: number, spread = 9): number {
  return rng.rating(talent + offset, spread);
}

function makeFielding(
  rng: Rng,
  primary: Position,
  talent: number,
  fieldingBonus: number,
): FieldingByPosition {
  const fielding = {} as FieldingByPosition;
  for (const pos of POSITIONS) {
    if (pos === primary) {
      fielding[pos] = draw(rng, talent, fieldingBonus, 8);
    } else if (pos === 'P') {
      fielding[pos] = rng.rating(10, 5);
    } else {
      // 他ポジションは適性距離に応じて減衰させる
      const penalty = positionDistance(primary, pos) * 11;
      fielding[pos] = draw(rng, talent, fieldingBonus - penalty, 7);
    }
  }
  return fielding;
}

/** ポジション間の「守れなさ」距離。0=同一、1=近い、2=遠い、3=無理 */
function positionDistance(from: Position, to: Position): number {
  const groups: Position[][] = [['C'], ['1B'], ['2B', 'SS'], ['3B'], ['LF', 'RF'], ['CF']];
  const groupOf = (p: Position) => groups.findIndex((g) => g.includes(p));
  const a = groupOf(from);
  const b = groupOf(to);
  if (a === b) return 1;

  const near: Record<number, number[]> = {
    0: [3], // C → 3B
    1: [3, 4], // 1B → 3B, 隅のOF
    2: [3], // 2B/SS → 3B
    3: [1, 2, 4], // 3B → 1B, 2B/SS, 隅のOF
    4: [1, 5], // 隅のOF → 1B, CF
    5: [4], // CF → 隅のOF
  };
  if (near[a]?.includes(b)) return 2;
  return 3;
}

function rollHandedness(rng: Rng): { throws: Handedness; bats: BatSide } {
  const throws: Handedness = rng.chance(0.26) ? 'L' : 'R';
  let bats: BatSide;
  if (throws === 'L') {
    // 左投げはほぼ左打ち
    bats = rng.chance(0.93) ? 'L' : 'R';
  } else {
    const roll = rng.next();
    if (roll < 0.58) bats = 'R';
    else if (roll < 0.9) bats = 'L';
    else bats = 'S';
  }
  return { throws, bats };
}

function generateBatter(
  rng: Rng,
  names: NamePool,
  club: Club,
  id: string,
  position: Exclude<Position, 'P'>,
  talent: number,
): Player {
  const profile = POSITION_PROFILE[position];
  const { throws, bats } = rollHandedness(rng);

  // 左右の対戦別能力。プラトーン差を個体ごとに持たせる
  const meetBase = draw(rng, talent, profile.meet);
  const powerBase = draw(rng, talent, profile.power);
  // 同じ利き手の投手には弱い（右打者は対右が苦手）
  const platoonMeet = rng.rating(7, 4, 0, 18);
  const platoonPower = rng.rating(5, 3, 0, 14);
  const sameSideIsR = bats === 'R';

  return {
    id,
    name: names.take(),
    clubId: club.id,
    age: rng.rating(27, 4, 19, 41),
    throws,
    bats,
    primaryPosition: position,
    ratings: {
      batting: {
        meetVsR: clamp(meetBase - (sameSideIsR ? platoonMeet : -platoonMeet) / 2),
        meetVsL: clamp(meetBase + (sameSideIsR ? platoonMeet : -platoonMeet) / 2),
        powerVsR: clamp(powerBase - (sameSideIsR ? platoonPower : -platoonPower) / 2),
        powerVsL: clamp(powerBase + (sameSideIsR ? platoonPower : -platoonPower) / 2),
        contact: draw(rng, talent, profile.meet * 0.5),
        eye: draw(rng, talent, 0, 11),
        // クラッチは階層・ミートと独立（設計決定）。上側の裾が薄い分布
        clutch: drawClutch(rng),
      },
      running: {
        speed: draw(rng, talent, profile.speed, 11),
        stealing: draw(rng, talent, profile.speed * 0.8, 12),
        baserunning: draw(rng, talent, profile.speed * 0.3, 12),
      },
      throwing: {
        armStrength: draw(rng, talent, profile.arm, 11),
        armAccuracy: draw(rng, talent, profile.arm * 0.5, 11),
      },
      reaction: {
        forward: draw(rng, talent, profile.fielding, 10),
        backward: draw(rng, talent, profile.fielding, 10),
        right: draw(rng, talent, profile.fielding, 10),
        left: draw(rng, talent, profile.fielding, 10),
      },
      fielding: makeFielding(rng, position, talent, profile.fielding),
      durability: rng.rating(50, 13),
    },
  };
}

function generatePitcher(
  rng: Rng,
  names: NamePool,
  club: Club,
  id: string,
  role: 'SP' | 'RP' | 'CL',
  talent: number,
): Player {
  const { throws } = rollHandedness(rng);
  // リリーフは短いイニングに全力投球するため直球が速い一方スタミナが低い
  const fastballSpeed = draw(rng, talent, role === 'SP' ? 0 : 6, 8);
  const staminaBase = role === 'SP' ? 62 : 32;
  const stamina = rng.rating(staminaBase + (talent - 50) * 0.3, 9);
  // 回復は力量や役割と無関係な体質。怪我耐性とゆるく相関させる
  const durability = rng.rating(50, 13);
  const recovery = rng.rating(50 + (durability - 50) * 0.3, 10);

  const arsenal = generateArsenal(rng, talent, fastballSpeed, throws);
  // 投手のクラッチも hits と独立に引く（打者側と対称）
  const pitching = derivePitching(rng, arsenal, stamina, recovery, drawClutch(rng));

  return {
    id,
    name: names.take(),
    clubId: club.id,
    age: rng.rating(27, 4, 19, 42),
    throws,
    bats: throws === 'L' ? 'L' : 'R',
    primaryPosition: 'P',
    pitcherRole: role,
    ratings: {
      batting: {
        // 投手の打撃は総じて低い
        meetVsR: rng.rating(20, 8, 1, 55),
        meetVsL: rng.rating(20, 8, 1, 55),
        powerVsR: rng.rating(18, 8, 1, 55),
        powerVsL: rng.rating(18, 8, 1, 55),
        contact: rng.rating(22, 9, 1, 60),
        eye: rng.rating(25, 9, 1, 60),
        // クラッチは係数（f(50)=1）なので、打撃の低い投手にも平均50の分布をそのまま与える
        clutch: drawClutch(rng),
      },
      running: {
        speed: rng.rating(38, 11),
        stealing: rng.rating(25, 10),
        baserunning: rng.rating(35, 11),
      },
      throwing: {
        armStrength: draw(rng, talent, 5, 10),
        armAccuracy: draw(rng, talent, 0, 10),
      },
      reaction: {
        forward: rng.rating(45, 11),
        backward: rng.rating(42, 11),
        right: rng.rating(43, 11),
        left: rng.rating(43, 11),
      },
      fielding: makeFielding(rng, 'P', talent, -5),
      durability,
      pitching,
    },
  };
}

function clamp(v: number): number {
  return Math.round(Math.min(99, Math.max(1, v)));
}

export interface Roster {
  club: Club;
  batters: Player[];
  pitchers: Player[];
}

/**
 * 全球団のロスターを生成する。球団リストはリーグ設定から受け取る。
 * 球団ごとに戦力補正をかけ、順位争いが生まれるようにする。
 */
export function generateLeague(seed: number, clubs: readonly Club[]): Roster[] {
  const rng = new Rng(seed);
  const names = new NamePool(rng);

  // 球団間の戦力差。全選手に一律で乗るため、値が大きいと順位が固定化する。
  // 標準偏差3.5で試したところ勝率.874と.105の球団が生まれた。
  const clubStrengths = clubs.map(() => rng.normal(0, 1.0));

  return clubs.map((club, clubIndex) => {
    const strength = clubStrengths[clubIndex];
    const batters: Player[] = [];
    const pitchers: Player[] = [];

    const slots = rng.shuffle([...BATTER_POSITION_SLOTS]);
    let slotIndex = 0;
    let seq = 0;

    for (const tier of BATTER_TIERS) {
      for (let i = 0; i < tier.count; i++) {
        const position = slots[slotIndex++];
        batters.push(
          generateBatter(
            rng,
            names,
            club,
            `${club.id}-B${String(++seq).padStart(2, '0')}`,
            position,
            tier.mean + strength,
          ),
        );
      }
    }

    seq = 0;
    for (const tier of PITCHER_TIERS) {
      for (let i = 0; i < tier.count; i++) {
        pitchers.push(
          generatePitcher(
            rng,
            names,
            club,
            `${club.id}-P${String(++seq).padStart(2, '0')}`,
            tier.role,
            tier.mean + strength,
          ),
        );
      }
    }

    return { club, batters, pitchers };
  });
}
