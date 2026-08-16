import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  StatusBadge,
  Badge,
  StatCard,
  EmptyState,
  ConfidenceBadge,
  ScoreBar,
  FlagBadge,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function FacultyDashboard() {
  const {
    state,
    navigate,
    getPendingReviewsForFaculty,
    getExamsForCurrentUser,
    getSubmissionsForCurrentUser,
    getEvaluationsForCurrentUser,
  } = useApp();
  const { currentUser } = state;
  if (!currentUser) return null;

  const pending = getPendingReviewsForFaculty();
  const exams = getExamsForCurrentUser();
  const submissions = getSubmissionsForCurrentUser();
  const evaluations = getEvaluationsForCurrentUser();
  const published = evaluations.filter((e) => e.status === 'PUBLISHED');

  return (
    <PageContainer>
      <PageHeader
        title={`Hello, ${currentUser.name.split(' ').slice(-1)[0]}`}
        subtitle={`${currentUser.department} · Faculty Portal`}
        breadcrumb="Faculty"
        action={
          <Button onClick={() => navigate('f-create-exam')}>+ Create Exam</Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Your Exams"
          value={exams.length}
          icon={<span>◉</span>}
          accent="bg-navy-50 text-navy-700"
        />
        <StatCard
          label="Total Submissions"
          value={submissions.length}
          icon={<span>↑</span>}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Pending Reviews"
          value={pending.length}
          sub={pending.length > 0 ? 'Requires your attention' : ''}
          icon={<span>◎</span>}
          accent={pending.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}
        />
        <StatCard
          label="Published Results"
          value={published.length}
          icon={<span>✓</span>}
          accent="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending reviews */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Pending Reviews</h2>
            {pending.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => navigate('f-reviews')}>
                View all ({pending.length})
              </Button>
            )}
          </div>
          {pending.length === 0 ? (
            <Card>
              <EmptyState
                icon={<span className="text-5xl">✓</span>}
                title="All caught up"
                description="No evaluations pending your review. Great work!"
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {pending.map((ev) => {
                const sub = state.submissions.find((s) => s.id === ev.submissionId);
                const exam = state.exams.find((e) => e.id === ev.examId);
                return (
                  <Card key={ev.id} className="flex items-start gap-4 hover:shadow-md transition-shadow">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-slate-900">{ev.studentName}</span>
                        <Badge variant="muted">{exam?.code ?? ev.examId}</Badge>
                        <StatusBadge status={ev.status} />
                      </div>
                      <p className="text-sm text-slate-500 mb-2">{exam?.title}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <ConfidenceBadge level={ev.overallConfidenceLevel} score={ev.overallConfidence} />
                        {ev.flags.slice(0, 2).map((f) => (
                          <FlagBadge key={f} flag={f} />
                        ))}
                        {ev.flags.length > 2 && (
                          <Badge variant="warning">+{ev.flags.length - 2} flags</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        AI scored: {ev.totalMarks}/{ev.maxMarks} ·{' '}
                        {timeAgo(ev.aiGeneratedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate('f-review', { selectedEvaluationId: ev.id })}
                    >
                      Review
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Your exams */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Your Exams</h3>
              <button
                onClick={() => navigate('f-create-exam')}
                className="text-xs text-navy-600 hover:text-navy-800"
              >
                + New
              </button>
            </div>
            {exams.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No exams yet. Create your first exam.
              </p>
            ) : (
              <div className="space-y-2">
                {exams.map((exam) => {
                  const examSubs = submissions.filter((s) => s.examId === exam.id);
                  const examPending = evaluations.filter(
                    (e) => e.examId === exam.id && (e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW')
                  ).length;
                  return (
                    <div
                      key={exam.id}
                      className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{exam.title}</p>
                        <p className="text-xs text-slate-400">
                          {exam.code} · {examSubs.length} submissions
                          {examPending > 0 ? ` · ${examPending} pending` : ''}
                        </p>
                      </div>
                      <StatusBadge status={exam.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate('f-create-exam')}
              >
                <span>+</span> Create new exam
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate('f-reviews')}
              >
                <span>◎</span> Review pending evaluations
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate('f-results')}
              >
                <span>◉</span> View published results
              </Button>
            </div>
          </Card>

          {/* Recent published */}
          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">Recently Published</h3>
            {published.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Nothing published yet.</p>
            ) : (
              <div className="space-y-2">
                {published.slice(0, 4).map((ev) => (
                  <div key={ev.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{ev.studentName}</p>
                      <ScoreBar
                        awarded={ev.facultyTotalMarks ?? ev.totalMarks}
                        max={ev.maxMarks}
                      />
                    </div>
                    <span className="font-mono text-xs text-slate-600 shrink-0">
                      {ev.facultyTotalMarks ?? ev.totalMarks}/{ev.maxMarks}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
