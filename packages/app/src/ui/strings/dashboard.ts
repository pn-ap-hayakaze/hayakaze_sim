export const dashboard = {
  todayGames: '今日の試合',
  noGames: '試合はありません',
  seasonOver: 'シーズン終了',
  tie: '引き分け',
  innings: (n: number) => `${n}回`,
  advanceDay: '1日進める',
  advanceToEnd: 'シーズン末まで進める',
  save: '保存',
  saved: '保存しました',
  running: (day: number, last: number) => `進行中… Day ${day} / ${last}`,
  noSeason: 'ゲームが始まっていません。タイトルから新規開始してください。',
} as const;
