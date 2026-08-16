import React from 'react';
import { useApp } from '../../context/AppContext';
import { Card, Button, StatusBadge, Badge, StatCard, EmptyState, ScoreBar } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentDashboard() {
  const {
    state,
    navigate,
    getExamsForCurrentUser,
    getSubmissionsForCurrentUser,
    getEvaluationsForCurrentUser,
    getCalibrationForStudent,
  } = useApp();
  const { currentUser } = state;
  if (!currentUser) return null;

  const exams = getExamsForCurrentUser();
  const submissions = getSubmissionsForCurrentUser();
  const publishedEvals = getEvaluationsForCurrentUser();
  const calibration = getCalibrationForStudent(currentUser.id);

  const isCalibrated = currentUser.calibrated;
  const pendingSubmissions = submissions.filter((s) => s.status !== 'PUBLISHED');
  const publishedCount = submissions.filter((s) => s.status === 'PUBLISHED').length;

  function getSubmissionForExam(examId: string) {
    return submissions.find((s) => s.examId === examId);
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${currentUser.name.split(' ')[0]}`}
        subtitle={`${currentUser.department} · ${currentUser.studentId}`}
        breadcrumb="Student Portal"
      />

      {/* Calibration alert */}
      {!isCalibrated && (
        <div className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-xl mt-0.5">⚠</span>
            <div>
              <p className="font-medium text-amber-900">Handwriting calibration required</p>
              <p className="text-sm text-amber-700 mt-0.5">
                You must complete calibration before submitting any exam. It only takes a few
                minutes.
              </p>
            </div>
          </div>
          <Button size="sm" variant="gold" onClick={() => navigate('s-calibration')}>
            Calibrate Now
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Enrolled Exams"
          value={exams.length}
          icon={<span>◉</span>}
          accent="bg-navy-50 text-navy-700"
        />
        <StatCard
          label="Submissions"
          value={submissions.length}
          icon={<span>↑</span>}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Pending Review"
          value={pendingSubmissions.filter((s) => ['FACULTY_REVIEW', 'AI_COMPLETE'].includes(s.status)).length}
          icon={<span>◎</span>}
          accent="bg-amber-50 text-amber-700"
        />
        <StatCard
          label="Published Results"
          value={publishedCount}
          icon={<span>✓</span>}
          accent="bg-emerald-50 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Exams */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Your Exams</h2>
          </div>
          {exams.length === 0 ? (
            <Card>
              <EmptyState
                icon={<span className="text-5xl">◉</span>}
                title="No exams assigned"
                description="Your faculty will assign exams to you when they are available."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => {
                const submission = getSubmissionForExam(exam.id);
                const canSubmit = !submission && isCalibrated && exam.status === 'ACTIVE';
                return (
                  <Card key={exam.id} className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-slate-900">{exam.title}</span>
                        <Badge variant="muted">{exam.code}</Badge>
                        <StatusBadge status={exam.status} />
                      </div>
                      <p className="text-sm text-slate-500">
                        {exam.subject} · {exam.facultyName}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>📅 {formatDate(exam.date)}</span>
                        <span>⏱ {exam.duration} min</span>
                        <span>Max: {exam.maxMarks} marks</span>
                      </div>
                      {submission && (
                        <div className="mt-3 flex items-center gap-2">
                          <StatusBadge status={submission.status} />
                          <span className="text-xs text-slate-400">
                            Submitted {formatDate(submission.submittedAt)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {canSubmit ? (
                        <Button
                          size="sm"
                          onClick={() => navigate('s-submit', { selectedExamId: exam.id })}
                        >
                          Submit
                        </Button>
                      ) : submission ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate('s-results')}
                        >
                          View
                        </Button>
                      ) : !isCalibrated ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('s-calibration')}
                        >
                          Calibrate first
                        </Button>
                      ) : (
                        <Badge variant="muted">Closed</Badge>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Calibration card */}
          <Card>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Handwriting Calibration</h3>
              <StatusBadge status={isCalibrated ? 'APPROVED' : 'PENDING'} />
            </div>
            {isCalibrated && calibration ? (
              <div>
                <img
                  src={calibration.imageUrl}
                  alt="Calibration sample"
                  className="w-full h-24 object-cover rounded-lg mb-3"
                />
                <p className="text-xs text-slate-500">
                  Quality score:{' '}
                  <span className="font-mono font-medium text-slate-700">
                    {Math.round(calibration.qualityScore * 100)}%
                  </span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Uploaded {formatDate(calibration.uploadedAt)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 w-full"
                  onClick={() => navigate('s-calibration')}
                >
                  Retake calibration
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">
                  Complete calibration to enable exam submission.
                </p>
                <Button size="sm" onClick={() => navigate('s-calibration')}>
                  Start Calibration
                </Button>
              </div>
            )}
          </Card>

          {/* Recent results */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Recent Results</h3>
              <button
                onClick={() => navigate('s-results')}
                className="text-xs text-navy-600 hover:text-navy-800"
              >
                View all
              </button>
            </div>
            {publishedEvals.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No published results yet.
              </p>
            ) : (
              <div className="space-y-3">
                {publishedEvals.slice(0, 3).map((ev) => {
                  const finalMarks = ev.facultyTotalMarks ?? ev.totalMarks;
                  return (
                    <div
                      key={ev.id}
                      className="cursor-pointer"
                      onClick={() => navigate('s-result-detail', { selectedEvaluationId: ev.id })}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {ev.examTitle}
                        </span>
                        <span className="font-mono text-sm font-semibold text-slate-900 ml-2 shrink-0">
                          {finalMarks}/{ev.maxMarks}
                        </span>
                      </div>
                      <ScoreBar awarded={finalMarks} max={ev.maxMarks} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
