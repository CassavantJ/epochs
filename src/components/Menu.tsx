import { Play, Volume2, VolumeX } from 'lucide-react';
import { useId } from 'react';

import { app } from '../app.config';
import { DIFFICULTIES, DIFFICULTY_IDS, type DifficultyId } from '../game/ai';
import { ERAS } from '../game/data';
import { formatTime, type Settings } from '../settings';
import styles from './Menu.module.css';
import { UnitIcon } from './UnitIcon';

interface MenuProps {
  settings: Settings;
  onDifficulty: (difficulty: DifficultyId) => void;
  onSound: (enabled: boolean) => void;
  onPlay: () => void;
}

export function Menu({ settings, onDifficulty, onSound, onPlay }: MenuProps) {
  const id = useId();
  return (
    <main className={styles.menu}>
      <header className={styles.intro}>
        <h1 className={styles.title}>{app.title}</h1>
        <p className={styles.tagline}>
          Hold the lane and take the enemy base. Train an army, earn gold and experience from every
          fight, and advance through five eras, from clubs to plasma, before they do.
        </p>
      </header>

      <ol className={styles.eras} aria-label="The five eras">
        {ERAS.map((entry) => (
          <li key={entry.id} className={styles.era}>
            <UnitIcon type={entry.units.melee} />
            <span>{entry.name}</span>
          </li>
        ))}
      </ol>

      <fieldset className={styles.difficulty}>
        <legend className={styles.heading}>Opponent</legend>
        <div className={styles.choices}>
          {DIFFICULTY_IDS.map((difficulty) => {
            const settingsFor = DIFFICULTIES[difficulty];
            const best = settings.best[difficulty];
            return (
              <label key={difficulty} className={styles.choice}>
                <input
                  type="radio"
                  name={`${id}-difficulty`}
                  value={difficulty}
                  checked={settings.difficulty === difficulty}
                  onChange={() => {
                    onDifficulty(difficulty);
                  }}
                />
                <span className={styles.card}>
                  <span className={styles.cardTitle}>{settingsFor.name}</span>
                  <span className={styles.cardText}>{settingsFor.description}</span>
                  <span className={styles.cardBest}>
                    {best === undefined ? 'Not beaten yet' : `Best win ${formatTime(best)}`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <button type="button" className={styles.play} onClick={onPlay}>
          <Play aria-hidden="true" className={styles.playIcon} />
          Play
        </button>
        <button
          type="button"
          className={styles.sound}
          aria-pressed={settings.sound}
          onClick={() => {
            onSound(!settings.sound);
          }}
        >
          {settings.sound ? (
            <Volume2 aria-hidden="true" className={styles.soundIcon} />
          ) : (
            <VolumeX aria-hidden="true" className={styles.soundIcon} />
          )}
          Sound
        </button>
      </div>

      <section className={styles.how} aria-labelledby={`${id}-how`}>
        <h2 id={`${id}-how`} className={styles.heading}>
          How to play
        </h2>
        <ul className={styles.tips}>
          <li>
            <strong>Train</strong> fighters, ranged units and heavies. They march on their own and
            fight whatever they meet.
          </li>
          <li>
            <strong>Earn</strong> gold over time and from every kill; experience comes from kills
            too. Spend experience to <strong>advance an era</strong>: new units are far stronger.
          </li>
          <li>
            <strong>Defend</strong> with turrets on your base (up to three), and call your era’s{' '}
            <strong>special</strong> when a big wave comes.
          </li>
          <li>
            After ten minutes, <strong>overtime</strong> makes every hit count for more; at
            eighteen, both bases start to crumble.
          </li>
        </ul>
        <p className={styles.controls}>
          Keys 1–7 match the buttons left to right. F doubles the speed, Space pauses. On a
          controller, the D-pad moves between buttons and A presses.
        </p>
      </section>
    </main>
  );
}
