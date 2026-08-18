import React, { useState, useEffect, useRef } from 'react';
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
import { PageContainer } from '../../components/Layout';
import type { Evaluation, EvaluationQuestion } from '../../types';
import { validateFacultyMarks } from '../../lib/marks-validator';

type ZoomLevel = 0.5 | 0.75 | 1 | 1.25 | 1.5;

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export default function ReviewInterfacePage() {
  const { state, navigate, updateEvaluation, publishEvaluation, showToast } = useApp();
  const { navCtx, evaluations, submissions } = state;
  const evalId = navCtx.selectedEvaluationId;

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [selectedPage, setSelectedPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState(0);
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [rotation, setRotation] = useState(0);
  const [facultyMarks, setFacultyMarks] = useState<Record<string, number>>({});
  const [facultyFeedback, setFacultyFeedback] = useState<Record<string, string>>({});
  const [facultyNotes, setFacultyNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishModal, setPublishModal] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ev = evaluations.find((e) => e.id === evalId) ?? null;
    setEvaluation(ev);
    if (ev) {
      const marks: Record<string, number> = {};
      const feedback: Record<string, string> = {};
      ev.questions.forEach((q) => {
        marks[q.id] = q.facultyAwarded ?? q.totalAwarded;
        feedback[q.id] = q.facultyFeedback ?? q.feedback;
      });
      setFacultyMarks(marks);
      setFacultyFeedback(feedback);
      setFacultyNotes(ev.facultyNotes ?? '');
    }
  }, [evalId, evaluations]);

  if (!evaluation) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-slate-500 mt-3 text-sm">Loading evaluation…</p>
        </div>
      </div>
    );
  }

  const submission = submissions.find((s) => s.id === evaluation.submissionId);
  const pages = submission?.pages ?? [];
  const currentQuestion = evaluation.questions[selectedQuestion];
  const isPublished = evaluation.status === 'PUBLISHED';

  const totalFacultyMarks = evaluation.questions.reduce(
    (sum, q) => sum + (facultyMarks[q.id] ?? q.totalAwarded),
    0
  );

  function handleMarkChange(qId: string, value: string) {
    const num = parseFloat(value);
    const question = evaluation!.questions.find((q) => q.id === qId);
    if (!question) return;
    const err = validateFacultyMarks(num, question.maxMarks, `Q${question.questionNumber}`);
    setErrors((prev) => ({ ...prev, [qId]: err ?? '' }));
    setFacultyMarks((prev) => ({ ...prev, [qId]: isNaN(num) ? 0 : num }));
  }

  async function handleSaveDraft() {
    setSaving(true);
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) {
      showToast('Please fix mark errors before saving.', 'error');
      setSaving(false);
      return;
    }

    const updatedEval: Evaluation = {
      ...evaluation!,
      status: 'FACULTY_REVIEW',
      facultyTotalMarks: totalFacultyMarks,
      facultyNotes,
      facultyReviewedAt: new Date().toISOString(),
      facultyId: state.currentUser?.id ?? '',
      facultyName: state.currentUser?.name ?? '',
      questions: evaluation!.questions.map((q) => ({
        ...q,
        facultyAwarded: facultyMarks[q.id] ?? q.totalAwarded,
        facultyFeedback: facultyFeedback[q.id] ?? q.feedback,
      })),
    };

    await new Promise((r) => setTimeout(r, 600));
    updateEvaluation(updatedEval);
    setEvaluation(updatedEval as Evaluation);
    showToast('Draft saved successfully.', 'success');
    setSaving(false);
  }

  async function handlePublish() {
    if (!evaluation) return;
    setPublishing(true);
    const hasErrors = Object.values(errors).some(Boolean);
    if (hasErrors) {
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
      questions: evaluation.questions.map((q) => ({
        ...q,
        facultyAwarded: facultyMarks[q.id] ?? q.totalAwarded,
        facultyFeedback: facultyFeedback[q.id] ?? q.feedback,
      })),
    };

    await new Promise((r) => setTimeout(r, 800));
    updateEvaluation(updatedEval);
    publishEvaluation(evaluation.id, facultyNotes);
    setEvaluation(updatedEval as Evaluation);
    setPublishing(false);
    setPublishModal(false);
    showToast(`Result published for ${evaluation.studentName}.`, 'success');
  }

  const ZOOM_LEVELS: ZoomLevel[] = [0.5, 0.75, 1, 1.25, 1.5];
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom);

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 z-10">
        <button
          onClick={() => navigate('f-reviews')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mr-2"
        >
          ← Back
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{evaluation.studentName}</span>
            <span className="text-slate-400 text-sm">·</span>
            <span className="text-sm text-slate-600 truncate">{evaluation.examTitle}</span>
            <StatusBadge status={evaluation.status} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceBadge level={evaluation.overallConfidenceLevel} score={evaluation.overallConfidence} />
          {!isPublished && (
            <>
              <Button size="sm" variant="secondary" loading={saving} onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button size="sm" variant="gold" onClick={() => setPublishModal(true)}>
                Approve &amp; Publish
              </Button>
            </>
          )}
          {isPublished && <Badge variant="success">Published</Badge>}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Image viewer */}
        <div className="flex flex-col bg-slate-800 border-r border-slate-700" style={{ width: '45%', minWidth: 320 }}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-700">
            <span className="text-slate-400 text-xs font-medium">
              Page {selectedPage + 1} / {pages.length}
            </span>
            <div className="flex-1" />
            {/* Zoom */}
            <button
              onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIdx - 1)])}
              disabled={zoomIdx === 0}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-white text-sm disabled:opacity-30 hover:bg-slate-600"
            >
              −
            </button>
            <span className="text-slate-400 text-xs w-10 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIdx + 1)])}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-white text-sm disabled:opacity-30 hover:bg-slate-600"
            >
              +
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            {/* Rotate */}
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 text-white text-sm hover:bg-slate-600"
              title="Rotate 90°"
            >
              ↻
            </button>
            <button
              onClick={() => setShowTranscription(!showTranscription)}
              className={`px-2 h-7 rounded text-xs font-medium transition-colors ${showTranscription ? 'bg-navy-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              Transcription
            </button>
          </div>

          {/* Image area */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            {pages.length > 0 ? (
              <div style={{ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}>
                <img
                  src={pages[selectedPage]?.imageUrl}
                  alt={`Page ${selectedPage + 1}`}
                  className="rounded-lg shadow-xl max-w-full"
                  style={{ minWidth: 280 }}
                />
              </div>
            ) : (
              <div className="text-slate-500 text-sm text-center py-12">
                No pages available
              </div>
            )}
          </div>

          {/* Transcription panel */}
          {showTranscription && (
            <div className="border-t border-slate-700 p-3 max-h-48 overflow-y-auto">
              <p className="text-xs text-slate-400 font-medium mb-2">AI Transcription</p>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {evaluation.transcription}
              </p>
            </div>
          )}

          {/* Page thumbnails */}
          <div className="border-t border-slate-700 px-3 py-2 flex gap-2 overflow-x-auto">
            {pages.map((page, i) => (
              <button
                key={page.id}
                onClick={() => setSelectedPage(i)}
                className={`shrink-0 rounded overflow-hidden border-2 transition-all ${i === selectedPage ? 'border-gold-400' : 'border-transparent opacity-60 hover:opacity-80'}`}
              >
                <img
                  src={page.thumbnailUrl}
                  alt={`Page ${i + 1}`}
                  className="w-12 h-16 object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Evaluation panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Question nav */}
          <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-slate-200 overflow-x-auto shrink-0">
            {evaluation.questions.map((q, i) => {
              const awarded = facultyMarks[q.id] ?? q.totalAwarded;
              const hasFlag = q.flags.length > 0;
              const hasError = !!errors[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestion(i)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${i === selectedQuestion ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} ${hasError ? 'ring-1 ring-red-400' : ''}`}
                >
                  Q{q.questionNumber}
                  {hasFlag && <span className="text-amber-400">⚠</span>}
                  <span className={`font-mono ${i === selectedQuestion ? 'text-white/80' : 'text-slate-400'}`}>
                    {awarded}/{q.maxMarks}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Question detail */}
          <div ref={rightPanelRef} className="flex-1 overflow-y-auto">
            {currentQuestion && (
              <div className="p-5 space-y-5">
                {/* Question header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-lg font-semibold text-slate-900">
                        Question {currentQuestion.questionNumber}
                      </span>
                      <span className="font-mono text-sm text-slate-400">
                        Max: {currentQuestion.maxMarks} marks
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ConfidenceBadge level={currentQuestion.confidenceLevel} score={currentQuestion.confidence} />
                      {currentQuestion.flags.map((f) => (
                        <FlagBadge key={f} flag={f} />
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-3xl font-semibold font-mono ${pct(facultyMarks[currentQuestion.id] ?? currentQuestion.totalAwarded, currentQuestion.maxMarks) >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {pct(facultyMarks[currentQuestion.id] ?? currentQuestion.totalAwarded, currentQuestion.maxMarks)}%
                    </p>
                  </div>
                </div>

                {/* AI Transcription of this answer */}
                <Card className="bg-slate-50 border-slate-200" padding={false}>
                  <div className="px-4 py-3 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      AI Transcription — Student Answer
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {currentQuestion.studentAnswer}
                    </p>
                    {currentQuestion.answerSummary && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-400 font-medium mb-1">AI Summary</p>
                        <p className="text-xs text-slate-600 italic">{currentQuestion.answerSummary}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Criteria scoring */}
                <Card>
                  <h3 className="font-semibold text-slate-900 text-sm mb-4">Criterion Scoring</h3>
                  <div className="space-y-4">
                    {currentQuestion.criteriaScores.map((cs) => (
                      <div key={cs.criterionId} className="pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <p className="text-sm text-slate-700 flex-1">{cs.criterion}</p>
                          <span className="text-xs text-slate-400 font-mono shrink-0">
                            AI: {cs.awarded}/{cs.max}
                          </span>
                        </div>
                        <ScoreBar awarded={cs.awarded} max={cs.max} />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Faculty marks override */}
                <Card className={`border-2 ${isPublished ? 'border-emerald-200 bg-emerald-50' : 'border-gold-200 bg-gold-50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-400' : 'bg-gold-500'}`} />
                    <h3 className="font-semibold text-sm text-slate-900">
                      {isPublished ? 'Faculty-Approved Marks' : 'Faculty Mark Override'}
                    </h3>
                  </div>
                  <div className="flex items-end gap-3 mb-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-600 font-medium">Marks awarded</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={currentQuestion.maxMarks}
                          step="0.5"
                          value={facultyMarks[currentQuestion.id] ?? currentQuestion.totalAwarded}
                          onChange={(e) => handleMarkChange(currentQuestion.id, e.target.value)}
                          disabled={isPublished}
                          className={`w-20 h-10 px-3 rounded-lg border text-center font-mono font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-gold-500 ${errors[currentQuestion.id] ? 'border-red-400 bg-red-50' : 'border-gold-300 bg-white'} ${isPublished ? 'opacity-70' : ''}`}
                        />
                        <span className="text-slate-500 font-medium text-lg">/ {currentQuestion.maxMarks}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <ProgressBar
                        value={facultyMarks[currentQuestion.id] ?? currentQuestion.totalAwarded}
                        max={currentQuestion.maxMarks}
                        color={pct(facultyMarks[currentQuestion.id] ?? currentQuestion.totalAwarded, currentQuestion.maxMarks) >= 75 ? 'emerald' : 'amber'}
                      />
                    </div>
                  </div>
                  {errors[currentQuestion.id] && (
                    <p className="text-xs text-red-600 mt-1">{errors[currentQuestion.id]}</p>
                  )}
                </Card>

                {/* AI Feedback */}
                <Card>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Feedback</h3>
                  <div className="mb-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-400 font-medium mb-1">AI Suggested Feedback</p>
                    <p className="text-sm text-slate-700">{currentQuestion.feedback}</p>
                  </div>
                  {!isPublished ? (
                    <Textarea
                      label="Faculty Feedback (optional)"
                      placeholder="Add or modify feedback for the student…"
                      rows={3}
                      value={facultyFeedback[currentQuestion.id] ?? ''}
                      onChange={(e) =>
                        setFacultyFeedback((prev) => ({
                          ...prev,
                          [currentQuestion.id]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-xs text-emerald-600 font-medium mb-1">Published Feedback</p>
                      <p className="text-sm text-slate-700">
                        {facultyFeedback[currentQuestion.id] ?? currentQuestion.feedback}
                      </p>
                    </div>
                  )}
                </Card>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={selectedQuestion === 0}
                    onClick={() => setSelectedQuestion((n) => n - 1)}
                  >
                    ← Previous
                  </Button>
                  <span className="text-xs text-slate-400">
                    {selectedQuestion + 1} of {evaluation.questions.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={selectedQuestion === evaluation.questions.length - 1}
                    onClick={() => setSelectedQuestion((n) => n + 1)}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer summary */}
          <div className="border-t border-slate-200 bg-white px-5 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-slate-400">AI Total</p>
                  <p className="font-mono font-semibold text-slate-900">
                    {evaluation.totalMarks}/{evaluation.maxMarks}
                  </p>
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-400">Faculty Total</p>
                  <p className={`font-mono font-semibold ${totalFacultyMarks !== evaluation.totalMarks ? 'text-gold-700' : 'text-slate-900'}`}>
                    {totalFacultyMarks}/{evaluation.maxMarks}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Percentage</p>
                  <p className="font-mono font-semibold text-slate-900">
                    {pct(totalFacultyMarks, evaluation.maxMarks)}%
                  </p>
                </div>
              </div>
              {!isPublished && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" loading={saving} onClick={handleSaveDraft}>
                    Save Draft
                  </Button>
                  <Button size="sm" variant="gold" onClick={() => setPublishModal(true)}>
                    Publish Result
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Publish confirmation modal */}
      <Modal
        open={publishModal}
        onClose={() => setPublishModal(false)}
        title="Publish Evaluation Result"
      >
        <div className="space-y-4">
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <span className="font-medium">Once published, the student can see this result.</span>{' '}
              Ensure all marks are correct before proceeding.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Student</p>
              <p className="font-medium text-slate-800 text-sm">{evaluation.studentName}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Final Score</p>
              <p className="font-mono font-semibold text-slate-900">
                {totalFacultyMarks}/{evaluation.maxMarks}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-400 mb-1">Percentage</p>
              <p className="font-mono font-semibold text-slate-900">
                {pct(totalFacultyMarks, evaluation.maxMarks)}%
              </p>
            </div>
          </div>

          <Textarea
            label="Faculty notes (optional — visible to student)"
            placeholder="Any overall comments or notes for the student…"
            rows={3}
            value={facultyNotes}
            onChange={(e) => setFacultyNotes(e.target.value)}
          />

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setPublishModal(false)}>
              Cancel
            </Button>
            <Button variant="gold" className="flex-1" loading={publishing} onClick={handlePublish}>
              Confirm &amp; Publish
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
