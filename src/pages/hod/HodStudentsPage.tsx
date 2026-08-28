import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Select, Input, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { loadExamTree } from '../../lib/exam-tree';
import { findVerticalForOrg } from '../../lib/hod-scope';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] || '';
    });
    return row;
  });
}

export default function HodStudentsPage() {
  const { state, showToast } = useApp();
  const orgName =
    state.currentUser?.client || state.currentUser?.organisation || '';

  const [tree, setTree] = useState<Record<string, any>>({});
  const [vertical, setVertical] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [filterSection, setFilterSection] = useState('');
  const [uploading, setUploading] = useState(false);

  const [email, setEmail] = useState('');
  const [batch, setBatch] = useState('');
  const [term, setTerm] = useState('');
  const [section, setSection] = useState('');

  const refreshTree = useCallback(async () => {
    const t = await loadExamTree();
    setTree(t);
    setVertical(findVerticalForOrg(t, orgName) || '');
  }, [orgName]);

  const refreshStudents = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'student');
    setStudents(data || []);
  }, []);

  useEffect(() => {
    refreshTree();
    refreshStudents();
    const onUpd = () => {
      refreshTree();
      refreshStudents();
    };
    window.addEventListener('exam-tree-updated', onUpd);
    return () => window.removeEventListener('exam-tree-updated', onUpd);
  }, [refreshTree, refreshStudents]);

  // Org subtree: tree[vertical][orgName]
  const orgNode =
    vertical && orgName ? tree[vertical]?.[orgName] || {} : {};

  const batches = Object.keys(orgNode);
  const terms =
    batch && orgNode[batch] && typeof orgNode[batch] === 'object'
      ? Object.keys(orgNode[batch])
      : [];
  const sections =
    batch &&
    term &&
    orgNode[batch]?.[term] &&
    typeof orgNode[batch][term] === 'object'
      ? Object.keys(orgNode[batch][term])
      : [];

  // All section names under org (for filter chips)
  const allSections = useMemo(() => {
    const set = new Set<string>();
    for (const b of Object.keys(orgNode)) {
      const batchNode = orgNode[b];
      if (!batchNode || typeof batchNode !== 'object') continue;
      for (const t of Object.keys(batchNode)) {
        const termNode = batchNode[t];
        if (!termNode || typeof termNode !== 'object') continue;
        for (const s of Object.keys(termNode)) set.add(s);
      }
    }
    return [...set].sort();
  }, [orgNode]);

  const clientStudents = students.filter((s) => {
    if (!orgName) return true;
    const o = orgName.toLowerCase();
    return (
      (s.organisation || '').toLowerCase() === o ||
      (s.client || '').toLowerCase() === o ||
      (s.department || '').toLowerCase().includes(o)
    );
  });

  const displayed = filterSection
    ? clientStudents.filter(
        (s) => (s.section || '').toLowerCase() === filterSection.toLowerCase()
      )
    : clientStudents;

  async function assignStudent(row: {
    name?: string;
    email: string;
    batch?: string;
    term?: string;
    section?: string;
  }) {
    if (!row.email) return;
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', row.email)
      .maybeSingle();

    const payload: Record<string, any> = {
      client: orgName,
      organisation: orgName,
      batch: row.batch || null,
      term: row.term || null,
      section: row.section || null,
      department: [orgName, row.batch, row.term, row.section]
        .filter(Boolean)
        .join(' › '),
    };

    if (existing) {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('profiles').upsert({
        id,
        email: row.email,
        name: row.name || row.email.split('@')[0],
        role: 'student',
        avatar_initials: (row.name || 'ST').slice(0, 2).toUpperCase(),
        calibrated: false,
        ...payload,
      });
      if (error) throw error;
    }
  }

  async function handleCsv(file: File) {
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      let n = 0;
      for (const r of rows) {
        if (!r.email) continue;
        await assignStudent({
          name: r.name,
          email: r.email,
          batch: r.batch,
          term: r.term,
          section: r.section,
        });
        n++;
      }
      await refreshStudents();
      showToast(`Allocated ${n} row(s)`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleManualAssign() {
    if (!email || !section) {
      showToast('Email + Section required', 'error');
      return;
    }
    try {
      await assignStudent({ email, batch, term, section });
      await refreshStudents();
      showToast('Student assigned', 'success');
      setEmail('');
    } catch (e: any) {
      showToast(e.message || 'Assign failed', 'error');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Students"
        subtitle={`Org: ${orgName || '—'} · From Exam Structure`}
        breadcrumb="HOD"
        showBack
        backTo="/hod"
      />

      {!vertical && orgName && (
        <Card className="mb-4">
          <p className="text-sm text-amber-700">
            Organisation not found in tree. Admin must add <strong>{orgName}</strong>{' '}
            under a Vertical.
          </p>
        </Card>
      )}

      <Card className="mb-6 space-y-3">
        <h3 className="font-semibold text-sm">CSV upload</h3>
        <p className="text-xs text-slate-500">
          Header: <code>name,email,batch,term,section</code>
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleCsv(f);
          }}
        />
      </Card>

      <Card className="mb-6 space-y-3 max-w-xl">
        <h3 className="font-semibold text-sm">Assign to section</h3>
        <Input
          label="Student email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Select
          label="Batch"
          options={[
            { value: '', label: 'Select batch…' },
            ...batches.map((b) => ({ value: b, label: b })),
          ]}
          value={batch}
          onChange={(e) => {
            setBatch(e.target.value);
            setTerm('');
            setSection('');
          }}
        />
        <Select
          label="Term"
          options={[
            { value: '', label: 'Select term…' },
            ...terms.map((t) => ({ value: t, label: t })),
          ]}
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setSection('');
          }}
        />
        <Select
          label="Section *"
          options={[
            { value: '', label: 'Select section…' },
            ...sections.map((s) => ({ value: s, label: s })),
          ]}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        />
        {batches.length === 0 && (
          <p className="text-xs text-slate-500">
            No batches yet — HOD Structure lo Batch add cheyyi.
          </p>
        )}
        <Button onClick={handleManualAssign}>Assign</Button>
      </Card>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterSection('')}
          className={`px-3 py-1.5 rounded-lg text-sm ${
            !filterSection ? 'bg-navy-900 text-white' : 'bg-slate-100'
          }`}
        >
          All ({clientStudents.length})
        </button>
        {allSections.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterSection(s)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              filterSection === s ? 'bg-navy-900 text-white' : 'bg-slate-100'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {displayed.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400 text-center py-8">
              No students for this org yet.
            </p>
          </Card>
        ) : (
          displayed.map((s) => (
            <Card key={s.id} className="flex justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-slate-500">{s.email}</p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <Badge variant="muted">{s.section || 'Unassigned'}</Badge>
                <p className="mt-1">
                  {[s.batch, s.term].filter(Boolean).join(' · ')}
                </p>
              </div>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}