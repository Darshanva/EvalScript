import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  StatusBadge,
  Badge,
  EmptyState,
  ConfidenceBadge,
  FlagBadge,
  Tabs,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function PendingReviewsPage() {
  const { state, navigate, getEvaluationsForCurrentUser, processEvaluation, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<string>('pending');
  const evaluations = getEvaluationsForCurrentUser();

  const pending = evaluations.filter((e) => e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW');
  const reviewed = evaluations.filter((e) => e.status === 'REVIEWED');
  const published = evaluations.filter((e) => e.status === 'PUBLISHED');

  const displayList =
    activeTab === 'pending' ? pending : activeTab === 'reviewed' ? reviewed : published;

  function handleProcessAll() {
    const unprocessed = state.submissions.filter(
      (s) => s.status === 'SUBMITTED' && state.exams.some((e) => e.facultyId === state.currentUser?.id && e.id === s.examId)
    );
    if (unprocessed.length === 0) {
      showToast('No unprocessed submissions found.', 'info');
      return;
    }
    unprocessed.forEach((s) => processEvaluation(s.id));
    showToast(`Processing ${unprocessed.length} submission(s) with AI…`, 'info');
  }

  return (
    <PageContainer>
      <PageHeader
        title="Evaluations"
        subtitle="Review AI-generated evaluations before publishing student results."
        breadcrumb="Faculty"
        action={
          <Button size="sm" variant="secondary" onClick={handleProcessAll}>
            ⚡ Run AI on pending
          </Button>
        }
      />

      <Tabs
        tabs={[
          { key: 'pending', label: 'Needs Review', count: pending.length },
          { key: 'reviewed', label: 'Reviewed', count: reviewed.length },
          { key: 'published', label: 'Published', count: published.length },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {displayList.length === 0 ? (
        <Card>
          <EmptyState
            icon={<span className="text-5xl">{activeTab === 'pending' ? '✓' : '◎'}</span>}
            title={
              activeTab === 'pending'
                ? 'No evaluations pending review'
                : activeTab === 'reviewed'
                ? 'No reviewed evaluations'
                : 'No published results'
            }
            description={
              activeTab === 'pending'
                ? 'All evaluations have been reviewed. Well done!'
                : 'Evaluations will appear here after review.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {displayList.map((ev) => {
            const exam = state.exams.find((e) => e.id === ev.examId);
            const sub = state.submissions.find((s) => s.id === ev.submissionId);
            const finalMarks = ev.facultyTotalMarks ?? ev.totalMarks;
            return (
              <Card
                key={ev.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate('f-review', { selectedEvaluationId: ev.id })}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900">{ev.studentName}</span>
                      {exam && <Badge variant="muted">{exam.code}</Badge>}
                      <StatusBadge status={ev.status} />
                    </div>
                    <p className="text-sm text-slate-500 mb-2">{ev.examTitle}</p>

                    <div className="flex items-center gap-3 flex-wrap">
                      <ConfidenceBadge level={ev.overallConfidenceLevel} score={ev.overallConfidence} />
                      <span className="text-xs text-slate-400 font-mono">
                        AI: {ev.totalMarks}/{ev.maxMarks}
                      </span>
                      {ev.status === 'PUBLISHED' && (
                        <span className="text-xs text-slate-400 font-mono">
                          Final: {finalMarks}/{ev.maxMarks}
                        </span>
                      )}
                    </div>

                    {ev.flags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {ev.flags.slice(0, 3).map((f) => (
                          <FlagBadge key={f} flag={f} />
                        ))}
                        {ev.flags.length > 3 && (
                          <Badge variant="warning">+{ev.flags.length - 3} more flags</Badge>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-400 mt-2">
                      {sub ? `${sub.pageCount} pages · ` : ''}
                      AI evaluated {timeAgo(ev.aiGeneratedAt)}
                      {ev.facultyReviewedAt && (
                        <> · Reviewed {timeAgo(ev.facultyReviewedAt)}</>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {activeTab === 'pending' && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('f-review', { selectedEvaluationId: ev.id });
                        }}
                      >
                        Review
                      </Button>
                    )}
                    {activeTab !== 'pending' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('f-review', { selectedEvaluationId: ev.id });
                        }}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
