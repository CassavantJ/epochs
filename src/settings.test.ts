import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, formatTime, loadSettings, recordWin, saveSettings } from './settings';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe('settings', () => {
  it('round-trips and falls back to defaults', () => {
    const store = memory();
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    const settings = recordWin(
      { ...DEFAULT_SETTINGS, sound: false, difficulty: 'hard' },
      'hard',
      612,
    );
    saveSettings(settings, store);
    expect(loadSettings(store)).toEqual(settings);
    store.setItem(
      'epochs.v1',
      '{"difficulty":"impossible","sound":"yes","best":{"hard":-1,"easy":90}}',
    );
    expect(loadSettings(store)).toEqual({ ...DEFAULT_SETTINGS, best: { easy: 90 } });
  });

  it('keeps the fastest win and counts wins', () => {
    const once = recordWin(DEFAULT_SETTINGS, 'easy', 500);
    const twice = recordWin(once, 'easy', 700);
    expect(twice.best.easy).toBe(500);
    expect(twice.wins.easy).toBe(2);
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(754.9)).toBe('12:34');
  });
});
