import { describe, expect, it } from 'vitest';
import { fmtDay, fmtEra, fmtGamesBehind, fmtInnings, fmtRate, fmtRecord } from './index.js';

describe('書式', () => {
  it('率は先頭の 0 を落として小数3桁', () => {
    expect(fmtRate(0.2854)).toBe('.285');
    expect(fmtRate(0)).toBe('.000');
    expect(fmtRate(1)).toBe('1.000');
  });
  it('防御率は小数2桁', () => expect(fmtEra(2.8499)).toBe('2.85'));
  it('投球回はアウト数から 123.1 形式', () => expect(fmtInnings(370)).toBe('123.1'));
  it('勝敗分', () => expect(fmtRecord(45, 30, 3)).toBe('45-30-3'));
  it('ゲーム差は首位が —', () => {
    expect(fmtGamesBehind(0)).toBe('—');
    expect(fmtGamesBehind(2.5)).toBe('2.5');
  });
  it('日', () => expect(fmtDay(78)).toBe('Day 78'));
});
