/** 成績の集計構造 */

export interface BattingStats {
  g: number;
  pa: number;
  ab: number;
  h: number;
  double: number;
  triple: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
  r: number;
  rbi: number;
  sb: number;
  cs: number;
  /** 失策出塁 */
  roe: number;
}

export interface PitchingStats {
  g: number;
  gs: number;
  outs: number;
  bf: number;
  h: number;
  hr: number;
  bb: number;
  hbp: number;
  so: number;
  /** 推定投球数 */
  pitches: number;
  /** 失点 */
  r: number;
  /** 自責点 */
  er: number;
  w: number;
  l: number;
  sv: number;
  hld: number;
}

export function emptyBatting(): BattingStats {
  return {
    g: 0, pa: 0, ab: 0, h: 0, double: 0, triple: 0, hr: 0,
    bb: 0, hbp: 0, so: 0, r: 0, rbi: 0, sb: 0, cs: 0, roe: 0,
  };
}

export function emptyPitching(): PitchingStats {
  return {
    g: 0, gs: 0, outs: 0, bf: 0, h: 0, hr: 0, bb: 0,
    hbp: 0, so: 0, pitches: 0, r: 0, er: 0, w: 0, l: 0, sv: 0, hld: 0,
  };
}

export function addBatting(target: BattingStats, source: BattingStats): void {
  for (const key of Object.keys(target) as (keyof BattingStats)[]) {
    target[key] += source[key];
  }
}

export function addPitching(target: PitchingStats, source: PitchingStats): void {
  for (const key of Object.keys(target) as (keyof PitchingStats)[]) {
    target[key] += source[key];
  }
}

export const avg = (s: BattingStats): number => (s.ab > 0 ? s.h / s.ab : 0);

export const obp = (s: BattingStats): number => {
  const denom = s.ab + s.bb + s.hbp;
  return denom > 0 ? (s.h + s.bb + s.hbp) / denom : 0;
};

export const slg = (s: BattingStats): number => {
  if (s.ab === 0) return 0;
  const singles = s.h - s.double - s.triple - s.hr;
  return (singles + s.double * 2 + s.triple * 3 + s.hr * 4) / s.ab;
};

export const ops = (s: BattingStats): number => obp(s) + slg(s);

export const era = (s: PitchingStats): number =>
  s.outs > 0 ? (s.er * 27) / s.outs : 0;

export const whip = (s: PitchingStats): number =>
  s.outs > 0 ? ((s.h + s.bb) * 3) / s.outs : 0;

/** 投球回を "123.1" 形式で表す */
export function inningsPitched(s: PitchingStats): string {
  return `${Math.floor(s.outs / 3)}.${s.outs % 3}`;
}

/** 小数点以下3桁、先頭の0を落とす打率表記（.285 形式） */
export function fmtRate(value: number): string {
  return value.toFixed(3).replace(/^0/, '');
}
