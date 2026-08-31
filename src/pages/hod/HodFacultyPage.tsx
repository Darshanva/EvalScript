import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button, Card, Input, Select, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import {
  loadExamTree,
  getItemsAtLevel,
  EMPTY_PATH,
  type TreePath,
} from '../../lib/exam-tree';
import { findVerticalForOrg, resolveOrgKey } from '../../lib/hod-scope';
import {
  fetchFacultyAssignments,
  saveFacultyAssignment,
  deleteFacultyAssignment,
  type FacultyAssignment,
} from '../../lib/faculty-assignments';
import { supabase } from '../../lib/supabase';

function genId() {
  return `fa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function HodFacultyPage() {
  const { state, showToast } = useApp();
  const navigate = useNavigate();
  const orgName = (
    state.currentUser?.organisation ||
    state.currentUser?.client ||
    ''
  ).trim();

  const [tree, setTree] = useState<Record<string, any>>({});
  const [vertical, setVertical] = useState('');
  const [orgKey, setOrgKey] = useState('');
  const [assignments, setAssignments] = useState<FacultyAssignment[]>([]);
  const [facultyProfiles, setFacultyProfiles] = useState<
    { id: string; email: string; name: string }[]
  >([]);

  const [email, setEmail] = useState('');
  const [batch, setBatch] = useState('');
  const [term, setTerm] = useState('');
  const [section, setSection] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const basePath: TreePath = useMemo(
    () => ({
      ...EMPTY_PATH,
      vertical,
      org: orgKey,
    }),
    [vertical, orgKey]
  );

  const batches = vertical && orgKey
    ? getItemsAtLevel(tree, 'batch', basePath)
    : [];
  const terms =
    batch
      ? getItemsAtLevel(tree, 'term', { ...basePath, batch })
      : [];
  const sections =
    batch && term
      ? getItemsAtLevel(tree, 'section', { ...basePath, batch, term })
      : [];

  const refresh = useCallback(async () => {
    const t = await loadExamTree();
    const v = findVerticalForOrg(t, orgName) || '';
    const o = resolveOrgKey(t, orgName) || '';
    setTree(t);
    setVertical(v);
    setOrgKey(o);

    const list = await fetchFacultyAssignments(orgName || undefined);
    // filter to this org (case-insensitive)
    setAssignments(
      list.filter(
        (a) =>
          !orgName ||
          a.organisation.toLowerCase() === orgName.toLowerCase()
      )
    );

    try {
      const { data } = await supabase
        .from('profiles')
        .select('id,email,name,role')
        .eq('role', 'faculty');
      setFacultyProfiles(
        (data || []).map((r: any) => ({
          id: r.id,
          email: r.email,
          name: r.name,
        }))
      );
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [orgName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleAssign() {
    const em = email.trim().toLowerCase();
    if (!em || !section) {
      showToast('Faculty email + section required', 'error');
      return;
    }
    if (!orgName) {
      showToast('HOD organisation missing', 'error');
      return;
    }

    const profile = facultyProfiles.find(
      (f) => f.email.toLowerCase() === em
    );

    const row: FacultyAssignment = {
      id: genId(),
      facultyId: profile?.id,
      facultyEmail: em,
      facultyName: profile?.name,
      organisation: orgName,
      batch: batch || undefined,
      term: term || undefined,
      section,
      createdAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await saveFacultyAssignment(row);
      showToast(`Assigned ${em} → ${section}`, 'success');
      setEmail('');
      setSection('');
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Assign failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    if (!window.confirm('Remove this faculty assignment?')) return;
    try {
      await deleteFacultyAssignment(id);
      showToast('Removed', 'success');
      await refresh();
    } catch (e: any) {
      showToast(e?.message || 'Delete failed', 'error');
    }
  }

  if (!orgName) {
    return (
      <PageContainer>
        <p className="text-sm text-red-600">HOD organisation not set.</p>
      </PageContainer>
    );
  }

  if (!loading && (!vertical || !orgKey)) {
    return (
      <PageContainer>
        <PageHeader
          title="Assign Faculty"
          subtitle={orgName}
          breadcrumb="HOD"
          showBack
          backTo="/hod"
        />
        <Card>
          <p className="text-sm text-amber-800">
            Organisation <strong>{orgName}</strong> not in Exam Structure.
            Admin must add it under a Vertical first.
          </p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Assign Faculty"
        subtitle={`Org: ${orgName} · Faculty can create exams only for assigned sections`}
        breadcrumb="HOD"
        showBack
        backTo="/hod"
      />

      <Card className="mb-6 max-w-lg space-y-4">
        <h3 className="font-semibold text-slate-900 text-sm">
          Assign to section
        </h3>

        <div>
          <label className="text-xs font-medium text-slate-600">
            Faculty email *
          </label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="faculty@university.edu"
            list="faculty-emails"
          />
          <datalist id="faculty-emails">
            {facultyProfiles.map((f) => (
              <option key={f.id} value={f.email}>
                {f.name}
              </option>
            ))}
          </datalist>
        </div>

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

        <Button loading={saving} onClick={handleAssign}>
          Assign Faculty
        </Button>
      </Card>

      <Card>
        <h3 className="font-semibold text-slate-900 text-sm mb-3">
          Current assignments ({assignments.length})
        </h3>
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No faculty assigned yet.
          </p>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {a.facultyName || a.facultyEmail}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {a.facultyEmail}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {[a.batch, a.term, a.section].filter(Boolean).join(' › ')}
                  </p>
                </div>
                <Badge variant="navy">{a.section}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => handleRemove(a.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}