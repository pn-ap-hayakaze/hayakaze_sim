/**
 * 能力値の型定義。
 * すべての能力値は 1〜99 の 100 段階。50 がリーグ平均、標準偏差は概ね 10。
 * 「平均が 50」という基準を崩すと Odds Ratio の合成式が壊れるので注意。
 */

/** 守備位置。投手を含む 9 ポジション。指名打者は守備位置ではないのでここには含めない */
export const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
export type Position = (typeof POSITIONS)[number];

/**
 * 打順の枠。守備位置 9 つ + 指名打者。
 * DH は「打つが守らない」枠であり、守備力（FieldingByPosition）は持たない。
 * POSITIONS に DH を足すと全選手に無意味な「DHの守備力」が生まれるので、型を分ける。
 */
export const LINEUP_SLOTS = [...POSITIONS, 'DH'] as const;
export type LineupSlot = (typeof LINEUP_SLOTS)[number];

/** 利き（投／打） */
export type Handedness = 'R' | 'L';
/** 打席（両打ちを含む） */
export type BatSide = 'R' | 'L' | 'S';

/** 打撃能力 */
export interface BattingRatings {
  /** ミート（芯でとらえる力）: 対右投手 — 良い打球を打つ頻度。単打を中心に全安打に効く */
  meetVsR: number;
  /** ミート（芯でとらえる力）: 対左投手 */
  meetVsL: number;
  /**
   * パワー（打球の力）: 対右投手。
   * 本塁打だけの能力ではない。強い打球は内野を抜け、外野の間を割り、フェンスを越える。
   * 本塁打に最も強く、二塁打・三塁打にも大きく、単打にも少し効く
   */
  powerVsR: number;
  /** パワー（打球の力）: 対左投手 */
  powerVsL: number;
  /** コンタクト力（バットに当てる力） — 三振率を下げる */
  contact: number;
  /** 選球眼 — 四球率を上げ、三振率をわずかに下げる */
  eye: number;
  /**
   * クラッチ（勝負強さ）— 得点圏（走者二塁または三塁）でミートに掛かる係数の元。
   * 実効ミート = meetAgainst × f(clutch)、f(50) = 1.0。置換ではなく乗算なので、
   * ミートが高い選手ほど得点圏での上振れの絶対値が大きい（勝負強さは実力の増幅）。
   * 左右別にはしない。ミート・階層と独立に生成し、上側の裾が薄い（70 を超えない）
   */
  clutch: number;
}

/** 走塁能力 */
export interface RunningRatings {
  /** 走力（素の脚力） — 内野安打・三塁打・進塁に効く */
  speed: number;
  /** 盗塁のうまさ（スタート・スライディング技術） */
  stealing: number;
  /** 走塁意識（判断力・状況把握） */
  baserunning: number;
}

/** 送球能力 */
export interface ThrowingRatings {
  /** 肩の強さ */
  armStrength: number;
  /** 肩の正確さ */
  armAccuracy: number;
}

/** 打球への反応。方向別に独立して持つ */
export interface ReactionRatings {
  /** 前方向（チャージ、小フライ） */
  forward: number;
  /** 後ろ方向（背走、ライナーバック） */
  backward: number;
  /** 右方向 */
  right: number;
  /** 左方向 */
  left: number;
}

/** 守備能力。ポジションごとの適性を個別に持つ */
export type FieldingByPosition = Record<Position, number>;

/**
 * 変化球の変化方向。捕手から見た向き。
 * ストレート系は変化量が小さい直球・ツーシーム等をまとめる。
 */
export const BREAK_DIRECTIONS = [
  'STRAIGHT', // ストレート系
  'LEFT', // ←
  'DOWN_LEFT', // ↙
  'DOWN', // ↓
  'DOWN_RIGHT', // ↘
  'RIGHT', // →
] as const;
export type BreakDirection = (typeof BREAK_DIRECTIONS)[number];

