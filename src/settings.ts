import { DIFFICULTY_IDS, type DifficultyId } from './game/ai';

export interface Settings {
  difficulty: DifficultyId;
  sound: boolean;
  /** Fastest win per difficulty, in seconds of game time. */
  best: Partial<Record<DifficultyId, number>>;
  wins: Partial<Record<DifficultyId, number>>;
}

const KEY = 'epochs.v1';
export const DEFAULT_SETTINGS: Settings = { difficulty: 'normal', sound: true, best: {}, wins: {} };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const isDifficulty = (value: unknown): value is DifficultyId =>
  DIFFICULTY_IDS.some((id) => id === value);

function times(value: unknown): Partial<Record<DifficultyId, number>> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [DifficultyId, number] =>
        isDifficulty(entry[0]) && typeof entry[1] === 'number' && entry[1] > 0,
    ),
  );
}

export function loadSettings(store: Pick<Storage, 'getItem'> | null = storage()): Settings {
  try {
    const raw: unknown = JSON.parse(store?.getItem(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
    const record = raw as Record<string, unknown>;
    return {
      difficulty: isDifficulty(record.difficulty) ? record.difficulty : DEFAULT_SETTINGS.difficulty,
      sound: typeof record.sound === 'boolean' ? record.sound : DEFAULT_SETTINGS.sound,
      best: times(record.best),
      wins: times(record.wins),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(
  settings: Settings,
  store: Pick<Storage, 'setItem'> | null = storage(),
): void {
  try {
    store?.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private browsing: settings last for this visit only.
  }
}

/** Counts a win and keeps the fastest time. */
export function recordWin(settings: Settings, difficulty: DifficultyId, seconds: number): Settings {
  const best = settings.best[difficulty];
  return {
    ...settings,
    best: {
      ...settings.best,
      [difficulty]: best === undefined ? seconds : Math.min(best, seconds),
    },
    wins: { ...settings.wins, [difficulty]: (settings.wins[difficulty] ?? 0) + 1 },
  };
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
