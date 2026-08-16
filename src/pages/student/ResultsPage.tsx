import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  StatusBadge,
  Badge,
  EmptyState,
  Spinner,
  ConfidenceBadge,
  FlagBadge,
  ScoreBar,
  ProgressBar,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function pct(num: number, den: number) {
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

export default function ResultsPage() {
  const { state, navigate, getSubmissionsForCurrentUser, getEvaluationsForCurrentUser } = useApp();
  const { currentUser, evaluations } = state;
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(
    state.navCtx.selectedEvaluationId ?? null
  );

  if (!currentUser) return null;

  const submissions = getSubmissionsForCurrentUser();
  const publishedEvals = getEvaluationsForCurrentUser();
  const selectedEval = selectedEvalId
    ? publishedEvals.find((e) => e.id === selectedEvalId)
    : null;

  if (selectedEval) {
    const finalMarks = selectedEval.facultyTotalMarks ?? selectedEval.totalMarks;
    const percentage = pct(finalMarks, selectedEval.maxMarks);
    const grade =
      percentage >= 90 ? 'A' : percentage >= 75 ? 'B' : percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F';
    const gradeColor =
      percentage >= 75 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-600';

    return (
      <PageContainer>
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <button
            onClick={() => setSelectedEvalId(null)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to results
          </button>
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            ⎙ Download PDF
          </Button>
        </div>

        <div className="hidden print:block mb-6 pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">EvalScript — Official Result</h1>
          <p className="text-sm text-slate-500 mt-1">
            {currentUser.name} · {selectedEval.examTitle} · Generated {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score card */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="text-center py-8">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
                Final Score
              </p>
              <p className={`text-6xl font-bold ${gradeColor} mb-1`}>{grade}</p>
              <p className="text-3xl font-mono font-semibold text-slate-900 mb-1">
                {finalMarks}/{selectedEval.maxMarks}
              </p>
              <p className="text-lg text-slate-500">{percentage}%</p>
              <div className="mt-4">
                <ProgressBar value={percentage} color={percentage >= 75 ? 'emerald' : percentage >= 50 ? 'amber' : 'red'} />
              </div>
            </Card>

            <Card>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">
                Evaluation Details
              </p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Exam</dt>
                  <dd className="font-medium text-slate-800 text-right max-w-[60%] truncate">
                    {selectedEval.examTitle}
                  </dd>
                </div>
                {selectedEval.facultyName && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Reviewed by</dt>
                    <dd className="font-medium text-slate-800">{selectedEval.facultyName}</dd>
                  </div>
                )}
                {selectedEval.publishedAt && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Published</dt>
                    <dd className="font-medium text-slate-800">{formatDate(selectedEval.publishedAt)}</dd>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">AI Confidence</dt>
                  <dd>
                    <ConfidenceBadge
                      level={selectedEval.overallConfidenceLevel}
                      score={selectedEval.overallConfidence}
                    />
                  </dd>
                </div>
              </dl>
            </Card>

            {selectedEval.facultyNotes && (
              <Card className="bg-navy-50 border-navy-200">
                <p className="text-xs text-navy-500 uppercase tracking-wide font-medium mb-2">
                  Faculty Notes
                </p>
                <p className="text-sm text-navy-800 leading-relaxed">
                  {selectedEval.facultyNotes}
                </p>
              </Card>
            )}
          </div>

          {/* Question breakdown */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-slate-900">Question Breakdown</h2>
            {selectedEval.questions.map((q) => {
              const awarded = q.facultyAwarded ?? q.totalAwarded;
              return (
                <Card key={q.id}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-900">
                          Question {q.questionNumber}
                        </span>
                        <Badge variant="muted" className="font-mono">
                          {awarded}/{q.maxMarks}
                        </Badge>
                        {q.flags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {q.flags.map((f) => (
                              <FlagBadge key={f} flag={f} />
                            ))}
                          </div>
                        )}
                      </div>
                      <ConfidenceBadge level={q.confidenceLevel} score={q.confidence} />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-2xl font-semibold font-mono ${pct(awarded, q.maxMarks) >= 75 ? 'text-emerald-600' : pct(awarded, q.maxMarks) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {pct(awarded, q.maxMarks)}%
                      </p>
                    </div>
                  </div>

                  {/* Criteria */}
                  <div className="space-y-2 mb-4">
                    {q.criteriaScores.map((cs) => (
                      <div key={cs.criterionId}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-600">{cs.criterion}</span>
                          <span className="font-mono text-slate-700">
                            {cs.awarded}/{cs.max}
                          </span>
                        </div>
                        <ScoreBar awarded={cs.awarded} max={cs.max} />
                      </div>
                    ))}
                  </div>

                  {q.facultyFeedback || q.feedback ? (
                    <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-400 font-medium mb-1">Faculty Feedback</p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {q.facultyFeedback ?? q.feedback}
                      </p>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Submissions &amp; Results"
        subtitle="Track your exam submissions and view published results."
        breadcrumb="Student Portal"
      />

      <div className="space-y-6">
        {/* Active submissions */}
        <section>
          <h2 className="font-semibold text-slate-900 mb-4">All Submissions</h2>
          {submissions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<span className="text-5xl">↑</span>}
                title="No submissions yet"
                description="Submit your handwritten answer sheets from the dashboard."
                action={<Button size="sm" onClick={() => navigate('s-submit')}>Submit Exam</Button>}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const exam = state.exams.find((e) => e.id === sub.examId);
                const evaluation = sub.evaluationId
                  ? publishedEvals.find((e) => e.id === sub.evaluationId)
                  : null;
                const isProcessing = sub.status === 'PROCESSING';
                const isPublished = sub.status === 'PUBLISHED';

                return (
                  <Card key={sub.id} className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-slate-900">
                          {exam?.title ?? 'Unknown Exam'}
                        </span>
                        {exam && <Badge variant="muted">{exam.code}</Badge>}
                        <StatusBadge status={sub.status} />
                      </div>
                      <p className="text-xs text-slate-400 mb-2">
                        Submitted {formatDate(sub.submittedAt)} · {sub.pageCount} pages
                      </p>
                      {isProcessing && (
                        <div className="flex items-center gap-2 text-xs text-blue-600">
                          <Spinner size="sm" />
                          AI is transcribing and evaluating your answers…
                        </div>
                      )}
                      {isPublished && evaluation && (
                        <div className="flex items-center gap-3">
                          <ScoreBar
                            awarded={evaluation.facultyTotalMarks ?? evaluation.totalMarks}
                            max={evaluation.maxMarks}
                          />
                          <span className="font-mono text-sm font-semibold text-slate-900 shrink-0">
                            {evaluation.facultyTotalMarks ?? evaluation.totalMarks}/{evaluation.maxMarks}
                          </span>
                        </div>
                      )}
                      {sub.status === 'AI_COMPLETE' && (
                        <p className="text-xs text-amber-600">
                          Awaiting faculty review before publication.
                        </p>
                      )}
                      {sub.status === 'FACULTY_REVIEW' && (
                        <p className="text-xs text-amber-600">
                          Under faculty review — result will be published shortly.
                        </p>
                      )}
                    </div>
                    {isPublished && evaluation && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedEvalId(evaluation.id)}
                      >
                        View Result
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
