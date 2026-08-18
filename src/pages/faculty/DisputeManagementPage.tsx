import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Badge, Textarea, Modal, EmptyState, Tabs } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { DisputeRequest, DisputeStatus } from '../../types';

function statusVariant(status: DisputeStatus) {
  if (status === 'OPEN') return 'warning';
  if (status === 'UNDER_REVIEW') return 'info';
  if (status === 'RESOLVED') return 'success';
  return 'danger';
}

function statusLabel(status: DisputeStatus) {
  if (status === 'OPEN') return 'Open';
  if (status === 'UNDER_REVIEW') return 'Under Review';
  if (status === 'RESOLVED') return 'Resolved';
  return 'Rejected';
}

export default function DisputeManagementPage() {
  const { state, resolveDispute, showToast } = useApp();
  const { currentUser, disputes, evaluations } = state;

  const [tab, setTab] = useState('pending');
  const [selected, setSelected] = useState<DisputeRequest | null>(null);
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);

  if (!currentUser) return null;

  const pending = disputes.filter((d) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW');
  const closed = disputes.filter((d) => d.status === 'RESOLVED' || d.status === 'REJECTED');

  const displayed = tab === 'pending' ? pending : closed;

  const selectedEval = selected ? evaluations.find((e) => e.id === selected.evaluationId) : null;

  async function handleResolve(action: 'RESOLVED' | 'REJECTED') {
    if (!selected) return;
    if (!resolution.trim()) {
      showToast('Please provide a resolution note.', 'error');
      return;
    }
    setResolving(true);
    await new Promise((r) => setTimeout(r, 700));
    resolveDispute(selected.id, resolution.trim(), action);
    setResolving(false);
    showToast(
      action === 'RESOLVED' ? 'Dispute resolved successfully.' : 'Dispute rejected.',
      action === 'RESOLVED' ? 'success' : 'error'
    );
    setSelected(null);
    setResolution('');
  }

  return (
    <PageContainer>
      <PageHeader
        title="Dispute Management"
        subtitle="Review and respond to student mark disputes."
        breadcrumb="Faculty"
      />

      <div className="mb-6">
        <Tabs
          tabs={[
            { key: 'pending', label: `Pending (${pending.length})` },
            { key: 'closed', label: `Closed (${closed.length})` },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          icon="⚡"
          title={tab === 'pending' ? 'No pending disputes' : 'No closed disputes'}
          description={
            tab === 'pending'
              ? 'All student disputes have been addressed.'
              : 'No disputes have been resolved or rejected yet.'
          }
        />
      ) : (
        <div className="space-y-4">
          {displayed.map((d) => {
            const eval_ = evaluations.find((e) => e.id === d.evaluationId);
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={statusVariant(d.status)}>{statusLabel(d.status)}</Badge>
                      <span className="text-xs text-slate-400">
                        Filed {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900">{d.studentName}</p>
                    <p className="text-sm text-slate-600">{d.examTitle}</p>
                    {eval_ && (
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">
                        Score: {eval_.facultyTotalMarks ?? eval_.totalMarks}/{eval_.maxMarks}
                      </p>
                    )}
                    <p className="text-sm text-slate-700 mt-2 line-clamp-2">{d.reason}</p>
                    {d.questionNumbers.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        Questions: {d.questionNumbers.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {(d.status === 'OPEN' || d.status === 'UNDER_REVIEW') && (
                      <Button size="sm" onClick={() => { setSelected(d); setResolution(''); }}>
                        Review
                      </Button>
                    )}
                    {(d.status === 'RESOLVED' || d.status === 'REJECTED') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setSelected(d); setResolution(d.resolution ?? ''); }}
                      >
                        View
                      </Button>
                    )}
                  </div>
                </div>

                {(d.status === 'RESOLVED' || d.status === 'REJECTED') && d.resolution && (
                  <div
                    className={`mt-3 rounded-lg p-3 text-sm ${
                      d.status === 'RESOLVED'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                  >
                    <p className="font-medium mb-0.5">{d.status === 'RESOLVED' ? 'Resolution' : 'Rejection Reason'}</p>
                    <p>{d.resolution}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setResolution(''); }}
        title="Review Dispute"
      >
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 shrink-0">Student</span>
                <span className="font-medium text-slate-900">{selected.studentName}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 shrink-0">Exam</span>
                <span className="font-medium text-slate-900">{selected.examTitle}</span>
              </div>
              {selectedEval && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-28 shrink-0">Published Score</span>
                  <span className="font-mono font-medium text-slate-900">
                    {selectedEval.facultyTotalMarks ?? selectedEval.totalMarks}/{selectedEval.maxMarks}
                  </span>
                </div>
              )}
              {selected.questionNumbers.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-28 shrink-0">Questions</span>
                  <span className="font-medium text-slate-900">{selected.questionNumbers.join(', ')}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-1">Student Reason</p>
              <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {selected.reason}
              </p>
            </div>

            {selected.status === 'OPEN' || selected.status === 'UNDER_REVIEW' ? (
              <>
                <Textarea
                  label="Resolution / Rejection Note *"
                  placeholder="Explain your decision. If resolving, describe what was changed or confirmed correct. If rejecting, state why the original marks stand."
                  rows={4}
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="danger"
                    className="flex-1"
                    loading={resolving}
                    disabled={!resolution.trim()}
                    onClick={() => handleResolve('REJECTED')}
                  >
                    Reject Dispute
                  </Button>
                  <Button
                    className="flex-1"
                    loading={resolving}
                    disabled={!resolution.trim()}
                    onClick={() => handleResolve('RESOLVED')}
                  >
                    Resolve Dispute
                  </Button>
                </div>
              </>
            ) : (
              <div
                className={`rounded-lg p-3 text-sm ${
                  selected.status === 'RESOLVED'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                <p className="font-medium mb-1">
                  {selected.status === 'RESOLVED' ? 'Resolved' : 'Rejected'} by {selected.facultyName}
                </p>
                <p>{selected.resolution}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
