import styles from './Buttons.module.css';
import { Dialog } from './Dialog';

interface PauseDialogProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export function PauseDialog({ onResume, onRestart, onExit }: PauseDialogProps) {
  return (
    <Dialog title="Paused" onCancel={onResume}>
      <div className={styles.stack}>
        <button type="button" className={styles.primary} onClick={onResume}>
          Resume
        </button>
        <button type="button" className={styles.secondary} onClick={onRestart}>
          Restart
        </button>
        <button type="button" className={styles.secondary} onClick={onExit}>
          Quit to menu
        </button>
      </div>
      <p className={styles.keys}>
        Keys: <kbd>1</kbd>–<kbd>3</kbd> train, <kbd>4</kbd> turret, <kbd>5</kbd> slot, <kbd>6</kbd>{' '}
        special, <kbd>7</kbd> advance, <kbd>F</kbd> speed, <kbd>M</kbd> sound, <kbd>←</kbd>{' '}
        <kbd>→</kbd> look around.
      </p>
    </Dialog>
  );
}
