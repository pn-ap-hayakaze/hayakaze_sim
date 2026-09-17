import { gamesBehind, standings, winPct, type ClubRecord } from '@hayakaze/engine';
import { useAppStore } from '../../../app/store.js';
import { DataTable, type Column } from '../../components/DataTable.js';
import { fmtGamesBehind, fmtRate } from '../../format/index.js';
import { dashboard } from '../../strings/dashboard.js';
import { standingsStrings as s } from '../../strings/standings.js';

interface Row {
  rank: number;
  record: ClubRecord;
  gb: number;
}

export function Standings() {
  const { season } = useAppStore();
  if (!season) return <p className="text-neutral-600">{dashboard.noSeason}</p>;

  const columns: Column<Row>[] = [
    { key: 'rank', header: s.columns.rank, numeric: true, render: (r) => r.rank },
    { key: 'club', header: s.columns.club, render: (r) => season.clubs.get(r.record.clubId)?.name },
    {
      key: 'games',
      header: s.columns.games,
      numeric: true,
      render: (r) => r.record.wins + r.record.losses + r.record.ties,
    },
    { key: 'wins', header: s.columns.wins, numeric: true, render: (r) => r.record.wins },
    { key: 'losses', header: s.columns.losses, numeric: true, render: (r) => r.record.losses },
    { key: 'ties', header: s.columns.ties, numeric: true, render: (r) => r.record.ties },
    {
      key: 'pct',
      header: s.columns.winPct,
      numeric: true,
      render: (r) => fmtRate(winPct(r.record)),
    },
    {
      key: 'gb',
      header: s.columns.gamesBehind,
      numeric: true,
      render: (r) => fmtGamesBehind(r.gb),
    },
    { key: 'rs', header: s.columns.runsScored, numeric: true, render: (r) => r.record.runsScored },
    {
      key: 'ra',
      header: s.columns.runsAllowed,
      numeric: true,
      render: (r) => r.record.runsAllowed,
    },
  ];

  return (
    <div className="space-y-8">
      {season.config.leagues.map((league) => {
        const table = standings(season, league.id);
        const rows: Row[] = table.map((record, i) => ({
          rank: i + 1,
          record,
          gb: gamesBehind(table[0], record),
        }));
        return (
          <DataTable
            key={league.id}
            caption={league.name}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.record.clubId}
          />
        );
      })}
    </div>
  );
}
