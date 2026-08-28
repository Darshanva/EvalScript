import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Spinner, Modal } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { StepIndicator } from '../../components/ui';
import type { Submission, SubmissionPage } from '../../types';
import { uploadAnswerPage } from '../../lib/storage';

type WizardStep = 'select-exam' | 'upload' | 'review' | 'confirm' | 'submitted';

interface PageItem {
  id: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl: string;
  fileName: string;
}

export default function SubmitExamPage() {
  const routerNavigate = useNavigate();
  const {
    state,
    getExamsForCurrentUser,
    getSubmissionsForCurrentUser,
    submitExam,
    processEvaluation,
    showToast,
  } = useApp();
  const { currentUser, navCtx } = state;

  const [step, setStep] = useState<WizardStep>(
    navCtx.selectedExamId ? 'upload' : 'select-exam'
  );
  const [selectedExamId, setSelectedExamId] = useState<string>(
    navCtx.selectedExamId ?? ''
  );
  const [pages, setPages] = useState<PageItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const exams = getExamsForCurrentUser().filter(
    (e) => (e.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  const submissions = getSubmissionsForCurrentUser();
  const submittedExamIds = new Set(submissions.map((s) => s.examId));
  const availableExams = exams.filter((e) => !submittedExamIds.has(e.id));
  const selectedExam = exams.find((e) => e.id === selectedExamId);

  const STEPS = ['Select Exam', 'Upload Pages', 'Review', 'Submit'];
  const stepIndex =
    { 'select-exam': 0, upload: 1, review: 2, confirm: 3, submitted: 3 }[step] ?? 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const max = state.systemSettings.maxPagesPerSubmission || 30;
    if (pages.length + files.length > max) {
      showToast(`Max ${max} pages allowed`, 'error');
      return;
    }

    setUploading(true);
    const newPages: PageItem[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          showToast(`${file.name} is not an image`, 'error');
          continue;
        }

        const pageNumber = pages.length + newPages.length + 1;
        const tempId = `page-${Date.now()}-${i}`;

        // Local preview first (real file — never demo URL)
        const localUrl = URL.createObjectURL(file);

        let publicUrl = localUrl;
        try {
          publicUrl = await uploadAnswerPage(
            file,
            `pending-${currentUser!.id}`,
            pageNumber
          );
          // Prefer storage URL; revoke blob
          if (publicUrl && publicUrl !== localUrl) {
            URL.revokeObjectURL(localUrl);
          }
        } catch (uploadErr) {
          console.warn('Storage upload failed, keeping local preview', uploadErr);
          // Keep blob URL so user still sees THEIR file
          publicUrl = localUrl;
          showToast(
            'Cloud upload failed for one page — preview is local only',
            'error'
          );
        }

        // Guard: never accept unsplash / stock
        if (
          publicUrl.includes('unsplash.com') ||
          publicUrl.includes('placeholder')
        ) {
          publicUrl = localUrl;
        }

        newPages.push({
          id: tempId,
          pageNumber,
          imageUrl: publicUrl,
          thumbnailUrl: publicUrl,
          fileName: file.name,
        });
      }

      if (newPages.length) {
        setPages((prev) => [...prev, ...newPages]);
        showToast(`${newPages.length} page(s) added`, 'success');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removePage(id: string) {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.imageUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.imageUrl);
        } catch {
          /* ignore */
        }
      }
      return prev
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, pageNumber: i + 1 }));
    });
  }

  function movePage(id: string, dir: -1 | 1) {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx + dir < 0 || idx + dir >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return arr.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    });
  }

  async function handleSubmit() {
    if (!selectedExam || pages.length === 0) return;
    setSubmitting(true);

    try {
      const submissionId = `sub-${Date.now()}`;

      const finalPages: SubmissionPage[] = pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        imageUrl: p.imageUrl,
        thumbnailUrl: p.thumbnailUrl,
      }));

      const submission: Submission = {
        id: submissionId,
        studentId: currentUser!.id,
        studentName: currentUser!.name,
        examId: selectedExam.id,
        examTitle: selectedExam.title,
        examCode: selectedExam.code,
        submittedAt: new Date().toISOString(),
        pages: finalPages,
        status: 'SUBMITTED',
        pageCount: finalPages.length,
      };

      await submitExam(submission);

      setTimeout(() => {
        processEvaluation(submission.id);
      }, 400);

      setStep('submitted');
      setConfirmModal(false);
      showToast('Exam submitted. AI processing started.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'submitted') {
    return (
      <PageContainer>
        <div className="max-w-lg mx-auto text-center py-12">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 text-3xl mx-auto mb-6">
            ✓
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Submission Received
          </h2>
          <p className="text-slate-500 mb-6">
            Your answer sheet for <strong>{selectedExam?.title}</strong> has been
            submitted. AI is processing your answers.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => routerNavigate('/student')}
            >
              Back to Dashboard
            </Button>
            <Button onClick={() => routerNavigate('/student/results')}>
              View Submissions
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Submit Exam"
        subtitle="Upload your handwritten answer sheets for AI evaluation."
        breadcrumb="Student Portal"
      />

      <div className="mb-8 max-w-2xl">
        <StepIndicator steps={STEPS} current={stepIndex} />
      </div>

      {step === 'select-exam' && (
        <div className="max-w-xl">
          <h2 className="font-semibold text-slate-900 mb-4">
            Which exam are you submitting?
          </h2>
          {availableExams.length === 0 ? (
            <Card>
              <p className="text-slate-500 text-center py-6">
                No exams available for submission.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {availableExams.map((exam) => (
                <button
                  key={exam.id}
                  type="button"
                  onClick={() => {
                    setSelectedExamId(exam.id);
                    setStep('upload');
                  }}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white px-5 py-4 hover:border-navy-400 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{exam.title}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {exam.code} · {exam.subject} · {exam.facultyName}
                      </p>
                    </div>
                    <span className="text-slate-400 group-hover:text-navy-600">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => routerNavigate('/student')}
          >
            ← Back
          </Button>
        </div>
      )}

      {step === 'upload' && selectedExam && (
        <div className="max-w-2xl">
          <div className="px-4 py-3 bg-navy-50 border border-navy-200 rounded-xl mb-5 flex items-center gap-3">
            <div className="text-navy-600 text-lg">◉</div>
            <div>
              <p className="font-medium text-navy-900 text-sm">
                {selectedExam.title}
              </p>
              <p className="text-xs text-navy-600">
                {selectedExam.code} · Max {selectedExam.maxMarks} marks
              </p>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-slate-700 mb-2">
              Uploaded pages ({pages.length} /{' '}
              {state.systemSettings.maxPagesPerSubmission || 30} max)
            </p>

            {pages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-4">
                {pages.map((page) => (
                  <div
                    key={page.id}
                    className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-[3/4] bg-white"
                  >
                    <img
                      src={page.imageUrl}
                      alt={page.fileName || `Page ${page.pageNumber}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => movePage(page.id, -1)}
                          className="w-6 h-6 bg-white/80 rounded text-xs"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => movePage(page.id, 1)}
                          className="w-6 h-6 bg-white/80 rounded text-xs"
                        >
                          →
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePage(page.id)}
                        className="w-6 h-6 bg-red-500 rounded text-xs text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs text-center py-0.5">
                      {page.pageNumber}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {uploading ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center gap-3">
              <Spinner size="lg" />
              <p className="text-sm text-slate-600">Uploading…</p>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                dragging
                  ? 'border-navy-500 bg-navy-50'
                  : 'border-slate-300 bg-white hover:border-navy-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-2xl">
                ↑
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-700 text-sm">
                  Drop image files here
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  or click · JPG, PNG — your file is shown, not a demo image
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button variant="ghost" onClick={() => setStep('select-exam')}>
              ← Back
            </Button>
            <Button
              disabled={pages.length === 0}
              onClick={() => setStep('review')}
            >
              Review pages →
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && selectedExam && (
        <div className="max-w-2xl">
          <Card className="mb-5">
            <h3 className="font-semibold text-slate-900 mb-4">
              Review your submission
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Exam</p>
                <p className="font-medium text-slate-800">{selectedExam.title}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-0.5">Pages</p>
                <p className="font-medium text-slate-800">{pages.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className="relative rounded-lg overflow-hidden border border-slate-200 aspect-[3/4] bg-white"
                >
                  <img
                    src={page.imageUrl}
                    alt={page.fileName}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs text-center py-0.5">
                    {page.pageNumber}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-5">
            <p className="text-sm text-amber-800">
              <span className="font-medium">
                Once submitted, you cannot modify your answers.
              </span>
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep('upload')}>
              ← Edit pages
            </Button>
            <Button onClick={() => setConfirmModal(true)}>
              Submit for Evaluation
            </Button>
          </div>

          <Modal
            open={confirmModal}
            onClose={() => setConfirmModal(false)}
            title="Confirm Submission"
          >
            <p className="text-sm text-slate-600 mb-6">
              Submit <strong>{pages.length}</strong> page
              {pages.length !== 1 ? 's' : ''} for{' '}
              <strong>{selectedExam.title}</strong>?
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                loading={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting…' : 'Confirm & Submit'}
              </Button>
            </div>
          </Modal>
        </div>
      )}
    </PageContainer>
  );
}