/** 球種の種別。直球は速度差の基準になり、変化の意味も異なる */
export type PitchKind = 'FASTBALL' | 'BREAKING';

/**
 * 所持球種1つ分の能力。
 * すべて 1〜99 で、50 が「その球種としての平均的な質」。
 * 絶対的な変化の大きさではないので、カーブ60とスライダー60は「どちらも良い球」という意味。
 */
export interface Pitch {
  /** 球種名（表示用） */
  name: string;
  kind: PitchKind;
  direction: BreakDirection;
  /** スピード — 速いほど高い。緩い方が良い球種でも「実際の速さ」をそのまま持つ */
  speed: number;
  /**
   * 変化。
   * 変化球では曲がりの質。
   * 直球では「伸び」— 高いほど浮き上がるように見え、打者が空振りしやすくなる。
   */
  breakAmount: number;
  /** コントロール — その球種を狙った所に投げられる精度 */
  control: number;
  /**
   * 遅い方が良いとされる球種（チェンジアップ等）。
   * 投手全体の「スピード」を集計する際、この球種は直球との速度差で評価する
   */
  slowerIsBetter: boolean;
}

/**
 * 投球能力。
 *
 * 2層構造になっている。
 *  1. 結果指標（hits, homeRuns, strikeouts, walks）— シミュレーションが直接使う。
 *     それぞれ打者の ミート／パワー／コンタクト／選球眼 と対になり、打ち消し合う。
 *  2. 球種構成（arsenal）と、その平均である speed / breakAmount / control。
 *     結果指標はこの球種構成から派生させる。GM が見る「素材」の情報。
 *
 * すべて 1〜99 で高いほど投手にとって良い。
 * H/9 等の名前は「何を抑えるか」を表しており、実際の率そのものではない。
 */
export interface PitchingRatings {
  /** H/9 — 被安打抑止力。打者のミートを打ち消す */
  hits: number;
  /** HR/9 — 被本塁打抑止力。打者のパワーを打ち消す */
  homeRuns: number;
  /** K/9 — 奪三振力。打者のコンタクトを打ち消す */
  strikeouts: number;
  /** BB/9 — ストライクゾーンにボールを収める力。打者の選球眼を打ち消す */
  walks: number;
  /** スタミナ — 1試合で投げられる球数に効く */
  stamina: number;
  /**
   * 回復 — 登板後の疲労が1日でどれだけ抜けるか。
   * スタミナとは独立した特性。スタミナが高くても回復が遅い投手は連投に向かない
   */
  recovery: number;
  /**
   * クラッチ — 得点圏で hits に掛かる係数の元。打者側と同型で、実効 hits = hits × f(clutch)。
   * hits とは独立に生成する
   */
  clutch: number;

  /** 所持球種。最低1つはストレート系を含む */
  arsenal: Pitch[];
  /** スピード — 所持球種の平均。遅い方が良い球種は直球との速度差で評価する */
  speed: number;
  /** 変化 — 所持球種の変化量の平均 */
  breakAmount: number;
  /** コントロール — 所持球種のコントロールの平均 */
  control: number;
}

/** 選手の全能力値 */
export interface Ratings {
  batting: BattingRatings;
  running: RunningRatings;
  throwing: ThrowingRatings;
  reaction: ReactionRatings;
  /** ポジション別守備力 */
  fielding: FieldingByPosition;
  /** 怪我耐性 — 高いほど故障しにくい（シーズン1では未使用、生成のみ） */
  durability: number;
  /** 投手のみ保持 */
  pitching?: PitchingRatings;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  age: number;
  /** 投げる手 */
  throws: Handedness;
  /** 打席 */
  bats: BatSide;
  /** 主ポジション */
  primaryPosition: Position;
  /** 投手の役割。野手は undefined */
  pitcherRole?: 'SP' | 'RP' | 'CL';
  ratings: Ratings;
}

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
