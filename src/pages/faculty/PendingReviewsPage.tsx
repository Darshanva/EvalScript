import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  StatusBadge,
  Badge,
  EmptyState,
  ConfidenceBadge,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Evaluation, Submission } from '../../types';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 24) return `${Math.floor(hrs / 24)}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

type TabKey = 'inbox' | 'needs' | 'reviewed' | 'published';

export default function PendingReviewsPage() {
  const {
    state,
    navigate,
    processEvaluation,
    showToast,
    getEvaluationsForCurrentUser,
    getSubmissionsForCurrentUser,
    reloadCloudData,
  } = useApp();
  const { currentUser, exams, evaluations: allEvals } = state;
  const [tab, setTab] = useState<TabKey>('needs');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    reloadCloudData?.();
  }, []);

  if (!currentUser) return null;

  const myExamIds = useMemo(() => {
    const ids = new Set<string>();
    exams.forEach((e) => {
      if (
        e.facultyId === currentUser.id ||
        e.facultyName === currentUser.name
      ) {
        ids.add(e.id);
      }
    });
    return ids;
  }, [exams, currentUser]);

  const mySubs = useMemo(() => {
    const all = getSubmissionsForCurrentUser();
    if (myExamIds.size === 0) return all;
    return all.filter((s) => myExamIds.has(s.examId));
  }, [getSubmissionsForCurrentUser, myExamIds, state.submissions]);

  const myEvals = useMemo(() => {
    const map = new Map<string, Evaluation>();
    getEvaluationsForCurrentUser().forEach((e) => map.set(e.id, e));
    allEvals.forEach((e) => {
      if (myExamIds.has(e.examId) || myExamIds.size === 0) map.set(e.id, e);
    });
    // also match by submission belonging to my subs
    const subIds = new Set(mySubs.map((s) => s.id));
    allEvals.forEach((e) => {
      if (e.submissionId && subIds.has(e.submissionId)) map.set(e.id, e);
    });
    return Array.from(map.values());
  }, [
    getEvaluationsForCurrentUser,
    allEvals,
    myExamIds,
    mySubs,
    state.evaluations,
  ]);

  const evalBySubmission = useMemo(() => {
    const m = new Map<string, Evaluation>();
    myEvals.forEach((e) => {
      if (e.submissionId) m.set(e.submissionId, e);
    });
    return m;
  }, [myEvals]);

  const inbox: Submission[] = useMemo(() => {
    return mySubs.filter((s) => {
      const st = (s.status || '').toUpperCase();
      const ev = evalBySubmission.get(s.id);
      const est = (ev?.status || '').toUpperCase();
      if (
        ev &&
        ['AI_COMPLETE', 'FACULTY_REVIEW', 'REVIEWED', 'PUBLISHED'].includes(est)
      ) {
        return false;
      }
      return (
        st === 'SUBMITTED' ||
        st === 'PROCESSING' ||
        st === 'QUEUED' ||
        !st
      );
    });
  }, [mySubs, evalBySubmission]);

  const needsReview = useMemo(
    () =>
      myEvals.filter((e) =>
        ['AI_COMPLETE', 'FACULTY_REVIEW'].includes(
          (e.status || '').toUpperCase()
        )
      ),
    [myEvals]
  );

  const reviewed = useMemo(
    () =>
      myEvals.filter((e) => (e.status || '').toUpperCase() === 'REVIEWED'),
    [myEvals]
  );

  const published = useMemo(
    () =>
      myEvals.filter((e) => (e.status || '').toUpperCase() === 'PUBLISHED'),
    [myEvals]
  );

  function goReview(evaluationId: string) {
    sessionStorage.setItem('reviewEvalId', evaluationId);
    navigate('f-review', { selectedEvaluationId: evaluationId });
  }

  async function handleRunAi(subId?: string) {
    setBusy(true);
    try {
      const targets = subId
        ? mySubs.filter((s) => s.id === subId)
        : inbox;
      if (!targets.length) {
        showToast('Nothing pending for AI', 'info');
        return;
      }
      for (const s of targets) processEvaluation(s.id);
      showToast(`AI started on ${targets.length} submission(s)`, 'info');
      setTimeout(() => reloadCloudData?.(), 4000);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'inbox', label: 'Inbox', count: inbox.length },
    { key: 'needs', label: 'Needs Review', count: needsReview.length },
    { key: 'reviewed', label: 'Reviewed', count: reviewed.length },
    { key: 'published', label: 'Published', count: published.length },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Evaluations"
        subtitle="Review AI evaluations and process student submissions."
        breadcrumb="Faculty"
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => reloadCloudData?.()}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              loading={busy}
              onClick={() => handleRunAi()}
              disabled={inbox.length === 0}
            >
              ⚡ Run AI on pending
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 mb-6 border-b border-slate-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key
                ? 'border-navy-700 text-navy-900'
                : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}{' '}
            <span className="text-slate-400 font-normal">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <div className="space-y-3">
          {inbox.length === 0 ? (
            <EmptyState
              title="Inbox empty"
              description="New submissions appear here until AI finishes."
            />
          ) : (
            inbox.map((sub) => (
              <Card key={sub.id} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {sub.studentName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {sub.examCode || sub.examTitle} ·{' '}
                    {sub.pageCount || sub.pages?.length || 0} page(s) ·{' '}
                    {(sub.status || 'SUBMITTED').toUpperCase()}
                  </p>
                </div>
                <Badge variant="muted">
                  {(sub.status || 'SUBMITTED').toUpperCase()}
                </Badge>
                <Button
                  size="sm"
                  loading={busy}
                  onClick={() => handleRunAi(sub.id)}
                >
                  Run AI
                </Button>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'needs' && (
        <EvalList
          list={needsReview}
          emptyTitle="No evaluations waiting"
          emptyDesc="After AI completes, scripts show here with marks."
          mode="review"
          submissions={mySubs}
          onOpen={goReview}
        />
      )}
      {tab === 'reviewed' && (
        <EvalList
          list={reviewed}
          emptyTitle="Nothing reviewed yet"
          emptyDesc="After Save Review, items appear here."
          mode="view"
          submissions={mySubs}
          onOpen={goReview}
        />
      )}
      {tab === 'published' && (
        <EvalList
          list={published}
          emptyTitle="Nothing published"
          emptyDesc="Published results appear here."
          mode="view"
          submissions={mySubs}
          onOpen={goReview}
        />
      )}
    </PageContainer>
  );
}

function EvalList({
  list,
  emptyTitle,
  emptyDesc,
  mode,
  submissions,
  onOpen,
}: {
  list: Evaluation[];
  emptyTitle: string;
  emptyDesc: string;
  mode: 'review' | 'view';
  submissions: Submission[];
  onOpen: (id: string) => void;
}) {
  if (!list.length) {
    return <EmptyState title={emptyTitle} description={emptyDesc} />;
  }
  return (
    <div className="space-y-3">
      {list.map((ev) => {
        const sub = submissions.find((s) => s.id === ev.submissionId);
        const pages = sub?.pageCount ?? sub?.pages?.length ?? 0;
        const st = (ev.status || '').toUpperCase();
        return (
          <Card
            key={ev.id}
            className="cursor-pointer hover:border-navy-300"
            onClick={() => onOpen(ev.id)}
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-medium text-slate-900">
                    {ev.studentName}
                  </p>
                  <StatusBadge status={ev.status} />
                </div>
                <p className="text-sm text-slate-600">
                  {ev.examTitle || ev.examCode}
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-sm">
                  <span className="font-mono font-semibold text-navy-800">
                    AI: {ev.totalMarks}/{ev.maxMarks}
                  </span>
                  {(st === 'REVIEWED' || st === 'PUBLISHED') && (
                    <span className="font-mono font-semibold text-emerald-700">
                      Final: {ev.facultyTotalMarks ?? ev.totalMarks}/
                      {ev.maxMarks}
                    </span>
                  )}
                  {typeof ev.overallConfidence === 'number' && (
                    <ConfidenceBadge
                      level={ev.overallConfidenceLevel}
                      score={ev.overallConfidence}
                    />
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {pages > 0 ? `${pages} pages · ` : ''}
                  {ev.aiGeneratedAt ? `AI ${timeAgo(ev.aiGeneratedAt)}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant={mode === 'review' ? 'primary' : 'secondary'}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(ev.id);
                }}
              >
                {mode === 'review' ? 'Review' : 'View'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}