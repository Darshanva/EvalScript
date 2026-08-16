import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Card,
  Button,
  Badge,
  EmptyState,
  ConfidenceBadge,
  ScoreBar,
  Table,
  TableRow,
  Td,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

function grade(percentage: number) {
  if (percentage >= 90) return 'A';
  if (percentage >= 75) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

export default function PublishedResultsPage() {
  const { state, navigate, getEvaluationsForCurrentUser } = useApp();
  const evaluations = getEvaluationsForCurrentUser().filter((e) => e.status === 'PUBLISHED');
  const exams = state.exams.filter((e) => e.facultyId === state.currentUser?.id);
  const [selectedExamId, setSelectedExamId] = useState<string>('all');

  const filtered =
    selectedExamId === 'all'
      ? evaluations
      : evaluations.filter((e) => e.examId === selectedExamId);

  const avg =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((sum, e) => sum + pct(e.facultyTotalMarks ?? e.totalMarks, e.maxMarks), 0) / filtered.length
        )
      : 0;

  function downloadCSV() {
    const rows = [
      ['Student', 'Exam', 'AI Marks', 'Faculty Marks', 'Max', 'Percentage', 'Grade', 'Published'],
      ...filtered.map((e) => {
        const fm = e.facultyTotalMarks ?? e.totalMarks;
        const p = pct(fm, e.maxMarks);
        return [e.studentName, e.examTitle, e.totalMarks, fm, e.maxMarks, `${p}%`, grade(p), e.publishedAt ? formatDate(e.publishedAt) : ''];
      }),
    ];
    const csv = rows.map((r) => r.map(String).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results-${selectedExamId}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Published Results"
        subtitle="All results that have been reviewed and published to students."
        breadcrumb="Faculty"
        action={
          <Button size="sm" variant="secondary" onClick={downloadCSV} disabled={filtered.length === 0}>
            Export CSV
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedExamId('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedExamId === 'all' ? 'bg-navy-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          All Exams
        </button>
        {exams.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelectedExamId(e.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedExamId === e.id ? 'bg-navy-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {e.code}
          </button>
        ))}
      </div>

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <p className="text-xs text-slate-400 mb-1">Results</p>
            <p className="text-2xl font-semibold text-slate-900">{filtered.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400 mb-1">Class Average</p>
            <p className="text-2xl font-semibold text-slate-900">{avg}%</p>
          </Card>
          <Card>
            <p className="text-xs text-slate-400 mb-1">Pass Rate</p>
            <p className="text-2xl font-semibold text-slate-900">
              {filtered.length > 0
                ? Math.round((filtered.filter((e) => pct(e.facultyTotalMarks ?? e.totalMarks, e.maxMarks) >= 50).length / filtered.length) * 100)
                : 0}%
            </p>
          </Card>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<span className="text-5xl">◉</span>}
            title="No published results"
            description="Results you publish will appear here."
            action={
              <Button size="sm" onClick={() => navigate('f-reviews')}>
                Go to Reviews
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding={false}>
          <Table
            headers={['Student', 'Exam', 'Marks', 'Score', 'Grade', 'Confidence', 'Published', '']}
          >
            {filtered.map((ev) => {
              const fm = ev.facultyTotalMarks ?? ev.totalMarks;
              const p = pct(fm, ev.maxMarks);
              const g = grade(p);
              const gColor = p >= 75 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
              return (
                <TableRow
                  key={ev.id}
                  onClick={() => navigate('f-review', { selectedEvaluationId: ev.id })}
                >
                  <Td className="font-medium">{ev.studentName}</Td>
                  <Td>
                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                      {state.exams.find((e) => e.id === ev.examId)?.code ?? '—'}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2 min-w-32">
                      <ScoreBar awarded={fm} max={ev.maxMarks} />
                      <span className="font-mono text-xs shrink-0">
                        {fm}/{ev.maxMarks}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono font-medium">{p}%</span>
                  </Td>
                  <Td>
                    <span className={`font-semibold ${gColor}`}>{g}</span>
                  </Td>
                  <Td>
                    <ConfidenceBadge level={ev.overallConfidenceLevel} score={ev.overallConfidence} />
                  </Td>
                  <Td className="text-slate-400 text-xs">
                    {ev.publishedAt ? formatDate(ev.publishedAt) : '—'}
                  </Td>
                  <Td>
                    <Button size="sm" variant="ghost">
                      View →
                    </Button>
                  </Td>
                </TableRow>
              );
            })}
          </Table>
        </Card>
      )}
    </PageContainer>
  );
}
