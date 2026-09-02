import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Button,
  Card,
  Badge,
  StatusBadge,
  ConfidenceBadge,
  FlagBadge,
  Spinner,
  Modal,
  Textarea,
  ScoreBar,
  ProgressBar,
} from '../../components/ui';
import type { Evaluation } from '../../types';
import { validateFacultyMarks } from '../../lib/marks-validator';

type ZoomLevel = 0.5 | 0.75 | 1 | 1.25 | 1.5;

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export default function ReviewInterfacePage() {
  const location = useLocation();
  const {
    state,
    navigate,
    updateEvaluation,
    publishEvaluation,
    showToast,
    reloadCloudData,
  } = useApp();
  const { navCtx, evaluations, submissions, authLoading } = state;

  // ID from navCtx OR router location.state (survives better)
  const locState = (location.state || {}) as { selectedEvaluationId?: string };
  const evalId =
    navCtx?.selectedEvaluationId ||
    locState.selectedEvaluationId ||
    sessionStorage.getItem('reviewEvalId') ||
    '';

  useEffect(() => {
    if (evalId) sessionStorage.setItem('reviewEvalId', evalId);
  }, [evalId]);

  useEffect(() => {
    reloadCloudData?.();
  }, []);

  const evaluationFromState = useMemo(() => {
    if (!evalId) return null;
    return evaluations.find((e) => e.id === evalId) ?? null;
  }, [evalId, evaluations]);

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [rotation, setRotation] = useState(0);
  const [facultyMarks, setFacultyMarks] = useState<Record<string, number>>({});
  const [facultyFeedback, setFacultyFeedback] = useState<Record<string, string>>(
    {}
  );
  const [facultyNotes, setFacultyNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishModal, setPublishModal] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ev = evaluationFromState;
    setEvaluation(ev);
    if (ev) {
      const marks: Record<string, number> = {};
      const feedback: Record<string, string> = {};
      (ev.questions || []).forEach((q) => {
        marks[q.id] = q.facultyAwarded ?? q.totalAwarded ?? 0;
        feedback[q.id] = q.facultyFeedback ?? q.feedback ?? '';
      });
      setFacultyMarks(marks);
      setFacultyFeedback(feedback);
      setFacultyNotes(ev.facultyNotes ?? '');
      setSelectedPage(0);
      setSelectedQuestion(0);
    }
  }, [evaluationFromState]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!evalId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 bg-slate-50">
        <p className="text-slate-600 text-sm">No evaluation selected.</p>
        <Button onClick={() => navigate('f-reviews')}>← Back to list</Button>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 bg-slate-50">
        <Spinner size="lg" />
        <p className="text-slate-500 text-sm">Loading evaluation…</p>
        <p className="text-xs text-slate-400">ID: {evalId}</p>
        <Button variant="secondary" onClick={() => reloadCloudData?.()}>
          Reload from cloud
        </Button>
        <Button variant="ghost" onClick={() => navigate('f-reviews')}>
          ← Back
        </Button>
      </div>
    );
  }

  const submission = submissions.find((s) => s.id === evaluation.submissionId);
  const pages = submission?.pages ?? [];
  const questions = evaluation.questions?.length
    ? evaluation.questions
    : [
        {
          id: 'q-fallback',
          questionNumber: 1,
          maxMarks: evaluation.maxMarks || 100,
          totalAwarded: evaluation.totalMarks || 0,
          facultyAwarded: evaluation.facultyTotalMarks,
          confidence: evaluation.overallConfidence || 0.7,
          confidenceLevel: evaluation.overallConfidenceLevel || 'MEDIUM',
          flags: evaluation.flags || [],
          studentAnswer: evaluation.transcription || '—',
          answerSummary: '',
          feedback: evaluation.facultyNotes || '',
          facultyFeedback: '',
          criteriaScores: [
            {
              criterionId: 'c1',
              criterion: 'Overall',
              awarded: evaluation.totalMarks || 0,
              max: evaluation.maxMarks || 100,
            },
          ],
        },
      ];
  const currentQuestion = questions[selectedQuestion] || questions[0];
  const isPublished = (evaluation.status || '').toUpperCase() === 'PUBLISHED';

  const totalFacultyMarks = questions.reduce(
    (sum, q) => sum + (facultyMarks[q.id] ?? q.totalAwarded ?? 0),
    0
  );

  function handleMarkChange(qId: string, value: string) {
    const num = parseFloat(value);
    const question = questions.find((q) => q.id === qId);
    if (!question) return;
    const err = validateFacultyMarks(
      num,
      question.maxMarks,
      `Q${question.questionNumber}`
    );
    setErrors((prev) => ({ ...prev, [qId]: err ?? '' }));
    setFacultyMarks((prev) => ({ ...prev, [qId]: isNaN(num) ? 0 : num }));
  }

  async function handleSaveDraft() {
    setSaving(true);
    if (Object.values(errors).some(Boolean)) {
      showToast('Please fix mark errors before saving.', 'error');
      setSaving(false);
      return;
    }

    const updatedEval: Evaluation = {
      ...evaluation!,
      status: 'REVIEWED',
      facultyTotalMarks: totalFacultyMarks,
      facultyNotes,
      facultyReviewedAt: new Date().toISOString(),
      facultyId: state.currentUser?.id ?? '',
      facultyName: state.currentUser?.name ?? '',
      questions: questions.map((q) => ({
        ...q,
        facultyAwarded: facultyMarks[q.id] ?? q.totalAwarded,
        facultyFeedback: facultyFeedback[q.id] ?? q.feedback,
      })),
    };

    updateEvaluation(updatedEval);
    setEvaluation(updatedEval);
    showToast('Review saved — moved to Reviewed.', 'success');
    setSaving(false);
  }

  async function handlePublish() {
    if (!evaluation) return;
    setPublishing(true);
    if (Object.values(errors).some(Boolean)) {
      showToast('Please fix all mark errors before publishing.', 'error');
      setPublishing(false);
      return;
    }

    const updatedEval: Evaluation = {
      ...evaluation,
      status: 'PUBLISHED',
      facultyTotalMarks: totalFacultyMarks,
      facultyNotes,
      facultyReviewedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      facultyId: state.currentUser?.id ?? '',
      facultyName: state.currentUser?.name ?? '',
      questions: questions.map((q) => ({
        ...q,
        facultyAwarded: facultyMarks[q.id] ?? q.totalAwarded,
        facultyFeedback: facultyFeedback[q.id] ?? q.feedback,
      })),
    };

    updateEvaluation(updatedEval);
    publishEvaluation(evaluation.id, facultyNotes);
    setEvaluation(updatedEval);
    setPublishing(false);
    setPublishModal(false);
    showToast(`Result published for ${evaluation.studentName}.`, 'success');
  }

  const ZOOM_LEVELS: ZoomLevel[] = [0.5, 0.75, 1, 1.25, 1.5];
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom);

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 z-10">
        <button
          type="button"
          onClick={() => navigate('f-reviews')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mr-2"
        >
          ← Back
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">
              {evaluation.studentName}
            </span>
            <span className="text-slate-400 text-sm">·</span>
            <span className="text-sm text-slate-600 truncate">
              {evaluation.examTitle}
            </span>
            <StatusBadge status={evaluation.status} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge
            level={evaluation.overallConfidenceLevel}
            score={evaluation.overallConfidence}
          />
          {!isPublished && (
            <>
              <Button
                size="sm"
                variant="secondary"
                loading={saving}
                onClick={handleSaveDraft}
              >
                Save Review
              </Button>
              <Button
                size="sm"
                variant="gold"
                onClick={() => setPublishModal(true)}
              >
                Approve &amp; Publish
              </Button>
            </>
          )}
          {isPublished && <Badge variant="success">Published</Badge>}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Pages */}
        <div
          className="flex flex-col bg-slate-800 border-r border-slate-700"
          style={{ width: '45%', minWidth: 280 }}
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700">
            <span className="text-slate-400 text-xs font-medium">
              Page {pages.length ? selectedPage + 1 : 0} / {pages.length}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIdx - 1)])}
              disabled={zoomIdx === 0}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-white text-sm disabled:opacity-30"
            >
              −
            </button>
            <span className="text-slate-400 text-xs w-10 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom(
                  ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1)]
                )
              }
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-white text-sm disabled:opacity-30"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-white text-sm"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={() => setShowTranscription(!showTranscription)}
              className={`px-2 h-7 rounded text-xs ${
                showTranscription
                  ? 'bg-navy-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Text
            </button>
          </div>

          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            {pages.length > 0 ? (
              <div
                style={{
                  transform: `rotate(${rotation}deg) scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s',
                }}
              >
                <img
                  src={pages[selectedPage]?.imageUrl}
                  alt={`Page ${selectedPage + 1}`}
                  className="rounded-lg shadow-xl max-w-full"
                  style={{ minWidth: 240 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
              </div>
            ) : (
              <div className="text-slate-400 text-sm text-center py-12 px-4">
                No answer pages linked.
                <br />
                <span className="text-xs">
                  Submission id: {evaluation.submissionId || '—'}
                </span>
              </div>
            )}
          </div>

          {showTranscription && (
            <div className="border-t border-slate-700 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-1">AI Transcription</p>
              <p className="text-xs text-slate-300 whitespace-pre-wrap">
                {evaluation.transcription || '—'}
              </p>
            </div>
          )}

          {pages.length > 0 && (
            <div className="border-t border-slate-700 px-3 py-2 flex gap-2 overflow-x-auto">
              {pages.map((page, i) => (
                <button
                  key={page.id || i}
                  type="button"
                  onClick={() => setSelectedPage(i)}
                  className={`shrink-0 rounded overflow-hidden border-2 ${
                    i === selectedPage
                      ? 'border-gold-400'
                      : 'border-transparent opacity-60'
                  }`}
                >
                  <img
                    src={page.thumbnailUrl || page.imageUrl}
                    alt={`p${i + 1}`}
                    className="w-12 h-16 object-cover bg-slate-700"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Marks panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 overflow-x-auto shrink-0">
            {questions.map((q, i) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedQuestion(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  i === selectedQuestion
                    ? 'bg-navy-900 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Q{q.questionNumber}{' '}
                <span className="font-mono opacity-80">
                  {facultyMarks[q.id] ?? q.totalAwarded}/{q.maxMarks}
                </span>
              </button>
            ))}
          </div>

          <div ref={rightPanelRef} className="flex-1 overflow-y-auto p-5 space-y-5">
            {currentQuestion && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      Question {currentQuestion.questionNumber}
                    </p>
                    <div className="flex gap-2 flex-wrap mt-1">
                      <ConfidenceBadge
                        level={currentQuestion.confidenceLevel}
                        score={currentQuestion.confidence}
                      />
                      {(currentQuestion.flags || []).map((f) => (
                        <FlagBadge key={f} flag={f} />
                      ))}
                    </div>
                  </div>
                  <p className="text-2xl font-mono font-semibold text-navy-800">
                    {pct(
                      facultyMarks[currentQuestion.id] ??
                        currentQuestion.totalAwarded,
                      currentQuestion.maxMarks
                    )}
                    %
                  </p>
                </div>

                <Card className="bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Student answer (AI)
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {currentQuestion.studentAnswer || '—'}
                  </p>
                </Card>

                {(currentQuestion.criteriaScores || []).length > 0 && (
                  <Card>
                    <h3 className="font-semibold text-sm mb-3">Criteria</h3>
                    <div className="space-y-3">
                      {currentQuestion.criteriaScores.map((cs) => (
                        <div key={cs.criterionId}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{cs.criterion}</span>
                            <span className="font-mono text-slate-500">
                              {cs.awarded}/{cs.max}
                            </span>
                          </div>
                          <ScoreBar awarded={cs.awarded} max={cs.max} />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                <Card className="border-2 border-gold-200 bg-gold-50">
                  <p className="text-sm font-semibold mb-2">Faculty marks</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={currentQuestion.maxMarks}
                      step={0.5}
                      disabled={isPublished}
                      value={
                        facultyMarks[currentQuestion.id] ??
                        currentQuestion.totalAwarded
                      }
                      onChange={(e) =>
                        handleMarkChange(currentQuestion.id, e.target.value)
                      }
                      className="w-20 h-10 px-2 rounded-lg border border-gold-300 text-center font-mono font-semibold"
                    />
                    <span>/ {currentQuestion.maxMarks}</span>
                  </div>
                  {errors[currentQuestion.id] && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors[currentQuestion.id]}
                    </p>
                  )}
                </Card>

                <Card>
                  <p className="text-xs text-slate-500 mb-1">AI feedback</p>
                  <p className="text-sm text-slate-700 mb-3">
                    {currentQuestion.feedback}
                  </p>
                  {!isPublished && (
                    <Textarea
                      label="Your feedback"
                      rows={3}
                      value={facultyFeedback[currentQuestion.id] ?? ''}
                      onChange={(e) =>
                        setFacultyFeedback((prev) => ({
                          ...prev,
                          [currentQuestion.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </Card>
              </>
            )}
          </div>

          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400">AI</p>
                <p className="font-mono font-semibold">
                  {evaluation.totalMarks}/{evaluation.maxMarks}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Faculty</p>
                <p className="font-mono font-semibold">
                  {totalFacultyMarks}/{evaluation.maxMarks}
                </p>
              </div>
            </div>
            {!isPublished && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={saving}
                  onClick={handleSaveDraft}
                >
                  Save Review
                </Button>
                <Button
                  size="sm"
                  variant="gold"
                  onClick={() => setPublishModal(true)}
                >
                  Publish
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={publishModal}
        onClose={() => setPublishModal(false)}
        title="Publish result"
      >
        <p className="text-sm text-slate-600 mb-4">
          Student <strong>{evaluation.studentName}</strong> will see{' '}
          <strong>
            {totalFacultyMarks}/{evaluation.maxMarks}
          </strong>
          .
        </p>
        <Textarea
          label="Notes (optional)"
          rows={2}
          value={facultyNotes}
          onChange={(e) => setFacultyNotes(e.target.value)}
        />
        <div className="flex gap-3 mt-4">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => setPublishModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="gold"
            className="flex-1"
            loading={publishing}
            onClick={handlePublish}
          >
            Confirm publish
          </Button>
        </div>
      </Modal>
    </div>
  );
}