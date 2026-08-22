import type { PageRoute } from '../types';

/** Old page keys → real React Router paths */
export const ROUTE_MAP: Record<string, string> = {
  landing: '/',
  auth: '/login',
  's-dashboard': '/student',
  's-calibration': '/student/calibration',
  's-submit': '/student/submit',
  's-results': '/student/results',
  's-disputes': '/student/disputes',
  'f-dashboard': '/faculty',
  'f-create-exam': '/faculty/create-exam',
  'f-reviews': '/faculty/reviews',
  'f-review': '/faculty/review',
  'f-results': '/faculty/results',
  'f-disputes': '/faculty/disputes',
  'a-dashboard': '/admin',
  'a-users': '/admin/users',
  'a-usage': '/admin/usage',
  'a-audit': '/admin/audit',
  'a-settings': '/admin/settings',
  'a-groq': '/admin/groq',
};

export function toPath(pageOrPath: string): string {
  if (pageOrPath.startsWith('/')) return pageOrPath;
  return ROUTE_MAP[pageOrPath] || '/';
}

export function roleHome(role: string): string {
  if (role === 'student') return '/student';
  if (role === 'faculty') return '/faculty';
  if (role === 'admin') return '/admin';
  return '/';
}