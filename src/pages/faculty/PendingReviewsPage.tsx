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
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState(''); // '' = all exams

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

  /** Exam options from current faculty data */
  const examOptions = useMemo(() => {
    const map = new Map<string, string>();
    exams.forEach((e) => {
      if (myExamIds.size === 0 || myExamIds.has(e.id)) {
        map.set(e.id, `${e.title || e.code} (${e.code})`);
      }
    });
    mySubs.forEach((s) => {
      if (s.examId && !map.has(s.examId)) {
        map.set(s.examId, s.examTitle || s.examCode || s.examId);
      }
    });
    myEvals.forEach((e) => {
      if (e.examId && !map.has(e.examId)) {
        map.set(e.examId, e.examTitle || e.examCode || e.examId);
      }
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [exams, myExamIds, mySubs, myEvals]);

  const q = search.trim().toLowerCase();

  const filteredInbox = useMemo(() => {
    return inbox.filter((s) => {
      if (examFilter && s.examId !== examFilter) return false;
      if (q && !(s.studentName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inbox, examFilter, q]);

  const filteredNeeds = useMemo(() => {
    return needsReview.filter((e) => {
      if (examFilter && e.examId !== examFilter) return false;
      if (q && !(e.studentName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [needsReview, examFilter, q]);

  const filteredReviewed = useMemo(() => {
    return reviewed.filter((e) => {
      if (examFilter && e.examId !== examFilter) return false;
      if (q && !(e.studentName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reviewed, examFilter, q]);

  const filteredPublished = useMemo(() => {
    return published.filter((e) => {
      if (examFilter && e.examId !== examFilter) return false;
      if (q && !(e.studentName || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [published, examFilter, q]);

  function goReview(evaluationId: string) {
    sessionStorage.setItem('reviewEvalId', evaluationId);
    navigate('f-review', { selectedEvaluationId: evaluationId });
  }

  async function handleRunAi(subId?: string) {
    setBusy(true);
    try {
      const targets = subId
        ? mySubs.filter((s) => s.id === subId)
        : filteredInbox;
      if (!targets.length) {
        showToast('Nothing pending for AI', 'info');
        return;
      }
      for (const s of targets) processEvaluation(s.id, s);
      showToast(`AI started on ${targets.length} submission(s)`, 'info');
      setTimeout(() => reloadCloudData?.(), 4000);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'inbox', label: 'Inbox', count: filteredInbox.length },
    { key: 'needs', label: 'Needs Review', count: filteredNeeds.length },
    { key: 'reviewed', label: 'Reviewed', count: filteredReviewed.length },
    { key: 'published', label: 'Published', count: filteredPublished.length },
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
              disabled={filteredInbox.length === 0}
            >
              ⚡ Run AI on pending
            </Button>
          </div>
        }
      />

      {/* Search + Exam filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            🔍
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name…"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
          />
        </div>
        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-500 min-w-[200px] sm:max-w-xs"
        >
          <option value="">All exams</option>
          {examOptions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        {(search || examFilter) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setExamFilter('');
            }}
          >
            Clear
          </Button>
        )}
      </div>

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
          {filteredInbox.length === 0 ? (
            <EmptyState
              title={
                search || examFilter ? 'No matches' : 'Inbox empty'
              }
              description={
                search || examFilter
                  ? 'Try another name or exam filter.'
                  : 'New submissions appear here until AI finishes.'
              }
            />
          ) : (
            filteredInbox.map((sub) => (
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
          list={filteredNeeds}
          emptyTitle={
            search || examFilter ? 'No matches' : 'No evaluations waiting'
          }
          emptyDesc={
            search || examFilter
              ? 'Try another name or exam filter.'
              : 'After AI completes, scripts show here with marks.'
          }
          mode="review"
          submissions={mySubs}
          onOpen={goReview}
        />
      )}
      {tab === 'reviewed' && (
        <EvalList
          list={filteredReviewed}
          emptyTitle={
            search || examFilter ? 'No matches' : 'Nothing reviewed yet'
          }
          emptyDesc={
            search || examFilter
              ? 'Try another name or exam filter.'
              : 'After Save Review, items appear here.'
          }
          mode="view"
          submissions={mySubs}
          onOpen={goReview}
        />
      )}
      {tab === 'published' && (
        <EvalList
          list={filteredPublished}
          emptyTitle={
            search || examFilter ? 'No matches' : 'Nothing published'
          }
          emptyDesc={
            search || examFilter
              ? 'Try another name or exam filter.'
              : 'Published results appear here.'
          }
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