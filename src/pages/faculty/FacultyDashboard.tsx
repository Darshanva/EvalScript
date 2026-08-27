import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  StatusBadge,
  Badge,
  StatCard,
  EmptyState,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Evaluation } from '../../types';

const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

function marksOf(ev: Evaluation): number {
  return ev.facultyTotalMarks ?? ev.totalMarks ?? 0;
}

function extractSectionLetter(
  examTitle: string,
  examCode: string,
  description?: string
): string {
  const blob = `${examTitle} ${examCode} ${description || ''}`;
  const m =
    blob.match(/Section\s*([A-Fa-f])/i) ||
    blob.match(/\bSec(?:tion)?\s*([A-Fa-f])\b/i) ||
    blob.match(/>\s*Section\s*([A-Fa-f])/i);
  if (m) return m[1].toUpperCase();
  return 'A';
}

function BarChart({
  title,
  headerRight,
  items,
  emptyText,
}: {
  title: React.ReactNode;
  headerRight?: React.ReactNode;
  items: { label: string; value: number }[];
  emptyText?: string;
}) {
  const peak = Math.max(...items.map((i) => i.value), 1);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {headerRight}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-10">
          {emptyText || 'No data yet'}
        </p>
      ) : (
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>Score</span>
            <span>max {peak}</span>
          </div>
          <div className="flex items-end gap-1.5 h-40 border-b border-l border-slate-200 pl-1">
            {items.map((item) => {
              const h = Math.max(6, Math.round((item.value / peak) * 100));
              return (
                <div
                  key={item.label}
                  className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group"
                >
                  <span className="text-[10px] font-mono text-slate-600 mb-0.5 opacity-0 group-hover:opacity-100">
                    {item.value}
                  </span>
                  <div
                    className="w-full max-w-[32px] mx-auto rounded-t bg-navy-600 hover:bg-navy-500"
                    style={{ height: `${h}%` }}
                    title={`${item.label}: ${item.value}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5 pt-1.5">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex-1 min-w-0 text-center text-[10px] text-slate-500 truncate"
              >
                {item.label}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            X-axis: labels · Y-axis: marks
          </p>
        </div>
      )}
    </Card>
  );
}

/** SEC label + small box with letter; click opens picker */
function SectionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <span className="text-sm font-semibold text-slate-800">SEC</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-md border-2 border-navy-600 bg-white text-navy-800 font-bold text-sm flex items-center justify-center hover:bg-navy-50 shadow-sm"
        title="Select section"
      >
        {value}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-[140px]">
            {SECTION_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className={`w-8 h-8 rounded-md text-sm font-bold ${
                  s === value
                    ? 'bg-navy-700 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function FacultyDashboard() {
  const navigate = useNavigate();
  const {
    state,
    getPendingReviewsForFaculty,
    getExamsForCurrentUser,
    getSubmissionsForCurrentUser,
    getEvaluationsForCurrentUser,
    deleteExam,
    showToast,
  } = useApp();
  const { currentUser, exams: allExams } = state;
  const [selectedSection, setSelectedSection] = useState('A');

  if (!currentUser) return null;

  const pending = getPendingReviewsForFaculty();
  const exams = getExamsForCurrentUser();
  const submissions = getSubmissionsForCurrentUser();
  const evaluations = getEvaluationsForCurrentUser();
  const published = evaluations.filter((e) => e.status === 'PUBLISHED');

  const analytics = useMemo(() => {
    const usable = evaluations.filter(
      (e) =>
        e.status === 'PUBLISHED' ||
        e.status === 'AI_COMPLETE' ||
        e.status === 'FACULTY_REVIEW'
    );

    const withSection = usable.map((ev) => {
      const exam = allExams.find((x) => x.id === ev.examId);
      const letter = extractSectionLetter(
        ev.examTitle || exam?.title || '',
        exam?.code || '',
        exam?.description
      );
      return { ev, letter, marks: marksOf(ev) };
    });

    const inSection = withSection.filter((x) => x.letter === selectedSection);

    // Top 10 in selected section
    const byStudent = new Map<
      string,
      { name: string; marks: number }
    >();
    inSection.forEach(({ ev, marks }) => {
      const key = ev.studentId || ev.studentName || ev.id;
      const prev = byStudent.get(key);
      if (!prev || marks > prev.marks) {
        byStudent.set(key, {
          name: (ev.studentName || 'Student').split(' ')[0],
          marks,
        });
      }
    });
    const top10 = [...byStudent.values()]
      .sort((a, b) => b.marks - a.marks)
      .slice(0, 10)
      .map((s) => ({ label: s.name, value: s.marks }));

    // Individual scores in section (avg chart bars)
    const sectionScores = inSection.map((x, i) => ({
      label: (x.ev.studentName || `S${i + 1}`).split(' ')[0].slice(0, 8),
      value: x.marks,
    }));

    // All sections average
    const sectionMap = new Map<string, number[]>();
    withSection.forEach(({ letter, marks }) => {
      const arr = sectionMap.get(letter) || [];
      arr.push(marks);
      sectionMap.set(letter, arr);
    });
    // Ensure A–F keys appear if empty
    SECTION_OPTIONS.forEach((s) => {
      if (!sectionMap.has(s)) sectionMap.set(s, []);
    });

    const sectionAvgs = SECTION_OPTIONS.map((label) => {
      const vals = sectionMap.get(label) || [];
      return {
        label: `Sec ${label}`,
        value: vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0,
      };
    }).filter((x) => x.value > 0 || (sectionMap.get(x.label.replace('Sec ', '')) || []).length > 0);

    // show all sections that have data, or all with 0 if none
    const avgAll =
      sectionAvgs.filter((x) => x.value > 0).length > 0
        ? sectionAvgs.filter((x) => {
            const letter = x.label.replace('Sec ', '');
            return (sectionMap.get(letter) || []).length > 0;
          })
        : SECTION_OPTIONS.map((l) => ({ label: `Sec ${l}`, value: 0 }));

    const sectionMedians = SECTION_OPTIONS.map((label) => {
      const vals = [...(sectionMap.get(label) || [])].sort((a, b) => a - b);
      if (!vals.length) return { label: `Sec ${label}`, value: 0 };
      const mid = Math.floor(vals.length / 2);
      const med =
        vals.length % 2
          ? vals[mid]
          : Math.round((vals[mid - 1] + vals[mid]) / 2);
      return { label: `Sec ${label}`, value: med };
    }).filter((x) => {
      const letter = x.label.replace('Sec ', '');
      return (sectionMap.get(letter) || []).length > 0;
    });

    return {
      top10,
      sectionScores,
      avgAll:
        avgAll.some((x) => x.value > 0)
          ? avgAll.filter((x) => x.value > 0 || true).filter((x) => {
              const letter = x.label.replace('Sec ', '');
              return (sectionMap.get(letter) || []).length > 0;
            })
          : [],
      sectionMedians,
      countInSection: inSection.length,
      usableCount: usable.length,
    };
  }, [evaluations, allExams, selectedSection]);

  async function handleDelete(examId: string, title: string) {
    if (!window.confirm(`Delete exam "${title}"?`)) return;
    try {
      await deleteExam(examId);
      showToast('Exam deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  }

  const secHeader = (
    <SectionPicker value={selectedSection} onChange={setSelectedSection} />
  );

  return (
    <PageContainer>
      <PageHeader
        title={`Hello, ${currentUser.name.split(' ').slice(-1)[0]}`}
        subtitle={`${currentUser.department || 'Faculty'} · Faculty Portal`}
        breadcrumb="Faculty"
        action={
          <div className="flex gap-2">
            {pending.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/faculty/reviews')}
              >
                Reviews ({pending.length})
              </Button>
            )}
            <Button onClick={() => navigate('/faculty/create-exam')}>
              + Create Exam
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Your Exams" value={String(exams.length)} icon="◎" />
        <StatCard
          label="Total Submissions"
          value={String(submissions.length)}
          icon="↑"
        />
        <StatCard
          label="Pending Reviews"
          value={String(pending.length)}
          icon="◎"
          hint={pending.length ? 'Requires attention' : undefined}
        />
        <StatCard
          label="Published Results"
          value={String(published.length)}
          icon="✓"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Analytics stack — replaces Pending Reviews area */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="font-semibold text-slate-900">Analytics</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live data · Section {selectedSection} · {analytics.countInSection}{' '}
              script{analytics.countInSection !== 1 ? 's' : ''} in this section
              {analytics.usableCount
                ? ` · ${analytics.usableCount} total scored`
                : ''}
            </p>
          </div>

          <BarChart
            title={
              <span className="inline-flex items-center gap-2 flex-wrap">
                TOP 10 Students
                {secHeader}
              </span>
            }
            items={analytics.top10}
            emptyText={`No scores for Section ${selectedSection} yet`}
          />

          <BarChart
            title={
              <span className="inline-flex items-center gap-2 flex-wrap">
                Average scores of
                {secHeader}
              </span>
            }
            items={analytics.sectionScores}
            emptyText={`No individual scores in Section ${selectedSection}`}
          />

          <BarChart
            title="Average scores of all sections"
            items={analytics.avgAll}
            emptyText="Need evaluations linked to sections A–F"
          />

          <BarChart
            title="Median scores of all sections"
            items={analytics.sectionMedians}
            emptyText="Need multiple evaluations per section"
          />
        </div>

        {/* Right column unchanged */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900 text-sm">Your Exams</h3>
              <button
                type="button"
                className="text-xs text-navy-600 hover:underline"
                onClick={() => navigate('/faculty/create-exam')}
              >
                + New
              </button>
            </div>
            {exams.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">
                No exams yet
              </p>
            ) : (
              <div className="space-y-3">
                {exams.slice(0, 8).map((ex) => {
                  const subCount = submissions.filter(
                    (s) => s.examId === ex.id
                  ).length;
                  return (
                    <div
                      key={ex.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {ex.title}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {ex.code} · {subCount} submission
                          {subCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={ex.status || 'ACTIVE'} />
                        <button
                          type="button"
                          className="text-xs text-red-500 hover:underline"
                          onClick={() => handleDelete(ex.id, ex.title)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 text-sm mb-3">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate('/faculty/create-exam')}
              >
                + Create new exam
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate('/faculty/reviews')}
              >
                ◎ Review pending ({pending.length})
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                size="sm"
                onClick={() => navigate('/faculty/results')}
              >
                ◉ View published results
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}