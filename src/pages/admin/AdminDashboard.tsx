import React, { useState } from 'react';
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
  Badge,
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
  const { state, deleteExam, showToast } = useApp();
  const navigate = useNavigate();
  const { users, exams, submissions, evaluations, aiUsage, systemSettings } =
    state;

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const students = (users || []).filter((u) => u.role === 'student');
  const faculty = (users || []).filter((u) => u.role === 'faculty');
  const published = (evaluations || []).filter((e) => e.status === 'PUBLISHED');
  const pending = (evaluations || []).filter(
    (e) => e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW'
  );

  const todayUsage = aiUsage?.[0] ?? {
    requestCount: 0,
    pageCount: 0,
  };
  const maxDaily = systemSettings?.maxAiRequestsPerDay || 50;
  const dailyUsagePct = Math.round(
    ((todayUsage.requestCount || 0) / maxDaily) * 100
  );
  const weeklyRequests = (aiUsage || [])
    .slice(0, 7)
    .reduce((sum, u) => sum + (u.requestCount || 0), 0);

  async function handleDeleteExam(examId: string, title: string, code: string) {
    const ok = window.confirm(
      `Delete exam "${title}" (${code})?\n\nFaculty and students will no longer see it. This cannot be undone.`
    );
    if (!ok) return;

    setDeletingId(examId);
    try {
      await deleteExam(examId);
      showToast(`Exam ${code} deleted`, 'success');
    } catch (e: any) {
      showToast(e?.message || 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="System Overview"
        subtitle="Live platform stats and exam management."
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

      {/* All exams — admin delete */}
      <Card className="mb-6" padding={false}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">All Exams</h2>
          <Badge variant="muted">{(exams || []).length} total</Badge>
        </div>
        {(exams || []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            No exams in the system.
          </p>
        ) : (
          <Table
            headers={['Title', 'Code', 'Faculty', 'Status', 'Students', 'Date', '']}
          >
            {(exams || []).map((exam) => (
              <TableRow key={exam.id}>
                <Td className="font-medium max-w-[180px] truncate">
                  {exam.title}
                </Td>
                <Td>
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                    {exam.code}
                  </span>
                </Td>
                <Td className="text-sm text-slate-600">
                  {exam.facultyName || '—'}
                </Td>
                <Td>
                  <StatusBadge status={exam.status} />
                </Td>
                <Td className="text-sm">
                  {(exam.studentIds || []).length}
                </Td>
                <Td className="text-xs text-slate-400">
                  {formatDate(exam.date || exam.createdAt)}
                </Td>
                <Td>
                  <button
                    type="button"
                    disabled={deletingId === exam.id}
                    onClick={() =>
                      handleDeleteExam(exam.id, exam.title, exam.code)
                    }
                    className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded disabled:opacity-50"
                  >
                    {deletingId === exam.id ? '…' : 'Delete'}
                  </button>
                </Td>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-900">AI Usage — Today</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/admin/usage')}
              >
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
                <p className="text-xs text-slate-500">Pages</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-semibold text-slate-900">
                  {weeklyRequests}
                </p>
                <p className="text-xs text-slate-500">This Week</p>
              </div>
            </div>
            <ProgressBar
              value={todayUsage.requestCount || 0}
              max={maxDaily}
              color={
                dailyUsagePct > 80 ? 'red' : dailyUsagePct > 60 ? 'amber' : 'navy'
              }
            />
          </Card>

          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Recent Submissions</h2>
            </div>
            {(submissions || []).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">
                No submissions yet.
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
            <h3 className="font-semibold text-slate-900 text-sm mb-4">
              System Status
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Supabase', status: 'Connected', ok: true },
                {
                  label: 'AI',
                  status:
                    systemSettings?.aiMode === 'demo' ? 'Demo' : 'Claude',
                  ok: true,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-slate-600">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.status}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">
                Pending Reviews
              </h3>
              <span className="text-xs font-mono text-amber-600">
                {pending.length}
              </span>
            </div>
            {pending.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                All clear
              </p>
            ) : (
              <div className="space-y-2">
                {pending.slice(0, 4).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {ev.studentName || 'Student'}
                      </p>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">
              Quick Links
            </h3>
            <div className="space-y-1.5">
              {[
                { label: 'Manage Users', path: '/admin/users' },
                { label: 'AI Usage', path: '/admin/usage' },
                { label: 'Audit Logs', path: '/admin/audit' },
                { label: 'Settings', path: '/admin/settings' },
                { label: 'Claude Setup', path: '/admin/groq' },
              ].map((link) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  {link.label} →
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}