import { useState } from 'react';

import { Game } from './components/Game';
import { Menu } from './components/Menu';
import { loadSettings, recordWin, saveSettings, type Settings } from './settings';

export function App() {
  const [settings, setSettings] = useState(loadSettings);
  // A new seed (and key) per game, so "Play again" starts fresh.
  const [game, setGame] = useState<{ seed: number } | null>(null);

  const update = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };
  const start = () => {
    setGame({ seed: Math.floor(Math.random() * 2 ** 31) });
  };

  if (!game) {
    return (
      <Menu
        settings={settings}
        onDifficulty={(difficulty) => {
          update({ ...settings, difficulty });
        }}
        onSound={(sound) => {
          update({ ...settings, sound });
        }}
        onPlay={start}
      />
    );
  }

  return (
    <Game
      key={game.seed}
      difficulty={settings.difficulty}
      seed={game.seed}
      sound={settings.sound}
      best={settings.best[settings.difficulty]}
      onSound={(sound) => {
        update({ ...settings, sound });
      }}
      onFinish={(won, seconds) => {
        if (won) update(recordWin(settings, settings.difficulty, seconds));
      }}
      onRestart={start}
      onExit={() => {
        setGame(null);
      }}
    />
  );
}
