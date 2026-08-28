import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { supabase } from '../../lib/supabase';

function Bar({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number }[];
}) {
  const peak = Math.max(...items.map((i) => i.value), 1);
  return (
    <Card>
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-8 text-center">No data</p>
      ) : (
        <div className="flex items-end gap-1 h-36 border-b border-l border-slate-200 pl-1">
          {items.map((i) => (
            <div key={i.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full max-w-[28px] bg-navy-600 rounded-t"
                style={{ height: `${Math.max(6, (i.value / peak) * 100)}%` }}
                title={`${i.label}: ${i.value}`}
              />
              <span className="text-[9px] text-slate-500 mt-1 truncate w-full text-center">
                {i.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function HodAnalyticsPage() {
  const { state } = useApp();
  const client = state.currentUser?.client || '';
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .then(({ data }) => setStudents(data || []));
  }, []);

  const clientStudents = students.filter(
    (s) =>
      !client ||
      (s.client || '').toLowerCase() === client.toLowerCase() ||
      (s.department || '').toLowerCase().includes(client.toLowerCase())
  );

  const bySection = useMemo(() => {
    const m = new Map<string, number>();
    clientStudents.forEach((s) => {
      const k = s.section || 'Unassigned';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  }, [clientStudents]);

  const byBatch = useMemo(() => {
    const m = new Map<string, number>();
    clientStudents.forEach((s) => {
      const k = s.batch || '—';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([label, value]) => ({ label, value }));
  }, [clientStudents]);

  // Scores from published evals in client exams
  const scoreBars = useMemo(() => {
    const evals = state.evaluations.filter((e) => e.status === 'PUBLISHED');
    const m = new Map<string, number[]>();
    evals.forEach((e) => {
      const exam = state.exams.find((x) => x.id === e.examId);
      const hay = `${exam?.description || ''}`.toLowerCase();
      if (client && !hay.includes(client.toLowerCase())) return;
      const st = students.find((s) => s.id === e.studentId);
      const sec = st?.section || 'Sec';
      const arr = m.get(sec) || [];
      arr.push(e.facultyTotalMarks ?? e.totalMarks);
      m.set(sec, arr);
    });
    return [...m.entries()].map(([label, vals]) => ({
      label,
      value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));
  }, [state.evaluations, state.exams, students, client]);

  return (
    <PageContainer>
      <PageHeader
        title="Analytics"
        subtitle={client}
        breadcrumb="HOD"
        showBack
        backTo="/hod"
      />
      <div className="grid md:grid-cols-2 gap-5">
        <Bar title="Students per section" items={bySection} />
        <Bar title="Students per batch" items={byBatch} />
        <Bar title="Avg marks by section (published)" items={scoreBars} />
      </div>
    </PageContainer>
  );
}