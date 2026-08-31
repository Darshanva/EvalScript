import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Toast } from './ui';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const STUDENT_NAV: NavItem[] = [
  { path: '/student', label: 'Dashboard', icon: '⊞' },
  { path: '/student/calibration', label: 'Calibration', icon: '✎' },
  { path: '/student/submit', label: 'Submit Exam', icon: '↑' },
  { path: '/student/results', label: 'My Results', icon: '◉' },
  { path: '/student/disputes', label: 'Disputes', icon: '⚡' },
];

const FACULTY_NAV: NavItem[] = [
  { path: '/faculty', label: 'Dashboard', icon: '⊞' },
  { path: '/faculty/create-exam', label: 'Create Exam', icon: '+' },
  { path: '/faculty/reviews', label: 'Pending Reviews', icon: '◎' },
  { path: '/faculty/results', label: 'Published Results', icon: '◉' },
  { path: '/faculty/disputes', label: 'Disputes', icon: '⚡' },
];

const ADMIN_NAV: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: '⊞' },
  { path: '/admin/users', label: 'Users', icon: '⋯' },
  { path: '/admin/structure', label: 'Exam Structure', icon: '▤' },
  { path: '/admin/usage', label: 'AI Usage', icon: '≋' },
  { path: '/admin/audit', label: 'Audit Logs', icon: '☰' },
  { path: '/admin/groq', label: 'Claude Setup', icon: '⚡' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙' },
  { path: '/admin/publish-rights', label: 'Publish Rights', icon: '☑' },
];

const HOD_NAV: NavItem[] = [
  { path: '/hod', label: 'Dashboard', icon: '⊞' },
  { path: '/hod/students', label: 'Students', icon: '⋯' },
  { path: '/hod/faculty', label: 'Faculty', icon: '◎' }, // NEW
  { path: '/hod/structure', label: 'Structure', icon: '▤' },
  { path: '/hod/analytics', label: 'Analytics', icon: '≋' },
];

function getNavItems(role: string): NavItem[] {
  if (role === 'student') return STUDENT_NAV;
  if (role === 'faculty') return FACULTY_NAV;
  if (role === 'hod') return HOD_NAV;
  return ADMIN_NAV;
}

function getRoleLabel(role: string): string {
  if (role === 'student') return 'Student';
  if (role === 'faculty') return 'Faculty';
  return 'Admin';
}

function getPortalLabel(role: string): string {
  if (role === 'student') return 'Student Portal';
  if (role === 'faculty') return 'Faculty Portal';
  return 'Admin Console';
}

/** Main shell — App.tsx imports this as AppLayout */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { state, logout, clearToast } = useApp();
  const { currentUser, toast } = state;
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!currentUser) return <>{children}</>;

  const nav = getNavItems(currentUser.role);

  const isActive = (path: string) => {
    if (path === '/admin' || path === '/faculty' || path === '/student') {
      return location.pathname === path;
    }
    return (
      location.pathname === path || location.pathname.startsWith(path + '/')
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-navy-950 text-white flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-500 text-navy-950 font-bold flex items-center justify-center">
            E
          </div>
          <div>
            <p className="font-semibold text-sm">EvalScript</p>
            <p className="text-[10px] text-white/50">
              {getPortalLabel(currentUser.role)}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(item.path)
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gold-500/20 text-gold-400 text-xs font-semibold flex items-center justify-center">
              {currentUser.avatarInitials ||
                currentUser.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-[10px] text-white/40 truncate">
                {currentUser.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="text-xs text-white/50 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 lg:pl-60 min-h-screen flex flex-col">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200 px-4 h-14 flex items-center justify-between lg:px-8">
          <button
            type="button"
            className="lg:hidden p-2 text-slate-600"
            onClick={() => setMobileOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="hidden sm:inline">{currentUser.name}</span>
            <span className="text-xs text-slate-400">
              {getRoleLabel(currentUser.role)}
            </span>
            <div className="w-8 h-8 rounded-full bg-navy-100 text-navy-800 text-xs font-semibold flex items-center justify-center">
              {currentUser.avatarInitials || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={clearToast}
        />
      )}
    </div>
  );
}

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  action,
  showBack,
  backTo,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  action?: React.ReactNode;
  showBack?: boolean;
  backTo?: string;
}) {
  const navigate = useNavigate();
  const { state } = useApp();

  function handleBack() {
    if (backTo) {
      navigate(backTo);
      return;
    }
    if (state.currentUser?.role === 'student') navigate('/student');
    else if (state.currentUser?.role === 'faculty') navigate('/faculty');
    else if (state.currentUser?.role === 'admin') navigate('/admin');
    else navigate('/');
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="flex items-start gap-3">
        {showBack && state.currentUser && (
          <button
            type="button"
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
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}