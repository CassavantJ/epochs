/**
 * Balance report, skipped in normal runs: `BALANCE=1 pnpm exec vitest run balance.report
 * --silent=false` plays AI against AI across seeds and prints who won, how long it took and
 * which eras were reached.
 */
import { describe, it } from 'vitest';

import { Brain, DIFFICULTIES, type DifficultyId } from './ai';
import { createGame, step } from './sim';

declare const process: { env: Record<string, string | undefined> };

const LIMIT_S = 30 * 60;

function play(left: DifficultyId | 'idle', right: DifficultyId, seed: number) {
  const state = createGame({
    seed,
    income: [left === 'idle' ? 1 : DIFFICULTIES[left].income, DIFFICULTIES[right].income],
  });
  const brains = [
    left === 'idle' ? null : new Brain(0, DIFFICULTIES[left]),
    new Brain(1, DIFFICULTIES[right]),
  ];
  const eraTimes: number[][] = [[], []];
  while (state.winner === null && state.time < LIMIT_S) {
    for (const brain of brains) brain?.update(state);
    step(state);
    for (const event of state.events)
      if (event.kind === 'advance') eraTimes[event.team]?.push(Math.round(state.time));
    state.events = [];
  }
  return {
    winner: state.winner,
    time: state.time,
    eras: state.sides.map((side) => side.era),
    eraTimes,
    stats: state.sides.map((side) => side.stats),
  };
}

describe.skipIf(!process.env.BALANCE)('balance report', () => {
  it('prints matchups', () => {
    const matchups: [DifficultyId | 'idle', DifficultyId][] = [
      ['normal', 'normal'],
      ['hard', 'easy'],
      ['normal', 'easy'],
      ['normal', 'hard'],
      ['idle', 'easy'],
    ];
    for (const [left, right] of matchups) {
      const games = Array.from({ length: 10 }, (_, index) => play(left, right, index + 1));
      const wins = [0, 1].map((team) => games.filter((game) => game.winner === team).length);
      const unfinished = games.filter((game) => game.winner === null).length;
      const minutes = games.map((game) => (game.time / 60).toFixed(1)).join(' ');
      console.log(
        `${left} vs ${right}: wins ${wins[0]}-${wins[1]}, unfinished ${unfinished} | minutes ${minutes}`,
      );
      const sample = games[0];
      console.log(
        `   sample: eras ${sample?.eras.join('/')} advances L ${sample?.eraTimes[0]?.join(',')} R ${sample?.eraTimes[1]?.join(',')} trained ${sample?.stats.map((s) => s.trained).join('/')}`,
      );
    }
  }, 600_000);
});
