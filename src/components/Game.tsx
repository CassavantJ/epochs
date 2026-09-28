import { FastForward, Pause, Volume2, VolumeX } from 'lucide-react';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from 'react';

import { DIFFICULTIES, type DifficultyId } from '../game/ai';
import { EpochsGame } from '../game/controller';
import { era } from '../game/data';
import { Backdrop, renderFrame, renderMinimap } from '../game/render';
import { WORLD } from '../game/sim';
import { createView, type View } from '../game/view';
import { formatTime } from '../settings';
import { useReducedMotion } from '../useReducedMotion';
import { ActionBar } from './ActionBar';
import { EndDialog } from './EndDialog';
import styles from './Game.module.css';
import { PauseDialog } from './PauseDialog';

interface GameProps {
  difficulty: DifficultyId;
  seed: number;
  sound: boolean;
  /** Fastest win so far on this difficulty. */
  best: number | undefined;
  onSound: (enabled: boolean) => void;
  onFinish: (won: boolean, seconds: number) => void;
  onRestart: () => void;
  onExit: () => void;
}

const PAN_KEYS_PER_S = 700;

export function Game({
  difficulty,
  seed,
  sound,
  best,
  onSound,
  onFinish,
  onRestart,
  onExit,
}: GameProps) {
  const [game] = useState(() => new EpochsGame({ difficulty, seed, sound }));
  // The best time as it stood when this game began; a win updates the saved one right away.
  const [previousBest] = useState(best);
  const hud = useSyncExternalStore(game.subscribe, game.getSnapshot);
  const reducedMotion = useReducedMotion();
  const [message, setMessage] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const minimapSize = useRef({ width: 1, height: 1 });
  const [view, setView] = useState<View | null>(null);
  const panKeys = useRef(0);

  // Development only: lets automated checks drive the game from the console.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as Window & { epochs?: EpochsGame }).epochs = game;
  }, [game]);

  useEffect(() => {
    game.setAnnouncer(setMessage);
    return () => {
      game.dispose();
    };
  }, [game]);

  useEffect(() => {
    game.setReducedMotion(reducedMotion);
  }, [game, reducedMotion]);

  // Report the result once.
  const finish = useEffectEvent(() => {
    onFinish(hud.winner === 0, hud.time);
  });
  const over = hud.winner !== null;
  useEffect(() => {
    if (over) finish();
  }, [over]);

  // Pause while the tab is hidden.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && !game.over) game.setPaused(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [game]);

  // Canvas sizes follow their boxes.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const minimap = minimapRef.current;
    if (!stage || !canvas || !minimap) return;
    const observer = new ResizeObserver(() => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const box = stage.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(box.width * ratio));
      canvas.height = Math.max(1, Math.round(box.height * ratio));
      size.current = { width: box.width, height: box.height, ratio };
      const next = createView(box.width, box.height);
      game.setView(next);
      setView(next);
      const mini = minimap.getBoundingClientRect();
      minimap.width = Math.max(1, Math.round(mini.width * ratio));
      minimap.height = Math.max(1, Math.round(mini.height * ratio));
      minimapSize.current = { width: mini.width, height: mini.height };
    });
    observer.observe(stage);
    observer.observe(minimap);
    return () => {
      observer.disconnect();
    };
  }, [game]);

  // Gamepad: D-pad moves between command buttons, A presses, Start or B pauses, bumpers pan.
  const padDown = useRef<boolean[]>([]);
  const pollGamepad = useEffectEvent((seconds: number) => {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = pads.find((candidate) => candidate?.connected);
    if (!pad) return;
    const pressed = pad.buttons.map((button) => button.pressed);
    const edge = (index: number) => (pressed[index] ?? false) && !(padDown.current[index] ?? false);
    padDown.current = pressed;
    if (edge(9) || edge(1)) game.setPaused(!game.paused);
    if (game.paused || game.over) return;
    const actions = [...document.querySelectorAll<HTMLElement>('[data-action]')];
    const current = actions.indexOf(document.activeElement as HTMLElement);
    const move = (by: number) => {
      const next = actions[(Math.max(current, 0) + by + actions.length) % actions.length];
      next?.focus();
    };
    if (edge(15)) move(current === -1 ? 0 : 1);
    if (edge(14)) move(current === -1 ? 0 : -1);
    if (edge(0)) {
      if (current === -1) actions[0]?.focus();
      else actions[current]?.click();
    }
    const pan = (pressed[5] ? 1 : 0) - (pressed[4] ? 1 : 0);
    if (pan !== 0) game.panTo(game.camera + pan * PAN_KEYS_PER_S * seconds);
  });

  // The frame loop.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    const mini = minimapRef.current?.getContext('2d');
    if (!ctx || !mini) return;
    const backdrop = new Backdrop();
    let last = performance.now();
    let frame = 0;
    const loop = (now: number) => {
      const seconds = (now - last) / 1000;
      last = now;
      pollGamepad(seconds);
      if (panKeys.current !== 0)
        game.panTo(game.camera + panKeys.current * PAN_KEYS_PER_S * seconds);
      game.frame(seconds);
      const current = game.view;
      if (current) {
        const { width, height, ratio } = size.current;
        renderFrame(ctx, game.state, game.visuals, backdrop, {
          view: current,
          camera: game.camera,
          ratio,
          width,
          height,
        });
        renderMinimap(mini, game.state, {
          view: current,
          camera: game.camera,
          ratio,
          width: minimapSize.current.width,
          height: minimapSize.current.height,
        });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [game]);

  const toggleSound = () => {
    const next = !game.audio.enabled;
    game.setSound(next);
    onSound(next);
  };

  // Keyboard.
  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      panKeys.current = down ? direction : panKeys.current === direction ? 0 : panKeys.current;
      if (view?.pans) event.preventDefault();
      return;
    }
    if (!down || event.repeat || game.over) return;
    if (document.querySelector('dialog[open]')) return;
    const target = event.target instanceof Element ? event.target : null;
    const onControl = target?.closest('button, a, input, select') != null;
    const commands: Record<string, () => void> = {
      '1': () => game.train('melee'),
      '2': () => game.train('ranged'),
      '3': () => game.train('heavy'),
      '4': () => game.turret(),
      '5': () => game.slot(),
      '6': () => game.special(),
      '7': () => game.advance(),
      f: () => {
        game.toggleSpeed();
      },
      m: () => {
        toggleSound();
      },
      p: () => {
        game.setPaused(true);
      },
      Escape: () => {
        game.setPaused(true);
      },
      ' ': () => {
        if (!onControl) game.setPaused(true);
      },
    };
    const command = commands[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (!command || game.paused) return;
    event.preventDefault();
    command();
  });
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      onKey(event, true);
    };
    const up = (event: KeyboardEvent) => {
      onKey(event, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Dragging the battlefield or the minimap pans.
  const drag = useRef<{ pointer: number; x: number; camera: number } | null>(null);
  const stageDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!view?.pans || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, camera: game.camera };
  };
  const stageMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    if (current?.pointer !== event.pointerId || !view) return;
    game.panTo(current.camera - (event.clientX - current.x) / view.scale);
  };
  const minimapPan = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!view?.pans || (event.type === 'pointermove' && event.buttons === 0)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WORLD.width;
    game.panTo(x - view.span / 2);
  };

  const [you, enemy] = [0, 1] as const;
  const health = (team: 0 | 1) => hud.base[team] / hud.baseMax[team];

  return (
    <main className={styles.game}>
      <h1 className="sr-only">Epochs: {DIFFICULTIES[difficulty].name} battle</h1>
      <header className={styles.top}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => {
            game.setPaused(true);
          }}
        >
          <Pause aria-hidden="true" className={styles.icon} />
          <span className="sr-only">Pause</span>
        </button>
        <Meter label="Your base" era={era(hud.era).name} share={health(you)} team={you} />
        <p className={styles.clock} data-phase={hud.phase}>
          <span className="sr-only">Time </span>
          {formatTime(hud.time)}
          {hud.phase !== 'normal' && (
            <span className={styles.phase}>
              {hud.phase === 'overtime' ? 'Overtime' : 'Sudden death'}
            </span>
          )}
        </p>
        <Meter label="Enemy base" era={era(hud.enemyEra).name} share={health(enemy)} team={enemy} />
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={hud.speed === 2}
          onClick={() => {
            game.toggleSpeed();
          }}
        >
          <FastForward aria-hidden="true" className={styles.icon} />
          <span className="sr-only">Double speed</span>
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={hud.sound}
          onClick={toggleSound}
        >
          {hud.sound ? (
            <Volume2 aria-hidden="true" className={styles.icon} />
          ) : (
            <VolumeX aria-hidden="true" className={styles.icon} />
          )}
          <span className="sr-only">Sound</span>
        </button>
      </header>

      <div ref={stageRef} className={styles.stage} role="img" aria-label="The battlefield">
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          data-pans={view?.pans}
          onPointerDown={stageDown}
          onPointerMove={stageMove}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        />
      </div>

      <p className={styles.turnHint} aria-hidden="true">
        Turn your phone sideways to see more of the battlefield.
      </p>

      <canvas
        ref={minimapRef}
        className={styles.minimap}
        aria-hidden="true"
        onPointerDown={minimapPan}
        onPointerMove={minimapPan}
      />

      <ActionBar game={game} hud={hud} />

      <p role="status" className={styles.announcer}>
        {message}
      </p>

      {hud.paused && !over && (
        <PauseDialog
          onResume={() => {
            game.setPaused(false);
          }}
          onRestart={onRestart}
          onExit={onExit}
        />
      )}
      {over && (
        <EndDialog
          won={hud.winner === 0}
          seconds={hud.time}
          difficulty={difficulty}
          best={previousBest}
          stats={game.state.sides[0].stats}
          era={hud.era}
          onRestart={onRestart}
          onExit={onExit}
        />
      )}
    </main>
  );
}

function Meter({
  label,
  era: name,
  share,
  team,
}: {
  label: string;
  era: string;
  share: number;
  team: 0 | 1;
}) {
  return (
    <div className={styles.meter} data-team={team}>
      <span className={styles.meterLabel}>
        {label} <span className={styles.meterEra}>· {name}</span>
      </span>
      <span
        className={styles.meterBar}
        role="meter"
        aria-label={`${label} health`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        style={{ '--fill': Math.max(0, share) } as CSSProperties}
      />
    </div>
  );
}
