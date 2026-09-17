import { HashRouter, Link, NavLink, Route, Routes } from 'react-router';
import { useAppStore } from '../app/store.js';
import { Dashboard } from './screens/Dashboard/index.js';
import { Standings } from './screens/Standings/index.js';
import { Title } from './screens/Title/index.js';
import { fmtDay } from './format/index.js';
import { shell } from './strings/shell.js';

function Shell({ children }: { children: React.ReactNode }) {
  // season は in-place で変わるので revision も購読して再描画させる
  const { season } = useAppStore();
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-2 py-1 rounded ${isActive ? 'bg-neutral-200 font-semibold' : 'hover:bg-neutral-100'}`;
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-4 border-b border-neutral-300 bg-white px-4 py-2">
        <Link to="/" className="font-bold">
          {shell.appName}
        </Link>
        {season && (
          <span className="text-sm text-neutral-600 tabular-nums">
            {shell.year(season.year)} {fmtDay(season.currentDay)} {shell.phase}
          </span>
        )}
        <nav className="ml-auto flex gap-1 text-sm">
          <NavLink to="/dashboard" className={navClass}>
            {shell.nav.dashboard}
          </NavLink>
          <NavLink to="/standings" className={navClass}>
            {shell.nav.standings}
          </NavLink>
          <NavLink to="/" end className={navClass}>
            {shell.nav.title}
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Title />} />
        <Route
          path="/dashboard"
          element={
            <Shell>
              <Dashboard />
            </Shell>
          }
        />
        <Route
          path="/standings"
          element={
            <Shell>
              <Standings />
            </Shell>
          }
        />
      </Routes>
    </HashRouter>
  );
}
