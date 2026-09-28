import { DIFFICULTIES, type DifficultyId } from '../game/ai';
import { era } from '../game/data';
import type { SideStats } from '../game/sim';
import { formatTime } from '../settings';
import buttons from './Buttons.module.css';
import { Dialog } from './Dialog';
import styles from './EndDialog.module.css';

interface EndDialogProps {
  won: boolean;
  seconds: number;
  difficulty: DifficultyId;
  /** Fastest win before this game. */
  best: number | undefined;
  stats: SideStats;
  era: number;
  onRestart: () => void;
  onExit: () => void;
}

export function EndDialog({
  won,
  seconds,
  difficulty,
  best,
  stats,
  era: reached,
  onRestart,
  onExit,
}: EndDialogProps) {
  const record = won && (best === undefined || seconds < best);
  return (
    <Dialog title={won ? 'Victory' : 'Defeat'} onCancel={onExit}>
      <p className={styles.summary}>
        {won
          ? `You took the enemy base on ${DIFFICULTIES[difficulty].name} in ${formatTime(seconds)}.`
          : `Your base fell after ${formatTime(seconds)}.`}
        {record && <span className={styles.record}> A new best time!</span>}
      </p>
      <dl className={styles.stats}>
        <div>
          <dt>Reached</dt>
          <dd>{era(reached).name}</dd>
        </div>
        <div>
          <dt>Trained</dt>
          <dd>{stats.trained}</dd>
        </div>
        <div>
          <dt>Defeated</dt>
          <dd>{stats.kills}</dd>
        </div>
        <div>
          <dt>Lost</dt>
          <dd>{stats.losses}</dd>
        </div>
      </dl>
      <div className={buttons.stack}>
        <button type="button" className={buttons.primary} onClick={onRestart}>
          Play again
        </button>
        <button type="button" className={buttons.secondary} onClick={onExit}>
          Menu
        </button>
      </div>
    </Dialog>
  );
}
