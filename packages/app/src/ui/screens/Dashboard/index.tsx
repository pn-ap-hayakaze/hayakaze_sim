import { useState } from 'react';
import { isSeasonOver } from '@hayakaze/engine';
import { advanceDay, advanceToEnd, save } from '../../../app/session.js';
import { useAppStore } from '../../../app/store.js';
import { Button } from '../../components/Button.js';
import { ProgressBar } from '../../components/ProgressBar.js';
import { fmtDay } from '../../format/index.js';
import { dashboard } from '../../strings/dashboard.js';

export function Dashboard() {
  const { season, todayResults, running, error } = useAppStore();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  if (!season) return <p className="text-neutral-600">{dashboard.noSeason}</p>;
  const over = isSeasonOver(season);
  const clubName = (id: string) => season.clubs.get(id)?.shortName ?? id;

  const doSave = async () => {
    await save();
    setSavedAt(Date.now());
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">
          {dashboard.todayGames}（{fmtDay(season.currentDay - 1)}）
        </h2>
        {todayResults.length === 0 ? (
          <p className="text-neutral-600">{over ? dashboard.seasonOver : dashboard.noGames}</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-200 rounded border border-neutral-200 bg-white">
            {todayResults.map((r, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2 tabular-nums">
                <span className="w-16">{clubName(r.awayClubId)}</span>
                <span className="w-6 text-right">{r.awayScore}</span>
                <span>–</span>
                <span className="w-6">{r.homeScore}</span>
                <span className="w-16">{clubName(r.homeClubId)}</span>
                <span className="text-xs text-neutral-500">
                  {r.innings !== 9 ? dashboard.innings(r.innings) : ''}
                  {r.tie ? ` ${dashboard.tie}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {running && (
        <ProgressBar
          value={running.day}
          max={running.lastDay}
          label={dashboard.running(running.day, running.lastDay)}
        />
      )}
      {error && <p className="text-poor">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button primary onClick={advanceDay} disabled={!!running || over}>
          {dashboard.advanceDay}
        </Button>
        <Button onClick={() => void advanceToEnd()} disabled={!!running || over}>
          {dashboard.advanceToEnd}
        </Button>
        <Button onClick={() => void doSave()} disabled={!!running}>
          {dashboard.save}
        </Button>
        {savedAt && <span className="self-center text-sm text-good">{dashboard.saved}</span>}
      </div>
    </div>
  );
}
