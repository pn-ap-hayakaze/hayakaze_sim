/**
 * 12球団の定義。
 *
 * 本拠地（都市・球場）は実在のものをそのまま使う。
 * 球団名・略称は架空のものとし、実在球団の商標を避ける。
 * 実名でプレイしたい場合は data/ 配下に外部データを差し込む想定。
 */

import type { LeagueConfig } from '../league/config.js';

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

export const CLUBS: readonly Club[] = [
  // セントラル・リーグ
  {
    id: 'C01',
    name: '東京スワローズ',
    shortName: '東京',
    league: 'CENTRAL',
    city: '東京都新宿区',
    stadium: '明治神宮野球場',
    homeRunFactor: 1.18,
  },
  {
    id: 'C02',
    name: '水道橋ジャイアンツ',
    shortName: '水道',
    league: 'CENTRAL',
    city: '東京都文京区',
    stadium: '東京ドーム',
    homeRunFactor: 1.12,
  },
  {
    id: 'C03',
    name: '横浜ベイスターズ',
    shortName: '横浜',
    league: 'CENTRAL',
    city: '神奈川県横浜市',
    stadium: '横浜スタジアム',
    homeRunFactor: 1.08,
  },
  {
    id: 'C04',
    name: '名古屋ドラゴンズ',
    shortName: '名古',
    league: 'CENTRAL',
    city: '愛知県名古屋市',
    stadium: 'ナゴヤドーム',
    homeRunFactor: 0.78,
  },
  {
    id: 'C05',
    name: '西宮タイガース',
    shortName: '西宮',
    league: 'CENTRAL',
    city: '兵庫県西宮市',
    stadium: '阪神甲子園球場',
    homeRunFactor: 0.85,
  },
  {
    id: 'C06',
    name: '広島カープス',
    shortName: '広島',
    league: 'CENTRAL',
    city: '広島県広島市',
    stadium: '広島市民球場',
    homeRunFactor: 0.95,
  },

  // パシフィック・リーグ
  {
    id: 'P01',
    name: '北広島ファイターズ',
    shortName: '北広',
    league: 'PACIFIC',
    city: '北海道北広島市',
    stadium: 'エスコンフィールド',
    homeRunFactor: 0.9,
  },
  {
    id: 'P02',
    name: '仙台イーグルス',
    shortName: '仙台',
    league: 'PACIFIC',
    city: '宮城県仙台市',
    stadium: '宮城球場',
    homeRunFactor: 0.92,
  },
  {
    id: 'P03',
    name: '所沢ライオンズ',
    shortName: '所沢',
    league: 'PACIFIC',
    city: '埼玉県所沢市',
    stadium: '西武ドーム',
    homeRunFactor: 1.02,
  },
  {
    id: 'P04',
    name: '千葉マリーンズ',
    shortName: '千葉',
    league: 'PACIFIC',
    city: '千葉県千葉市',
    stadium: '千葉マリンスタジアム',
    homeRunFactor: 0.88,
  },
  {
    id: 'P05',
    name: '大阪バファローズ',
    shortName: '大阪',
    league: 'PACIFIC',
    city: '大阪府大阪市',
    stadium: '大阪ドーム',
    homeRunFactor: 0.94,
  },
  {
    id: 'P06',
    name: '福岡ホークス',
    shortName: '福岡',
    league: 'PACIFIC',
    city: '福岡県福岡市',
    stadium: '福岡ドーム',
    homeRunFactor: 0.86,
  },
];

export function clubById(id: string): Club {
  const club = CLUBS.find((t) => t.id === id);
  if (!club) throw new Error(`不明な球団ID: ${id}`);
  return club;
}

/**
 * シーズン1の既定リーグ構成。NPB 準拠だが、指名打者は両リーグで採用する（設計決定）。
 * 同一リーグ 25試合 × 5球団 + 交流戦 3試合 × 6球団 = 143試合。
 */
export const NPB_DEFAULT_CONFIG: LeagueConfig = {
  clubs: CLUBS,
  leagues: [
    { id: 'CENTRAL', name: 'セントラル・リーグ', dh: true },
    { id: 'PACIFIC', name: 'パシフィック・リーグ', dh: true },
  ],
  gamesVsSameLeague: 25,
  gamesVsOtherLeague: 3,
};
