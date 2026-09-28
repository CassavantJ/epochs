import { describe, expect, it } from 'vitest';

import { Brain, DIFFICULTIES, type DifficultyId } from './ai';
import { createGame, step } from './sim';

/** AI against AI until someone wins. Sudden death guarantees that by about 20 minutes. */
function play(left: DifficultyId | null, right: DifficultyId, seed: number) {
  const state = createGame({
    seed,
    income: [left ? DIFFICULTIES[left].income : 1, DIFFICULTIES[right].income],
  });
  const brains = [
    left ? new Brain(0, DIFFICULTIES[left]) : null,
    new Brain(1, DIFFICULTIES[right]),
  ];
  while (state.winner === null) {
    for (const brain of brains) brain?.update(state);
    step(state);
    state.events.length = 0;
  }
  return state;
}

describe('balance', () => {
  it('lets a harder AI beat an easier one', () => {
    for (const seed of [1, 2, 3]) expect(play('hard', 'easy', seed).winner).toBe(0);
  });

  it('beats a player who does nothing, quickly', () => {
    const state = play(null, 'easy', 1);
    expect(state.winner).toBe(1);
    expect(state.time).toBeLessThan(5 * 60);
  });

  it('ends even matches within about twenty minutes', () => {
    for (const seed of [4, 5]) {
      const state = play('normal', 'normal', seed);
      expect(state.time).toBeLessThan(20 * 60 + 5);
      // Both sides get to the last era along the way.
      expect(state.sides.map((side) => side.era)).toEqual([4, 4]);
    }
  });
}, 120_000);
