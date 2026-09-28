# Epochs

Battle through five eras, from clubs to plasma, in a lane-war strategy game.

A lane-war strategy game in the spirit of the old Flash classics, rebuilt from scratch: train
fighters, ranged units and heavies, hold the lane, earn gold and experience from every fight, and
advance through five eras (Stone Age to Future) before the computer does. Each era brings three
new units, a base turret and a special power. Easy, Normal and Hard opponents; mouse, touch,
keyboard or controller; everything is drawn and synthesized in code, with no image or sound files.

- **Simulation** (`src/game/sim.ts`): the whole battle as data, advanced in fixed steps with a
  seeded random generator, so a game replays exactly. Nothing in it draws or plays sound.
- **Balance** (`src/game/data.ts`): one base table scaled by each era's power. Overtime from ten
  minutes and sudden death from eighteen keep even matches from stalling.
- **Opponent** (`src/game/ai.ts`): plays by the same commands as you. `balance.test.ts` checks
  that harder beats easier and that games end; for a fuller picture run
  `BALANCE=1 pnpm exec vitest run balance.report --silent=false`.

Part of [Jake's hub](https://raylmao.com). Scaffolded from the hub's app template, so it shares
the hub's theme, font and "back to the hub" bar (see `src/hub/`).

## Develop

```bash
pnpm install
pnpm dev
```

`pnpm check` runs the typecheck, lint, format check and tests (Vitest, any `*.test.ts` under
`src/`); CI runs it on every push.

## Deploy

Hosted as its own Cloudflare Pages project at `https://epochs.raylmao.com`. The full steps
(GitHub repo, Pages project, subdomain and hub registry entry) are in the hub's
`ADDING_AN_APP.md`.

`public/_headers` lets the hub embed this app (`frame-ancestors`). If the app calls an API or
loads anything from another origin, add that origin to the Content-Security-Policy there.
