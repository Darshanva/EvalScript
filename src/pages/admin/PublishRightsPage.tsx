import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Select, Badge } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import { loadExamTree } from '../../lib/exam-tree';
import {
  loadPublishRights,
  savePublishRight,
  removePublishRight,
  type PublishRight,
} from '../../lib/publish-rights';
import { supabase } from '../../lib/supabase';
import type { User, Evaluation } from '../../types';

function genId() {
  return `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

type Tab = 'grant' | 'publish';

export default function PublishRightsPage() {
  const { state, publishEvaluation, showToast } = useApp();
  const { evaluations, exams } = state;

  const [tab, setTab] = useState<Tab>('grant');
  const [tree, setTree] = useState<Record<string, any>>({});
  const [facultyList, setFacultyList] = useState<User[]>([]);
  const [rights, setRights] = useState<PublishRight[]>([]);

  // Grant form
  const [facultyId, setFacultyId] = useState('');
  const [client, setClient] = useState('');
  const [org, setOrg] = useState('');
  const [batch, setBatch] = useState('');
  const [term, setTerm] = useState('');
  const [section, setSection] = useState('');
  const [saving, setSaving] = useState(false);

  // Admin publish filters (same cascade)
  const [pClient, setPClient] = useState('');
  const [pOrg, setPOrg] = useState('');
  const [pBatch, setPBatch] = useState('');
  const [pTerm, setPTerm] = useState('');
  const [pSection, setPSection] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    loadExamTree().then(setTree);
    loadPublishRights().then(setRights);
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'faculty')
      .then(({ data }) => {
        setFacultyList(
          (data || []).map((r: any) => ({
            id: r.id,
            email: r.email,
            name: r.name,
            role: 'faculty' as const,
            avatarInitials: r.name?.slice(0, 2).toUpperCase() || 'F',
          }))
        );
      });
  }, []);

  const clients = Object.keys(tree);
  function children(
    c: string,
    o: string,
    b: string,
    t: string
  ): {
    orgs: string[];
    batches: string[];
    terms: string[];
    sections: string[];
  } {
    const orgs = c ? Object.keys(tree[c] || {}) : [];
    const batches = c && o ? Object.keys(tree[c]?.[o] || {}) : [];
    const terms = c && o && b ? Object.keys(tree[c]?.[o]?.[b] || {}) : [];
    const sections =
      c && o && b && t ? Object.keys(tree[c]?.[o]?.[b]?.[t] || {}) : [];
    return { orgs, batches, terms, sections };
  }

  const grantKids = children(client, org, batch, term);
  const pubKids = children(pClient, pOrg, pBatch, pTerm);

  function pathBlob(
    c: string,
    o: string,
    b: string,
    t: string,
    s: string
  ): string {
    return [c, o, b, t, s].filter(Boolean).join(' ').toLowerCase();
  }

  /** Evaluations matching admin publish filters + not yet published */
  const publishable = useMemo(() => {
    const needle = pathBlob(pClient, pOrg, pBatch, pTerm, pSection);
    return evaluations.filter((ev) => {
      if (ev.status === 'PUBLISHED') return false;
      if (
        ev.status !== 'AI_COMPLETE' &&
        ev.status !== 'FACULTY_REVIEW' &&
        ev.status !== 'REVIEWED'
      ) {
        return false;
      }
      if (!needle) return true;
      const exam = exams.find((x) => x.id === ev.examId);
      const hay = `${exam?.description || ''} ${ev.examTitle || ''} ${exam?.code || ''}`.toLowerCase();
      return needle
        .split(/\s+/)
        .filter(Boolean)
        .every((part) => hay.includes(part));
    });
  }, [evaluations, exams, pClient, pOrg, pBatch, pTerm, pSection]);

  async function handleGrant() {
    if (!facultyId) {
      showToast('Select faculty', 'error');
      return;
    }
    if (!client) {
      showToast('Select client / vertical', 'error');
      return;
    }
    const fac = facultyList.find((f) => f.id === facultyId);
    setSaving(true);
    const right: PublishRight = {
      id: genId(),
      facultyId,
      facultyName: fac?.name || '',
      client: org || client,
      batch,
      term,
      section,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    await savePublishRight(right);
    setRights(await loadPublishRights());
    setSaving(false);
    showToast('Publish right granted to faculty', 'success');
  }

  async function handleRevoke(id: string) {
    if (!window.confirm('Revoke publish access?')) return;
    await removePublishRight(id);
    setRights(await loadPublishRights());
    showToast('Revoked', 'success');
  }

  async function handleAdminPublishOne(ev: Evaluation) {
    setPublishingId(ev.id);
    try {
      await publishEvaluation(ev.id, 'Published by Admin');
      showToast(`Published: ${ev.studentName}`, 'success');
    } catch {
      showToast('Publish failed', 'error');
    } finally {
      setPublishingId(null);
    }
  }

  async function handleAdminPublishAll() {
    if (!publishable.length) {
      showToast('Nothing to publish for this filter', 'info');
      return;
    }
    if (
      !window.confirm(
        `Publish ${publishable.length} result(s) as Admin?`
      )
    ) {
      return;
    }
    setBulkLoading(true);
    let ok = 0;
    for (const ev of publishable) {
      try {
        await publishEvaluation(ev.id, 'Published by Admin (bulk)');
        ok++;
      } catch {
        /* continue */
      }
    }
    setBulkLoading(false);
    showToast(`Published ${ok} / ${publishable.length}`, 'success');
  }

  return (
    <PageContainer>
      <PageHeader
        title="Faculty Right to Publish"
        subtitle="Grant faculty access, or publish results directly as Admin."
        breadcrumb="Admin"
        showBack
        backTo="/admin"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('grant')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'grant'
              ? 'bg-navy-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Grant Right
        </button>
        <button
          type="button"
          onClick={() => setTab('publish')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'publish'
              ? 'bg-navy-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Publish Results
        </button>
      </div>

      {/* ——— TAB: Grant ——— */}
      {tab === 'grant' && (
        <>
          <Card className="max-w-xl space-y-4 mb-8">
            <Select
              label="Faculty *"
              options={[
                { value: '', label: 'Select faculty…' },
                ...facultyList.map((f) => ({
                  value: f.id,
                  label: `${f.name} (${f.email})`,
                })),
              ]}
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
            />
            <Select
              label="Client / Vertical *"
              options={[
                { value: '', label: 'Select…' },
                ...clients.map((c) => ({ value: c, label: c })),
              ]}
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                setOrg('');
                setBatch('');
                setTerm('');
                setSection('');
              }}
            />
            {grantKids.orgs.length > 0 && (
              <Select
                label="Organisation"
                options={[
                  { value: '', label: 'Any / all' },
                  ...grantKids.orgs.map((c) => ({ value: c, label: c })),
                ]}
                value={org}
                onChange={(e) => {
                  setOrg(e.target.value);
                  setBatch('');
                  setTerm('');
                  setSection('');
                }}
              />
            )}
            <Select
              label="Batch"
              options={[
                { value: '', label: 'Any' },
                ...grantKids.batches.map((c) => ({ value: c, label: c })),
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
                { value: '', label: 'Any' },
                ...grantKids.terms.map((c) => ({ value: c, label: c })),
              ]}
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setSection('');
              }}
            />
            <Select
              label="Section"
              options={[
                { value: '', label: 'Any' },
                ...grantKids.sections.map((c) => ({ value: c, label: c })),
              ]}
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
            <Button loading={saving} onClick={handleGrant}>
              Submit — Grant Publish Right
            </Button>
          </Card>

          <h3 className="font-semibold text-slate-900 mb-3 text-sm">
            Active rights
          </h3>
          {rights.length === 0 ? (
            <p className="text-sm text-slate-400">None yet</p>
          ) : (
            <div className="space-y-2">
              {rights.map((r) => (
                <Card
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {r.facultyName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[r.client, r.batch, r.term, r.section]
                        .filter(Boolean)
                        .join(' › ') || 'All'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.enabled ? 'success' : 'muted'}>
                      {r.enabled ? 'ON' : 'OFF'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => handleRevoke(r.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ——— TAB: Admin Publish ——— */}
      {tab === 'publish' && (
        <>
          <Card className="max-w-xl space-y-4 mb-6">
            <p className="text-sm text-slate-600">
              Filter by structure, then publish ready evaluations as{' '}
              <strong>Admin</strong> (no faculty grant needed).
            </p>
            <Select
              label="Client / Vertical"
              options={[
                { value: '', label: 'All' },
                ...clients.map((c) => ({ value: c, label: c })),
              ]}
              value={pClient}
              onChange={(e) => {
                setPClient(e.target.value);
                setPOrg('');
                setPBatch('');
                setPTerm('');
                setPSection('');
              }}
            />
            {pubKids.orgs.length > 0 && (
              <Select
                label="Organisation"
                options={[
                  { value: '', label: 'Any' },
                  ...pubKids.orgs.map((c) => ({ value: c, label: c })),
                ]}
                value={pOrg}
                onChange={(e) => {
                  setPOrg(e.target.value);
                  setPBatch('');
                  setPTerm('');
                  setPSection('');
                }}
              />
            )}
            <Select
              label="Batch"
              options={[
                { value: '', label: 'Any' },
                ...pubKids.batches.map((c) => ({ value: c, label: c })),
              ]}
              value={pBatch}
              onChange={(e) => {
                setPBatch(e.target.value);
                setPTerm('');
                setPSection('');
              }}
            />
            <Select
              label="Term"
              options={[
                { value: '', label: 'Any' },
                ...pubKids.terms.map((c) => ({ value: c, label: c })),
              ]}
              value={pTerm}
              onChange={(e) => {
                setPTerm(e.target.value);
                setPSection('');
              }}
            />
            <Select
              label="Section"
              options={[
                { value: '', label: 'Any' },
                ...pubKids.sections.map((c) => ({ value: c, label: c })),
              ]}
              value={pSection}
              onChange={(e) => setPSection(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                loading={bulkLoading}
                disabled={!publishable.length}
                onClick={handleAdminPublishAll}
              >
                Publish all ({publishable.length})
              </Button>
            </div>
          </Card>

          <h3 className="font-semibold text-slate-900 mb-3 text-sm">
            Ready to publish ({publishable.length})
          </h3>
          {publishable.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-400 text-center py-8">
                No matching unpublished evaluations. Adjust filters or wait for
                AI / faculty review.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {publishable.map((ev) => {
                const marks = ev.facultyTotalMarks ?? ev.totalMarks;
                return (
                  <Card
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">
                        {ev.studentName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {ev.examTitle} · {marks}/{ev.maxMarks} (
                        {pct(marks, ev.maxMarks)}%) · {ev.status}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      loading={publishingId === ev.id}
                      onClick={() => handleAdminPublishOne(ev)}
                    >
                      Publish
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}