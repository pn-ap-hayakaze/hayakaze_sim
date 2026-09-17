/**
 * 球団の型。球団データそのものは data/clubs.ts。
 */

/** リーグID。リーグ構成は設定で変えられるのでリテラル型にしない */
export type LeagueId = string;

export interface Club {
  id: string;
  /** 架空の球団名 */
  name: string;
  /** 2文字略称 */
  shortName: string;
  league: LeagueId;
  /** 本拠地都市（実在） */
  city: string;
  /** 本拠地球場（実在） */
  stadium: string;
  /** パークファクター。1.0が中立。本塁打の出やすさ */
  homeRunFactor: number;
}
