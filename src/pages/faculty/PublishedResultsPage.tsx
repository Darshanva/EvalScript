import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  Badge,
  EmptyState,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Evaluation } from '../../types';
import {
  loadPublishRights,
  canFacultyPublish,
  resultGroupKey,
  type PublishRight,
} from '../../lib/publish-rights';

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function grade(p: number) {
  if (p >= 90) return 'A';
  if (p >= 75) return 'B';
  if (p >= 60) return 'C';
  if (p >= 50) return 'D';
  return 'F';
}

function extractSection(description?: string, title?: string): string {
  const blob = `${description || ''} ${title || ''}`;
  const m =
    blob.match(/Section\s*([A-Fa-f])/i) ||
    blob.match(/\bSec\s*([A-Fa-f])\b/i);
  return m ? m[1].toUpperCase() : '';
}

export default function PublishedResultsPage() {
  const navigate = useNavigate();
  const { state, publishEvaluation, showToast, getEvaluationsForCurrentUser } =
    useApp();
  const { currentUser, exams } = state;

  const [rights, setRights] = useState<PublishRight[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    loadPublishRights().then(setRights);
    const onUpd = () => loadPublishRights().then(setRights);
    window.addEventListener('publish-rights-updated', onUpd);
    return () => window.removeEventListener('publish-rights-updated', onUpd);
  }, []);

  if (!currentUser) return null;

  // Ready to publish OR already published (faculty's exams)
  const allEvals = getEvaluationsForCurrentUser().filter(
    (e) =>
      e.status === 'PUBLISHED' ||
      e.status === 'AI_COMPLETE' ||
      e.status === 'FACULTY_REVIEW' ||
      e.status === 'REVIEWED'
  );

  const groups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; examId: string; examTitle: string; count: number; path: string }
    >();
    allEvals.forEach((ev) => {
      const exam = exams.find((x) => x.id === ev.examId);
      const sec = extractSection(exam?.description, ev.examTitle);
      const code = exam?.code || 'EXAM';
      const key = resultGroupKey(code, sec);
      const prev = map.get(key);
      map.set(key, {
        key,
        examId: ev.examId,
        examTitle: ev.examTitle || exam?.title || code,
        count: (prev?.count || 0) + 1,
        path: exam?.description || '',
      });
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [allEvals, exams]);

  const groupRows = useMemo(() => {
    if (!selectedGroup) return [];
    return allEvals.filter((ev) => {
      const exam = exams.find((x) => x.id === ev.examId);
      const sec = extractSection(exam?.description, ev.examTitle);
      const code = exam?.code || 'EXAM';
      return resultGroupKey(code, sec) === selectedGroup;
    });
  }, [selectedGroup, allEvals, exams]);

  const selectedMeta = groups.find((g) => g.key === selectedGroup);
  const allowPublish =
    !!currentUser &&
    !!selectedMeta &&
    canFacultyPublish(
      rights,
      currentUser.id,
      `${selectedMeta.path} ${selectedMeta.examTitle} ${selectedMeta.key}`
    );

  async function handlePublishOne(ev: Evaluation) {
    if (!allowPublish) {
      showToast('No publish access — contact Admin', 'error');
      return;
    }
    if (ev.status === 'PUBLISHED') {
      showToast('Already published', 'info');
      return;
    }
    setPublishingId(ev.id);
    try {
      await publishEvaluation(ev.id, '');
      showToast(`Published for ${ev.studentName}`, 'success');
    } catch {
      showToast('Publish failed', 'error');
    } finally {
      setPublishingId(null);
    }
  }

  // ——— Level 1: group cards (14A, 14B…) ———
  if (!selectedGroup) {
    return (
      <PageContainer>
        <PageHeader
          title="Published Results"
          subtitle="Select a result group (exam + section)."
          breadcrumb="Faculty"
        />

        {groups.length === 0 ? (
          <Card>
            <EmptyState
              title="No results yet"
              description="After AI / review, groups like 14A appear here."
              action={
                <Button size="sm" onClick={() => navigate('/faculty/reviews')}>
                  Go to Reviews
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setSelectedGroup(g.key)}
                className="p-6 rounded-xl border-2 border-slate-200 bg-white hover:border-navy-500 hover:shadow-md text-center transition-all"
              >
                <p className="text-2xl font-bold text-navy-900 tracking-wide">
                  {g.key}
                </p>
                <p className="text-xs text-slate-500 mt-2 truncate">
                  {g.examTitle}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {g.count} student{g.count !== 1 ? 's' : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </PageContainer>
    );
  }

  // ——— Level 2: table + Publish (access-controlled) ———
  return (
    <PageContainer>
      <PageHeader
        title={`Results › ${selectedGroup}`}
        subtitle={selectedMeta?.examTitle}
        breadcrumb="Faculty"
        showBack
        backTo="/faculty/results"
      />

      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => setSelectedGroup(null)}
      >
        ← Back to groups
      </Button>

      {/* Access indicator — faculty cannot toggle; Admin controls */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-slate-600">Publish access</span>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border-2 ${
            allowPublish
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-slate-100 text-slate-400'
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              allowPublish ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          />
          {allowPublish ? 'ON' : 'OFF'}
        </span>
        {!allowPublish && (
          <span className="text-xs text-slate-400">
            Admin must grant “Right to publish” for this client/batch/section
          </span>
        )}
      </div>

      {groupRows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 text-center py-10">No rows</p>
        </Card>
      ) : (
        <Card padding={false} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <th className="px-4 py-3">S.No</th>
                <th className="px-4 py-3">Name of the Student</th>
                <th className="px-4 py-3">Marks Obtained</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Pass / Fail</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Publish</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.map((ev, i) => {
                const marks = ev.facultyTotalMarks ?? ev.totalMarks;
                const p = pct(marks, ev.maxMarks);
                const g = grade(p);
                const pass = p >= 50;
                const isPub = ev.status === 'PUBLISHED';
                return (
                  <tr
                    key={ev.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {ev.studentName}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {marks}/{ev.maxMarks}
                    </td>
                    <td className="px-4 py-3 font-semibold">{g}</td>
                    <td className="px-4 py-3">
                      <Badge variant={pass ? 'success' : 'danger'}>
                        {pass ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {isPub ? 'Published' : ev.status}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        disabled={!allowPublish || isPub}
                        loading={publishingId === ev.id}
                        className={
                          !allowPublish
                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400 border-slate-200'
                            : ''
                        }
                        onClick={() => handlePublishOne(ev)}
                      >
                        {isPub ? 'Done' : 'Publish'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </PageContainer>
  );
}