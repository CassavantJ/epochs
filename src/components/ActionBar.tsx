import { ArrowUpCircle, Castle, Flame, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

import { era, LAST_ERA, MAX_QUEUE, ROLES, type Role } from '../game/data';
import type { EpochsGame, Hud } from '../game/controller';
import styles from './ActionBar.module.css';
import { UnitIcon } from './UnitIcon';

interface ActionBarProps {
  game: EpochsGame;
  hud: Hud;
}

const ROLE_KEYS: Record<Role, string> = { melee: '1', ranged: '2', heavy: '3' };

/** A share (0–1) as a CSS variable, for fills drawn by the stylesheet. */
const fill = (share: number): CSSProperties =>
  ({ '--fill': Math.min(Math.max(share, 0), 1) }) as CSSProperties;

export function ActionBar({ game, hud }: ActionBarProps) {
  const current = era(hud.era);
  const next = hud.era < LAST_ERA ? era(hud.era + 1) : null;
  const { turret } = hud;
  const specialReady = hud.specialLeft <= 0 && !hud.specialActive;

  return (
    <div className={styles.bar} role="toolbar" aria-label="Commands">
      <div className={styles.purse} aria-live="off">
        <span className={styles.gold}>
          <span className={styles.coin} aria-hidden="true" />
          <span className="sr-only">Gold: </span>
          {hud.gold.toLocaleString()}
        </span>
        <span className={styles.xp}>
          {hud.xpNeeded === null
            ? `${hud.xp.toLocaleString()} XP`
            : `${Math.min(hud.xp, hud.xpNeeded).toLocaleString()} / ${hud.xpNeeded.toLocaleString()} XP`}
        </span>
      </div>

      <div className={styles.group} aria-label="Train units" role="group">
        {ROLES.map((role) => {
          const type = current.units[role];
          const affordable = hud.gold >= type.cost && hud.queue.length < MAX_QUEUE;
          return (
            <button
              key={role}
              type="button"
              className={styles.unit}
              data-action=""
              aria-disabled={!affordable}
              aria-keyshortcuts={ROLE_KEYS[role]}
              onClick={() => {
                game.train(role);
              }}
            >
              <UnitIcon type={type} />
              <span className={styles.label}>
                <span className={styles.name}>{type.name}</span>
                <span className={styles.cost}>{type.cost.toLocaleString()}</span>
              </span>
              <kbd className={styles.key}>{ROLE_KEYS[role]}</kbd>
            </button>
          );
        })}
      </div>

      <ol
        className={styles.queue}
        aria-label={`Training queue, ${hud.queue.length} of ${MAX_QUEUE}`}
      >
        {Array.from({ length: MAX_QUEUE }, (_, index) => {
          const order = hud.queue[index];
          return (
            <li key={index}>
              {order ? (
                <button
                  type="button"
                  className={styles.order}
                  style={fill(index === 0 ? order.progress : 0)}
                  onClick={() => {
                    game.cancel(index);
                  }}
                >
                  <span className="sr-only">Cancel {order.name}</span>
                  <span aria-hidden="true">{order.name.charAt(0)}</span>
                </button>
              ) : (
                <span className={styles.empty} />
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.group} role="group" aria-label="Base">
        <button
          type="button"
          className={styles.action}
          data-action=""
          aria-disabled={turret.kind === 'none' || hud.gold < turret.cost}
          aria-keyshortcuts="4"
          onClick={() => {
            game.turret();
          }}
        >
          <Castle aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>
            <span className={styles.name}>
              {turret.kind === 'upgrade' ? `Upgrade ${current.turret.name}` : current.turret.name}
            </span>
            <span className={styles.cost}>
              {turret.kind === 'none' ? 'Slots full' : turret.cost.toLocaleString()}
            </span>
          </span>
          <kbd className={styles.key}>4</kbd>
        </button>
        {hud.slotCost !== null && (
          <button
            type="button"
            className={styles.action}
            data-action=""
            aria-disabled={hud.gold < hud.slotCost}
            aria-keyshortcuts="5"
            onClick={() => {
              game.slot();
            }}
          >
            <Plus aria-hidden="true" className={styles.icon} />
            <span className={styles.label}>
              <span className={styles.name}>Turret slot</span>
              <span className={styles.cost}>{hud.slotCost.toLocaleString()}</span>
            </span>
            <kbd className={styles.key}>5</kbd>
          </button>
        )}
      </div>

      <div className={styles.group} role="group" aria-label="Powers">
        <button
          type="button"
          className={`${styles.action} ${styles.meter}`}
          style={fill(1 - hud.specialLeft / hud.specialTotal)}
          data-action=""
          data-ready={specialReady || undefined}
          aria-disabled={!specialReady}
          aria-keyshortcuts="6"
          onClick={() => {
            game.special();
          }}
        >
          <Flame aria-hidden="true" className={styles.icon} />
          <span className={styles.label}>
            <span className={styles.name}>{current.special.name}</span>
            <span className={styles.cost}>
              {hud.specialActive
                ? 'Incoming'
                : specialReady
                  ? 'Ready'
                  : `${Math.ceil(hud.specialLeft)}s`}
            </span>
          </span>
          <kbd className={styles.key}>6</kbd>
        </button>
        {next && (
          <button
            type="button"
            className={`${styles.action} ${styles.meter}`}
            style={fill(hud.xpNeeded ? hud.xp / hud.xpNeeded : 0)}
            data-action=""
            data-ready={hud.canAdvance || undefined}
            aria-disabled={!hud.canAdvance}
            aria-keyshortcuts="7"
            onClick={() => {
              game.advance();
            }}
          >
            <ArrowUpCircle aria-hidden="true" className={styles.icon} />
            <span className={styles.label}>
              <span className={styles.name}>{next.name}</span>
              <span className={styles.cost}>{hud.canAdvance ? 'Advance' : 'Needs XP'}</span>
            </span>
            <kbd className={styles.key}>7</kbd>
          </button>
        )}
      </div>
    </div>
  );
}
