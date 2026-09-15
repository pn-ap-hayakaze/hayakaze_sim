/**
 * シード可能な乱数生成器 (Mulberry32)。
 * エンジン内では Math.random() を絶対に直接呼ばない。
 * すべての確率的処理はこの Rng を引数で受け取ること。
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
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
