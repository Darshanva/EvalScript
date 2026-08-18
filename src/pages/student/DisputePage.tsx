import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge, Textarea, Select, Modal, EmptyState } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { DisputeStatus } from '../../types';

function disputeStatusVariant(status: DisputeStatus) {
  if (status === 'OPEN') return 'warning';
  if (status === 'UNDER_REVIEW') return 'info';
  if (status === 'RESOLVED') return 'success';
  return 'danger';
}

function disputeStatusLabel(status: DisputeStatus) {
  if (status === 'OPEN') return 'Open';
  if (status === 'UNDER_REVIEW') return 'Under Review';
  if (status === 'RESOLVED') return 'Resolved';
  return 'Rejected';
}

export default function DisputePage() {
  const { state, submitDispute, showToast } = useApp();
  const { currentUser, disputes, evaluations, submissions } = state;

  const [showForm, setShowForm] = useState(false);
  const [selectedEvalId, setSelectedEvalId] = useState('');
  const [reason, setReason] = useState('');
  const [questionNums, setQuestionNums] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser) return null;

  const myDisputes = disputes.filter((d) => d.studentId === currentUser.id);

  const publishedEvals = evaluations.filter((e) => {
    const sub = submissions.find((s) => s.evaluationId === e.id);
    return e.studentId === currentUser.id && e.status === 'PUBLISHED' && sub;
  });

  const evalOptions = publishedEvals.map((e) => ({
    value: e.id,
    label: `${e.examTitle} — ${e.totalMarks}/${e.maxMarks} marks`,
  }));

  async function handleSubmit() {
    if (!selectedEvalId || !reason.trim()) {
      showToast('Please select an evaluation and provide a reason.', 'error');
      return;
    }
    const eval_ = evaluations.find((e) => e.id === selectedEvalId);
    if (!eval_) return;

    const alreadyOpen = disputes.find(
      (d) => d.evaluationId === selectedEvalId && (d.status === 'OPEN' || d.status === 'UNDER_REVIEW')
    );
    if (alreadyOpen) {
      showToast('A dispute is already open for this evaluation.', 'error');
      return;
    }

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    submitDispute({
      studentId: currentUser!.id,
      studentName: currentUser!.name,
      evaluationId: selectedEvalId,
      examTitle: eval_.examTitle,
      reason: reason.trim(),
      questionNumbers: questionNums
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    setShowForm(false);
    setSelectedEvalId('');
    setReason('');
    setQuestionNums('');
    showToast('Dispute submitted. Faculty will review it soon.', 'success');
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Disputes"
        subtitle="Request a review if you believe marks were awarded incorrectly."
        breadcrumb="Student"
        action={
          publishedEvals.length > 0 ? (
            <Button onClick={() => setShowForm(true)}>+ New Dispute</Button>
          ) : undefined
        }
      />

      {myDisputes.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="No disputes filed"
          description="If you believe your published result contains an error, you can raise a dispute here."
          action={
            publishedEvals.length > 0 ? (
              <Button onClick={() => setShowForm(true)}>File a Dispute</Button>
            ) : (
              <p className="text-sm text-slate-400">No published results to dispute yet.</p>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {myDisputes.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={disputeStatusVariant(d.status)}>
                      {disputeStatusLabel(d.status)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Filed {new Date(d.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900">{d.examTitle}</p>
                  <p className="text-sm text-slate-600 mt-1">{d.reason}</p>
                  {d.questionNumbers.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Questions: {d.questionNumbers.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {(d.status === 'RESOLVED' || d.status === 'REJECTED') && d.resolution && (
                <div
                  className={`mt-4 rounded-lg p-3 text-sm ${
                    d.status === 'RESOLVED'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  <p className="font-medium mb-1">
                    {d.status === 'RESOLVED' ? 'Resolution' : 'Rejection Reason'}
                  </p>
                  <p>{d.resolution}</p>
                  {d.resolvedAt && (
                    <p className="text-xs mt-1 opacity-70">
                      {new Date(d.resolvedAt).toLocaleDateString()} by {d.facultyName}
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="File a Dispute">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Disputes are reviewed by faculty. Please provide a clear, specific reason. Frivolous disputes may be rejected.
          </div>

          <Select
            label="Select Evaluation *"
            options={[{ value: '', label: 'Choose an evaluation…' }, ...evalOptions]}
            value={selectedEvalId}
            onChange={(e) => setSelectedEvalId(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Question Numbers (optional)
            </label>
            <input
              type="text"
              className="w-full h-10 px-3 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-navy-700"
              placeholder="e.g. 1, 2a, 3 (comma-separated)"
              value={questionNums}
              onChange={(e) => setQuestionNums(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Leave blank if disputing the entire paper.</p>
          </div>

          <Textarea
            label="Reason for Dispute *"
            placeholder="Explain clearly why you believe the marks are incorrect. Reference specific criteria or expected answers where possible."
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={submitting}
              disabled={!selectedEvalId || !reason.trim()}
              onClick={handleSubmit}
            >
              Submit Dispute
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
