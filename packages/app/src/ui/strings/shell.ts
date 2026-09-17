export const shell = {
  appName: 'hayakaze_sim',
  year: (y: number) => `${y}年目`,
  phase: '公式戦',
  nav: { dashboard: 'ダッシュボード', standings: '順位表', title: 'タイトル' },
} as const;
