import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { LogOut, Menu, User, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth';
import api from '../api';
import { PortalRouteAccess } from '../components/PortalRouteAccess';
import {
  navSections,
  canShowNavItem,
  canShowNavGroup,
  isNavGroup,
  type NavGroup,
  type NavItem,
} from './navConfig';
import PasswordChangeGate from '../components/PasswordChangeGate';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { useSessionMaxLogout } from '../hooks/useSessionMaxLogout';

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function SidebarNavLink({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
          isActive
            ? 'bg-white font-medium text-sky-800 shadow-sm'
            : 'text-sky-50 hover:bg-white/10'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function SidebarNavGroup({
  group,
  onNavigate,
  childActive,
  expanded,
  onToggle,
}: {
  group: NavGroup;
  onNavigate: () => void;
  childActive: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = group.icon;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
          childActive
            ? 'bg-white/15 font-medium text-white'
            : 'text-sky-50 hover:bg-white/10'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <span className="flex-1 truncate">{group.label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 opacity-80 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-white/20 ml-5 pl-2">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-white font-medium text-sky-800 shadow-sm'
                    : 'text-sky-50 hover:bg-white/10'
                }`
              }
            >
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Shell() {
  const { auth, has, setAuth } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const logout = useCallback(async (reason?: 'timeout' | 'expired') => {
    try {
      await api.post('/api/logout');
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem('bells_token');
    setAuth(null);
    const query = reason === 'timeout' ? '?timeout=1' : reason === 'expired' ? '?expired=1' : '';
    nav(`/login${query}`);
  }, [nav, setAuth]);

  useInactivityLogout(() => {
    void logout('timeout');
  });
  useSessionMaxLogout(() => {
    void logout('expired');
  });

  const roleLabel = auth?.roles?.map((r) => r.name).join(', ') || 'Staff';

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    for (const section of navSections) {
      for (const entry of section.items) {
        if (!isNavGroup(entry)) continue;
        const childActive = entry.items.some((item) => location.pathname.startsWith(item.to));
        if (childActive) {
          setExpandedGroupKey(entry.key);
          return;
        }
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  const userMenuItems = useMemo<MenuProps['items']>(() => [
    {
      key: 'info',
      disabled: true,
      label: (
        <div className="py-0.5">
          <div className="font-medium text-slate-800">{auth?.user?.name}</div>
          <div className="text-xs text-slate-500">{auth?.user?.email}</div>
          {auth?.user?.phone && <div className="text-xs text-slate-500">{auth.user.phone}</div>}
          <div className="text-xs text-slate-400 mt-0.5">{roleLabel}</div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <User className="h-4 w-4" aria-hidden />,
      label: <Link to="/profile">Profile</Link>,
    },
    {
      key: 'logout',
      icon: <LogOut className="h-4 w-4" aria-hidden />,
      label: 'Sign out',
      danger: true,
      onClick: () => {
        void logout();
      },
    },
  ], [auth?.user?.email, auth?.user?.name, auth?.user?.phone, logout, roleLabel]);

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex bg-slate-50">
      <PasswordChangeGate />
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(280px,85vw)] flex-col bg-gradient-to-b from-sky-600 to-sky-800 text-white shadow-xl transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-screen lg:w-[280px] lg:shrink-0 lg:translate-x-0 lg:overflow-hidden lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none lg:pointer-events-auto lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/15 p-4 lg:p-5">
          <Link
            to="/"
            onClick={closeSidebar}
            className="flex min-w-0 flex-1 items-center gap-3 hover:bg-white/5 rounded-lg transition-colors -m-1 p-1"
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Bells crest"
              className="h-10 w-10 shrink-0 rounded-full bg-white ring-2 ring-white/30 lg:h-11 lg:w-11"
            />
            <div className="min-w-0">
              <div className="truncate font-semibold leading-tight">Bells University</div>
              <div className="text-xs text-sky-100/90">Staff portal</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={closeSidebar}
            className="ml-2 rounded-lg p-2 text-sky-50 hover:bg-white/10 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-5 overflow-y-auto p-3 text-sm">
          {navSections.map((section) => {
            const entries = section.items.filter((entry) =>
              isNavGroup(entry)
                ? canShowNavGroup(entry, has, auth?.nav_unrestricted, auth?.nav_link_keys)
                : canShowNavItem(entry, has, auth?.nav_unrestricted, auth?.nav_link_keys),
            );
            if (!entries.length) return null;
            const hideTitle =
              entries.length === 1 && isNavGroup(entries[0]) && entries[0].label === section.title;
            return (
              <div key={section.title || entries[0]?.key}>
                {!hideTitle && (
                  <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sky-200/80">
                    {section.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {entries.map((entry) => {
                    if (isNavGroup(entry)) {
                      const visibleItems = entry.items.filter((item) =>
                        canShowNavItem(item, has, auth?.nav_unrestricted, auth?.nav_link_keys),
                      );
                      if (!visibleItems.length) return null;
                      const childActive = visibleItems.some((item) => location.pathname.startsWith(item.to));
                      const expanded = expandedGroupKey === entry.key;
                      return (
                        <SidebarNavGroup
                          key={entry.key}
                          group={{ ...entry, items: visibleItems }}
                          onNavigate={closeSidebar}
                          childActive={childActive}
                          expanded={expanded}
                          onToggle={() =>
                            setExpandedGroupKey((current) => (current === entry.key ? null : entry.key))
                          }
                        />
                      );
                    }
                    return <SidebarNavLink key={entry.to} item={entry} onNavigate={closeSidebar} />;
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/15 p-4 text-xs italic text-sky-100/80">
          Chords of Knowledge
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen lg:overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:h-16 sm:gap-3 sm:px-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-sky-200 hover:text-sky-700 lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-800 sm:text-base">
                <span className="sm:hidden">Bells University</span>
                <span className="hidden sm:inline">Bells University of Technology</span>
              </div>
              <div className="truncate text-xs text-slate-500">{roleLabel}</div>
            </div>
          </div>
          <div className="shrink-0">
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 ring-2 ring-sky-200 transition-colors hover:bg-sky-200/80"
                aria-label="Account menu"
              >
                {initials(auth?.user?.name)}
              </button>
            </Dropdown>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <PortalRouteAccess>
            <Outlet />
          </PortalRouteAccess>
        </main>
      </div>
    </div>
  );
}
