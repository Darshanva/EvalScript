import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Avatar, Toast } from './ui';
import type { PageRoute } from '../types';

interface NavItem {
  key: PageRoute;
  label: string;
  icon: string;
}

const STUDENT_NAV: NavItem[] = [
  { key: 's-dashboard', label: 'Dashboard', icon: '⊞' },
  { key: 's-calibration', label: 'Calibration', icon: '✎' },
  { key: 's-submit', label: 'Submit Exam', icon: '↑' },
  { key: 's-results', label: 'My Results', icon: '◉' },
  { key: 's-disputes', label: 'Disputes', icon: '⚡' },
];

const FACULTY_NAV: NavItem[] = [
  { key: 'f-dashboard', label: 'Dashboard', icon: '⊞' },
  { key: 'f-create-exam', label: 'Create Exam', icon: '+' },
  { key: 'f-reviews', label: 'Pending Reviews', icon: '◎' },
  { key: 'f-results', label: 'Published Results', icon: '◉' },
  { key: 'f-disputes', label: 'Disputes', icon: '⚡' },
];

const ADMIN_NAV: NavItem[] = [
  { key: 'a-dashboard', label: 'Dashboard', icon: '⊞' },
  { key: 'a-users', label: 'Users', icon: '⋯' },
  { key: 'a-usage', label: 'AI Usage', icon: '≋' },
  { key: 'a-audit', label: 'Audit Logs', icon: '☰' },
  { key: 'a-groq', label: 'Groq Setup', icon: '⚡' },
  { key: 'a-settings', label: 'Settings', icon: '⚙' },
];

function getNavItems(role: string): NavItem[] {
  if (role === 'student') return STUDENT_NAV;
  if (role === 'faculty') return FACULTY_NAV;
  return ADMIN_NAV;
}

function getRoleLabel(role: string): string {
  if (role === 'student') return 'Student Portal';
  if (role === 'faculty') return 'Faculty Portal';
  return 'Admin Console';
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, navigate, logout, clearToast } = useApp();
  const { currentUser, page, toast } = state;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!currentUser) return null;

  const navItems = getNavItems(currentUser.role);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-60 bg-navy-950 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              E
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">EvalScript</p>
              <p className="text-white/40 text-xs">{getRoleLabel(currentUser.role)}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = page === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => {
                      navigate(item.key);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="text-base w-5 text-center shrink-0">{item.icon}</span>
                    {item.label}
                    {item.key === 'f-reviews' && <PendingBadge />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar initials={currentUser.avatarInitials} size="sm" color="gold" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-white/40 text-xs truncate">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 text-xs transition-colors"
          >
            <span>⎋</span> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:ml-60">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600"
          >
            ☰
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
              <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
            </div>
            <Avatar initials={currentUser.avatarInitials} color="navy" />
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={clearToast} />}
    </div>
  );
}

function PendingBadge() {
  const { getPendingReviewsForFaculty } = useApp();
  const count = getPendingReviewsForFaculty().length;
  if (count === 0) return null;
  return (
    <span className="ml-auto bg-gold-500 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full">
      {count}
    </span>
  );
}

export function PageContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`max-w-6xl mx-auto px-4 lg:px-8 py-8 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  action,
  showBack = true,
  backTo,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  action?: React.ReactNode;
  showBack?: boolean;
  backTo?: PageRoute;
}) {
  const { navigate, state } = useApp();

  function handleBack() {
    if (backTo) {
      navigate(backTo);
      return;
    }
    if (state.currentUser?.role === 'student') navigate('s-dashboard');
    else if (state.currentUser?.role === 'faculty') navigate('f-dashboard');
    else if (state.currentUser?.role === 'admin') navigate('a-dashboard');
    else navigate('landing');
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="flex items-start gap-3">
        {showBack && state.currentUser && (
          <button
            onClick={handleBack}
            className="mt-1 w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
            title="Go back"
          >
            ←
          </button>
        )}
        <div>
          {breadcrumb && (
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              {breadcrumb}
            </p>
          )}
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}