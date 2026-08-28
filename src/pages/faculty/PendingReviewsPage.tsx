import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge, EmptyState } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

type Tab = 'needs' | 'reviewed' | 'published' | 'queue';

export default function PendingReviewsPage() {
  const navigate = useNavigate();
  const {
    state,
    getPendingReviewsForFaculty,
    getSubmissionsForCurrentUser,
    getEvaluationsForCurrentUser,
    processEvaluation,
    showToast,
  } = useApp();
  const [tab, setTab] = useState<Tab>('queue');
  const [running, setRunning] = useState(false);

  const pendingEvals = getPendingReviewsForFaculty().filter(
    (e) => e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW'
  );
  const allFacultyEvals = getEvaluationsForCurrentUser();
  const reviewed = allFacultyEvals.filter((e) => e.status === 'REVIEWED');
  const published = allFacultyEvals.filter((e) => e.status === 'PUBLISHED');

  const mySubs = getSubmissionsForCurrentUser();
  const awaitingAi = mySubs.filter(
    (s) =>
      s.status === 'SUBMITTED' ||
      s.status === 'PROCESSING' ||
      s.status === 'AI_COMPLETE'
  );

  // Submissions with no evaluation yet
  const evalSubIds = new Set(allFacultyEvals.map((e) => e.submissionId));
  const queue = mySubs.filter(
    (s) =>
      !evalSubIds.has(s.id) ||
      s.status === 'SUBMITTED' ||
      s.status === 'PROCESSING'
  );

  async function runAiOnPending() {
    setRunning(true);
    let n = 0;
    for (const s of queue) {
      try {
        processEvaluation(s.id);
        n++;
      } catch (e) {
        console.error(e);
      }
    }
    setRunning(false);
    showToast(n ? `AI started on ${n} submission(s)` : 'Nothing in queue', 'info');
  }

  return (
    <PageContainer>
      <PageHeader
        title="Evaluations"
        subtitle="Review AI evaluations and process new student submissions."
        breadcrumb="Faculty"
        action={
          <Button size="sm" loading={running} onClick={runAiOnPending}>
            ⚡ Run AI on pending
          </Button>
        }
      />

      <div className="flex gap-4 border-b border-slate-200 mb-6 text-sm">
        {(
          [
            ['queue', `Inbox ${queue.length}`],
            ['needs', `Needs Review ${pendingEvals.length}`],
            ['reviewed', `Reviewed ${reviewed.length}`],
            ['published', `Published ${published.length}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`pb-2 px-1 border-b-2 ${
              tab === key
                ? 'border-navy-800 text-navy-900 font-medium'
                : 'border-transparent text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <div className="space-y-3">
          {queue.length === 0 ? (
            <Card>
              <EmptyState
                title="No submissions in queue"
                description="When students submit answer sheets for your exams, they appear here."
              />
            </Card>
          ) : (
            queue.map((s) => (
              <Card
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {s.studentName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.examTitle || s.examId} · {s.pageCount} page(s) ·{' '}
                    {s.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="muted">{s.status}</Badge>
                  <Button
                    size="sm"
                    onClick={() => {
                      processEvaluation(s.id);
                      showToast('AI evaluation started', 'info');
                    }}
                  >
                    Run AI
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'needs' && (
        <div className="space-y-3">
          {pendingEvals.length === 0 ? (
            <Card>
              <EmptyState
                title="No evaluations pending review"
                description="Run AI on inbox submissions first."
              />
            </Card>
          ) : (
            pendingEvals.map((ev) => (
              <Card
                key={ev.id}
                className="flex justify-between gap-3 cursor-pointer hover:border-navy-300"
                onClick={() =>
                  navigate(`/faculty/review?id=${ev.id}`)
                }
              >
                <div>
                  <p className="font-medium">{ev.studentName}</p>
                  <p className="text-xs text-slate-500">
                    {ev.examTitle} · {ev.totalMarks}/{ev.maxMarks}
                  </p>
                </div>
                <Button size="sm">Review</Button>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'reviewed' && (
        <div className="space-y-2">
          {reviewed.map((ev) => (
            <Card key={ev.id}>
              <p className="font-medium">{ev.studentName}</p>
              <p className="text-xs text-slate-500">{ev.examTitle}</p>
            </Card>
          ))}
        </div>
      )}

      {tab === 'published' && (
        <div className="space-y-2">
          {published.map((ev) => (
            <Card key={ev.id}>
              <p className="font-medium">{ev.studentName}</p>
              <p className="text-xs text-slate-500">
                {ev.examTitle} · {ev.facultyTotalMarks ?? ev.totalMarks}/
                {ev.maxMarks}
              </p>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}