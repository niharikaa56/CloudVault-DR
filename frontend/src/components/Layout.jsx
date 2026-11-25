import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  HardDrive,
  ShieldAlert,
  History,
  Trash2,
  Settings,
  LogOut,
  Menu,
  X,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'My Files', to: '/files', icon: FolderOpen },
  { label: 'Backup Management', to: '/backups', icon: HardDrive },
  { label: 'Disaster Recovery', to: '/recovery', icon: ShieldAlert },
  { label: 'Recovery History', to: '/history', icon: History },
  { label: 'Recycle Bin', to: '/trash', icon: Trash2 },
  { label: 'Settings', to: '/settings', icon: Settings },
];

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/files': 'My Files',
  '/backups': 'Backup Management',
  '/recovery': 'Disaster Recovery',
  '/history': 'Recovery History',
  '/trash': 'Recycle Bin',
  '/settings': 'Settings',
};

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentTitle = PAGE_TITLES[location.pathname] || 'CloudVault DR';

  function handleLogout() {
    logout();
    navigate('/auth', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-150 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              CloudVault DR
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary Sidebar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
              <span className="hidden sm:inline whitespace-nowrap">CloudVault</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h1 className="font-display text-base sm:text-lg font-semibold text-slate-900 truncate">
                {currentTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-900">{user?.name}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-500">{user?.email}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/files')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Files</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
