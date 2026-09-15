/**
 * オーダーとローテーションの自動編成。
 *
 * GM モードでは最終的にプレイヤーがここを操作する。
 * 現時点では「AIが妥当な布陣を組む」既定値として実装しておき、
 * 後で UI からの指示で差し替えられるよう純粋関数に保つ。
 */

import type { Roster } from '../player/generate.js';
import type { Player, Position } from '../player/ratings.js';

/** 打撃の総合的な良さ。打順決定にのみ使う簡易指標 */
export function batterValue(p: Player): number {
  const b = p.ratings.batting;
  const meet = (b.meetVsR + b.meetVsL) / 2;
  const power = (b.powerVsR + b.powerVsL) / 2;
  return meet * 0.35 + power * 0.3 + b.contact * 0.15 + b.eye * 0.2;
}

/** 守備位置への適性 */
function fieldingValue(p: Player, pos: Position): number {
  const r = p.ratings;
  const reaction =
    (r.reaction.forward + r.reaction.backward + r.reaction.right + r.reaction.left) / 4;
  const arm = r.throwing.armStrength * 0.5 + r.throwing.armAccuracy * 0.5;
  return r.fielding[pos] * 0.6 + reaction * 0.25 + arm * 0.15;
}

const FIELD_POSITIONS: Position[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export interface Lineup {
  /** 打順1〜9。DH制なしの場合9番は投手 */
  order: Player[];
  /** 守備位置 → 選手 */
  defense: Map<Position, Player>;
  startingPitcher: Player;
}

/**
 * スタメンを組む。
 * 守備位置は「適性 + 打力」の合成値で貪欲に埋める。守備の穴は打力で埋め合わせる。
 */
export function buildLineup(
  roster: Roster,
  startingPitcher: Player,
  useDh: boolean,
): Lineup {
  const available = [...roster.batters];
  const defense = new Map<Position, Player>();

  // 希少性の高い位置（捕手・遊撃・中堅）から埋める
  const fillOrder: Position[] = ['C', 'SS', 'CF', '2B', '3B', 'RF', 'LF', '1B'];

  for (const pos of fillOrder) {
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const player of available) {
      const score = fieldingValue(player, pos) * 0.6 + batterValue(player) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = player;
      }
    }
    if (!best) throw new Error(`守備位置 ${pos} を埋められません`);
    defense.set(pos, best);
    available.splice(available.indexOf(best), 1);
  }

  const starters = FIELD_POSITIONS.map((pos) => defense.get(pos)!);

  if (useDh) {
    // 残りの中で最も打てる選手をDHに
    const dh = available.reduce((a, b) => (batterValue(a) >= batterValue(b) ? a : b));
    starters.push(dh);
  } else {
    starters.push(startingPitcher);
  }

  return {
    order: arrangeBattingOrder(starters, useDh ? null : startingPitcher),
    defense,
    startingPitcher,
  };
}

/**
 * 打順を決める。
 * 1番=出塁と走力、2番=つなぎ、3〜4番=長打、5番以降=残りを打力順。
 * 投手は必ず9番に固定する。
 */
function arrangeBattingOrder(starters: Player[], pitcher: Player | null): Player[] {
  const pool = starters.filter((p) => p !== pitcher);
  const remaining = [...pool];

  const take = (score: (p: Player) => number): Player => {
    const best = remaining.reduce((a, b) => (score(a) >= score(b) ? a : b));
    remaining.splice(remaining.indexOf(best), 1);
    return best;
  };

  const power = (p: Player) => (p.ratings.batting.powerVsR + p.ratings.batting.powerVsL) / 2;
  const onBase = (p: Player) =>
    p.ratings.batting.eye * 0.5 +
    (p.ratings.batting.meetVsR + p.ratings.batting.meetVsL) / 2 * 0.5;

  const order: Player[] = [];
  order.push(take((p) => onBase(p) * 0.7 + p.ratings.running.speed * 0.3)); // 1番
  order.push(take((p) => onBase(p) * 0.8 + p.ratings.batting.contact * 0.2)); // 2番
  order.push(take((p) => batterValue(p))); // 3番
  order.push(take((p) => power(p) * 0.7 + batterValue(p) * 0.3)); // 4番
  order.push(take((p) => power(p) * 0.5 + batterValue(p) * 0.5)); // 5番

  remaining.sort((a, b) => batterValue(b) - batterValue(a));
  order.push(...remaining);

  if (pitcher) order.push(pitcher);
  return order;
}

/** 先発ローテーション（6人制）。ローテ番号から先発投手を決める */
export function rotationFor(roster: Roster, gameNumber: number): Player {
  const starters = roster.pitchers.filter((p) => p.pitcherRole === 'SP');
  return starters[gameNumber % starters.length];
}

/** ブルペンの役割分担 */
export interface Bullpen {
  /** 守護神。リードした9回に投げる */
  closer: Player;
  /**
   * セットアッパー3人（勝ちパターンの7回・8回・9回要員）。接戦の終盤に投げ、それ以外では温存する。
   * 2人では接戦終盤の需要（年間180登板前後）を賄えず、1人が95登板に達した
   */
  setup: Player[];
  /** 中継ぎ。接戦以外の場面を担う */
  middle: Player[];
}

/**
 * 救援を役割に振り分ける。
 * 役割を固定せず「その時いちばん良い投手」を毎回選ぶと、能力が高く回復も速い
 * 救援が年間90登板し、下位の中継ぎが20登板台に沈んだ。現実の運用に合わせて
 * 役割で登板機会を分ける。
 */
export function bullpen(roster: Roster): Bullpen {
  const relievers = roster.pitchers
    .filter((p) => p.pitcherRole === 'RP')
    .sort((a, b) => pitcherValue(b) - pitcherValue(a));
  const closer = roster.pitchers.find((p) => p.pitcherRole === 'CL') ?? relievers.shift()!;
  return {
    closer,
    setup: relievers.slice(0, 3),
    middle: relievers.slice(3),
  };
}

/** 投手の総合的な良さ。結果指標4つの平均で、ブルペンの登板順に使う */
export function pitcherValue(p: Player): number {
  const r = p.ratings.pitching;
  if (!r) return 0;
  return (r.hits + r.homeRuns + r.strikeouts + r.walks) / 4;
}
