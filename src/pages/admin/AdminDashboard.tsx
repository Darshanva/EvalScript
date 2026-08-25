import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Card,
  StatCard,
  Button,
  StatusBadge,
  Table,
  TableRow,
  Td,
  ProgressBar,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function AdminDashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { users, exams, submissions, evaluations, aiUsage, systemSettings } = state;

  const students = (users || []).filter((u) => u.role === 'student');
  const faculty = (users || []).filter((u) => u.role === 'faculty');
  const published = (evaluations || []).filter((e) => e.status === 'PUBLISHED');
  const pending = (evaluations || []).filter(
    (e) => e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW'
  );

  const todayUsage = aiUsage?.[0] ?? {
    requestCount: 0,
    pageCount: 0,
    successCount: 0,
    failureCount: 0,
  };
  const maxDaily = systemSettings?.maxAiRequestsPerDay || 50;
  const dailyUsagePct = Math.round(((todayUsage.requestCount || 0) / maxDaily) * 100);
  const weeklyRequests = (aiUsage || [])
    .slice(0, 7)
    .reduce((sum, u) => sum + (u.requestCount || 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title="System Overview"
        subtitle="Live platform stats from Supabase (users, exams, submissions)."
        breadcrumb="Admin Console"
        showBack={false}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Students"
          value={students.length}
          icon={<span>◯</span>}
          accent="bg-navy-50 text-navy-700"
        />
        <StatCard
          label="Faculty Members"
          value={faculty.length}
          icon={<span>◎</span>}
          accent="bg-gold-50 text-gold-700"
        />
        <StatCard
          label="Active Exams"
          value={(exams || []).filter((e) => e.status === 'ACTIVE').length}
          icon={<span>◉</span>}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Published Results"
          value={published.length}
          icon={<span>✓</span>}
          accent="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">AI Usage — Today</h2>
              <Button size="sm" variant="ghost" onClick={() => navigate('/admin/usage')}>
                Full report →
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">
                  {todayUsage.requestCount || 0}
                </p>
                <p className="text-xs text-slate-500">Requests</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">
                  {todayUsage.pageCount || 0}
                </p>
                <p className="text-xs text-slate-500">Pages Processed</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">{weeklyRequests}</p>
                <p className="text-xs text-slate-500">This Week</p>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Daily limit usage</span>
              <span className="font-mono text-slate-800">
                {todayUsage.requestCount || 0} / {maxDaily}
              </span>
            </div>
            <ProgressBar
              value={todayUsage.requestCount || 0}
              max={maxDaily}
              color={dailyUsagePct > 80 ? 'red' : dailyUsagePct > 60 ? 'amber' : 'navy'}
            />

            <div className="mt-5">
              <p className="text-xs text-slate-400 mb-3 font-medium">7-Day Request History</p>
              <div className="flex items-end gap-1.5 h-16">
                {(aiUsage || [])
                  .slice(0, 7)
                  .reverse()
                  .map((day, i) => {
                    const h =
                      maxDaily > 0 ? ((day.requestCount || 0) / maxDaily) * 100 : 0;
                    return (
                      <div key={day.id || i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-navy-600 rounded-t-sm transition-all"
                          style={{ height: `${Math.max(4, h)}%` }}
                        />
                        <span className="text-xs text-slate-400">
                          {day.date
                            ? new Date(day.date).toLocaleDateString('en-GB', {
                                weekday: 'narrow',
                              })
                            : '—'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </Card>

          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Recent Submissions</h2>
              <span className="text-xs text-slate-400">
                {(submissions || []).length} total
              </span>
            </div>
            {(submissions || []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                No submissions in the database yet.
              </p>
            ) : (
              <Table headers={['Student', 'Exam', 'Pages', 'Status', 'Submitted']}>
                {(submissions || []).slice(0, 8).map((sub) => {
                  const exam = (exams || []).find((e) => e.id === sub.examId);
                  return (
                    <TableRow key={sub.id}>
                      <Td className="font-medium">{sub.studentName || '—'}</Td>
                      <Td>
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {exam?.code ?? '—'}
                        </span>
                      </Td>
                      <Td>{sub.pageCount ?? sub.pages?.length ?? 0}</Td>
                      <Td>
                        <StatusBadge status={sub.status} />
                      </Td>
                      <Td className="text-slate-400 text-xs">
                        {formatDate(sub.submittedAt)}
                      </Td>
                    </TableRow>
                  );
                })}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-4">System Status</h3>
            <div className="space-y-3">
              {[
                { label: 'Supabase Auth', status: 'Connected', ok: true },
                { label: 'Profiles / DB', status: 'Connected', ok: true },
                {
                  label: 'AI Provider',
                  status:
                    systemSettings?.aiMode === 'demo'
                      ? 'Demo Mode'
                      : 'Groq Mode',
                  ok: true,
                },
                { label: 'Storage', status: 'Connected', ok: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.ok ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span className="text-xs text-slate-500">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Pending Reviews</h3>
              <span className="text-xs font-mono font-semibold text-amber-600">
                {pending.length}
              </span>
            </div>
            {pending.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                All reviews complete
              </p>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 4).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {ev.studentName || 'Student'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {ev.examTitle || ev.examId}
                      </p>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Quick Links</h3>
            <div className="space-y-1.5">
              {[
                { label: 'Manage Users', path: '/admin/users' },
                { label: 'AI Usage Report', path: '/admin/usage' },
                { label: 'Audit Logs', path: '/admin/audit' },
                { label: 'System Settings', path: '/admin/settings' },
                { label: 'Groq Setup', path: '/admin/groq' },
              ].map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-navy-800 transition-colors flex items-center justify-between group"
                >
                  {link.label}
                  <span className="text-slate-300 group-hover:text-navy-400">→</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}