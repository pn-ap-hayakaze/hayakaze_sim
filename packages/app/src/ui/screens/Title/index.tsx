import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { load, newGame, refreshHasSave } from '../../../app/session.js';
import { useAppStore } from '../../../app/store.js';
import { Button } from '../../components/Button.js';
import { title } from '../../strings/title.js';

export function Title() {
  const navigate = useNavigate();
  const { hasSave } = useAppStore();
  const [seed, setSeed] = useState('20260915');

  useEffect(() => {
    void refreshHasSave();
  }, []);

  const start = () => {
    newGame(Number(seed) || 20260915);
    navigate('/dashboard');
  };
  const doLoad = async () => {
    if (await load()) navigate('/dashboard');
  };

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-3xl font-bold">{title.heading}</h1>
      <p className="mt-2 text-neutral-600">{title.subheading}</p>
      <label className="mt-8 block text-sm">
        {title.seedLabel}
        <input
          className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 tabular-nums"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <Button primary onClick={start}>
          {title.newGame}
        </Button>
        <Button onClick={doLoad} disabled={!hasSave} title={hasSave ? undefined : title.noSave}>
          {title.load}
        </Button>
      </div>
    </main>
  );
}
