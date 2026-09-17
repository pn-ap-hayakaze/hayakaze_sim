/**
 * シード可能な乱数生成器 (Mulberry32) と、用途別・試合別の独立ストリーム。
 * エンジン内では Math.random() を絶対に直接呼ばない。
 * すべての確率的処理はこの Rng を引数で受け取ること。
 *
 * ストリームの独立性:
 *   単一の Rng をシーズン全体で共有すると、ある試合で乱数を1回余分に消費するだけで
 *   以後の全試合の結果が変わる（実測で12球団全部の勝敗が変わり優勝球団が入れ替わった）。
 *   セーブ&ロードで打順を触れば残りシーズンを引き直せてしまう。
 *   そのため試合ごとに hash(masterSeed, 用途, year, day, gameId) からシードを派生させ、
 *   故障・スカウト観測・成長・AI 意思決定も将来それぞれ独立に派生できる形にしておく。
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** 内部状態を書き出す。セーブデータに保存し restore() で復元する */
  serialize(): number {
    return this.state;
  }

  /** serialize() で書き出した状態から復元する。以後の乱数列は元と完全に一致する */
  static restore(state: number): Rng {
    return new Rng(state);
  }

  /** [0, 1) の一様乱数 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] の整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 標準正規分布 (Box-Muller) */
  normal(mean = 0, sd = 1): number {
    const u1 = Math.max(this.next(), Number.EPSILON);
    const u2 = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** 平均 mean, 標準偏差 sd の正規乱数を [min, max] に丸めた整数（能力値生成用） */
  rating(mean: number, sd: number, min = 1, max = 99): number {
    return Math.round(Math.min(max, Math.max(min, this.normal(mean, sd))));
  }

  /** 平均1の指数乱数 */
  exponential(): number {
    return -Math.log(Math.max(this.next(), Number.EPSILON));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  /** 確率 p で true */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** 32bit 整数の攪拌（murmur3 の fmix32） */
function mix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * マスターシードとキー列からシードを派生させる。
 * キーの順序に依存する（(1, 0) と (0, 1) は別のシード）。
 * 負の数や 2^32 以上の整数も 32bit に丸めて受け付ける。
 */
export function deriveSeed(masterSeed: number, ...keys: number[]): number {
  let h = mix32(masterSeed >>> 0);
  for (let i = 0; i < keys.length; i++) {
    // 位置ごとに異なる定数を足してから混ぜる。同じ値でも位置が違えば別の寄与になる
    const k = mix32((keys[i] >>> 0) + Math.imul(i + 1, 0x9e3779b9));
    h = mix32((h ^ k) >>> 0);
  }
  return h;
}

/** 乱数の用途タグ。用途ごとにストリームを分ける */
export const RNG_PURPOSE = {
  /** ロスター生成 */
  ROSTER: 1,
  /** 日程生成 */
  SCHEDULE: 2,
  /** 試合の進行 */
  GAME: 3,
  // 以下は将来用。派生口だけ用意しておく
  INJURY: 4,
  SCOUT: 5,
  GROWTH: 6,
  AI: 7,
} as const;
export type RngPurpose = (typeof RNG_PURPOSE)[keyof typeof RNG_PURPOSE];

/** 用途別・試合別に独立した Rng を払い出す */
export interface RngStreams {
  readonly masterSeed: number;
  /** 試合用。hash(masterSeed, GAME, year, day, gameId) から派生する */
  game(year: number, day: number, gameId: number): Rng;
  /** 任意用途。hash(masterSeed, purpose, ...keys) から派生する */
  forPurpose(purpose: RngPurpose, ...keys: number[]): Rng;
}

export function createRngStreams(masterSeed: number): RngStreams {
  return {
    masterSeed,
    game: (year, day, gameId) =>
      new Rng(deriveSeed(masterSeed, RNG_PURPOSE.GAME, year, day, gameId)),
    forPurpose: (purpose, ...keys) => new Rng(deriveSeed(masterSeed, purpose, ...keys)),
  };
}
