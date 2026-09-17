/** NPB の慣例に従う数値の書式（docs/development-guidelines.md 3） */

/** 打率・出塁率などの率。先頭の 0 を落とし小数3桁（.285）。1.000 はそのまま */
export function fmtRate(v: number): string {
  return v.toFixed(3).replace(/^0(?=\.)/, '');
}

/** 防御率・WHIP（2.85） */
export function fmtEra(v: number): string {
  return v.toFixed(2);
}

/** 投球回。アウト数から "123.1" 形式 */
export function fmtInnings(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

/** 勝敗分（45-30-3） */
export function fmtRecord(wins: number, losses: number, ties: number): string {
  return `${wins}-${losses}-${ties}`;
}

/** ゲーム差。首位（0）は "—"、それ以外は小数1桁 */
export function fmtGamesBehind(gb: number): string {
  return gb === 0 ? '—' : gb.toFixed(1);
}

/** シーズン内の通算日。暦の月日は後続作業で */
export function fmtDay(day: number): string {
  return `Day ${day}`;
}
