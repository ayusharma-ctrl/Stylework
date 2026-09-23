import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Moon,
  Settings2,
  Sun,
  UsersRound,
  X,
} from 'lucide-react';
import { api, clearSession, json, queryClient } from '../lib/api';
import { leadsOptions, meOptions } from '../lib/queries';
import { usePreferences } from '../lib/store';
import { useDashboardStream } from '../lib/dashboard';
import { initials } from '../lib/utils';
import { Button } from './ui/button';
import { ErrorState, Loading } from './feedback';
const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: UsersRound },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];
export function ThemeSync() {
  const theme = usePreferences((s) => s.theme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle(
        'dark',
        theme === 'dark' || (theme === 'system' && media.matches),
      );
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return null;
}
export default function Shell() {
  const profile = useQuery(meOptions),
    connection = useDashboardStream(),
    location = useLocation(),
    [mobile, setMobile] = useState(false),
    [logoutError, setLogoutError] = useState<Error | null>(null);
  const { theme, setTheme } = usePreferences();
  useEffect(() => {
    if (profile.data) void queryClient.prefetchInfiniteQuery(leadsOptions());
  }, [profile.data?.user.id]);
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  if (profile.isPending) return <Loading />;
  if (profile.error)
    return (
      <div className="p-8">
        <ErrorState error={profile.error} retry={() => void profile.refetch()} />
      </div>
    );
  const user = profile.data.user,
    title =
      navigation.find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)))
        ?.label || 'Workspace';
  async function signout() {
    try {
      await api('/signout', { method: 'POST', body: '{}' });
      clearSession();
    } catch (error) {
      setLogoutError(error as Error);
    }
  }
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    void api('/me', { method: 'PATCH', body: json({ theme: next }) }).catch(() => {});
  }
  return (
    <div className="workspace">
      {mobile && (
        <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobile(false)} />
      )}
      <aside className={'sidebar ' + (mobile ? 'is-open' : '')}>
        <NavLink to="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          stylework<span className="brand-dot">.</span>
        </NavLink>
        <div className="workspace-switch">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>Stylework workspace</strong>
            <small>Shared workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
            >
              <Icon size={19} />
              {label}
              {label === 'Leads' && <span className="nav-tag">CRM</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              All together, in one place
            </span>
            <p>New leads and every next step. Keep your team moving in the same direction.</p>
            <NavLink to="/leads">
              Explore your pipeline
              <ArrowUpRight size={15} />
            </NavLink>
          </div>
          <div className="user-box">
            <span className="avatar">{initials(user.email)}</span>
            <div className="min-w-0 flex-1">
              <strong className="block truncate">{user.email.split('@')[0]}</strong>
              <small className="block truncate">{user.email}</small>
            </div>
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signout()}>
              <LogOut size={17} />
            </Button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label={mobile ? 'Close menu' : 'Open menu'}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-border">/</span>
            <strong>{title}</strong>
          </div>
          <div className="flex items-center gap-4">
            <span className={'connection ' + (connection === 'live' ? 'online' : '')} role="status">
              <span />
              {connection === 'live'
                ? 'Live updates'
                : connection === 'connecting'
                  ? 'Connecting'
                  : 'Reconnecting'}
            </span>
            <span className="topbar-divider" />
            <Button variant="ghost" size="icon" aria-label="Toggle color theme" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
            <span className="avatar small">{initials(user.email)}</span>
          </div>
        </header>
        <main id="main-content" className="page-content">
          {logoutError && <ErrorState error={logoutError} />}
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>Stylework lead workspace</span>
          <span>Thoughtfully connected.</span>
        </footer>
      </div>
    </div>
  );
}
