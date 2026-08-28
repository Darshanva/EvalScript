import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card, Button, StatCard } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { loadExamTree } from '../../lib/exam-tree';

export default function HodDashboard() {
  const navigate = useNavigate();
  const { state } = useApp();
  const u = state.currentUser;
  const client = u?.client || '';

  const [students, setStudents] = useState<any[]>([]);
  const [tree, setTree] = useState<Record<string, any>>({});

  useEffect(() => {
    loadExamTree().then(setTree);
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .then(({ data }) => setStudents(data || []));
  }, []);

  const clientStudents = useMemo(() => {
    if (!client) return students;
    const c = client.toLowerCase();
    return students.filter(
      (s) =>
        (s.client || '').toLowerCase() === c ||
        (s.department || '').toLowerCase().includes(c)
    );
  }, [students, client]);

  const sectionCounts = useMemo(() => {
    const m = new Map<string, number>();
    clientStudents.forEach((s) => {
      const key = s.section || 'Unassigned';
      m.set(key, (m.get(key) || 0) + 1);
    });
    return [...m.entries()];
  }, [clientStudents]);

  const subtree = tree[client] || {};
  const orgCount = Object.keys(subtree).length;

  const facultyExams = state.exams.filter((e) => {
    const hay = `${e.description || ''} ${e.title}`.toLowerCase();
    return !client || hay.includes(client.toLowerCase());
  });

  if (!u) return null;

  return (
    <PageContainer>
      <PageHeader
        title={`HOD · ${client || 'No client'}`}
        subtitle={`${u.name} · Client-scoped portal`}
        breadcrumb="HOD"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Students"
          value={String(clientStudents.length)}
          icon="⋯"
        />
        <StatCard label="Orgs / verticals" value={String(orgCount)} icon="▤" />
        <StatCard
          label="Sections"
          value={String(sectionCounts.length)}
          icon="◎"
        />
        <StatCard
          label="Exams (client)"
          value={String(facultyExams.length)}
          icon="◉"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <h3 className="font-semibold text-sm mb-3">Students per section</h3>
          {sectionCounts.length === 0 ? (
            <p className="text-xs text-slate-400">Upload students to see split</p>
          ) : (
            <ul className="space-y-2">
              {sectionCounts.map(([sec, n]) => (
                <li
                  key={sec}
                  className="flex justify-between text-sm border-b border-slate-100 pb-1"
                >
                  <span>{sec}</span>
                  <span className="font-mono font-semibold">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold text-sm mb-3">Quick actions</h3>
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-start"
              size="sm"
              onClick={() => navigate('/hod/students')}
            >
              Manage students / Excel upload
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              size="sm"
              onClick={() => navigate('/hod/structure')}
            >
              Batches & sections
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              size="sm"
              onClick={() => navigate('/hod/analytics')}
            >
              Analytics
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}