import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Modal,
  Badge,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Exam, Rubric, RubricQuestion } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  loadExamTree,
  getItemsAtLevel,
  EMPTY_PATH,
  LEVEL_TITLES,
  pathFromCrumbs,
  formatHierarchyPath,
  type TreeLevel,
  type TreePath,
} from '../../lib/exam-tree';
import {
  fetchAssignmentsForFaculty,
  facultyCanAccessPath,
  type FacultyAssignment,
} from '../../lib/faculty-assignments';

type Level = TreeLevel | 'form' | 'multi-pick';
type RubricMode = 'write' | 'upload';
type CreateMode = 'assigned' | 'free';

interface SectionTarget {
  vertical: string;
  org: string;
  batch: string;
  term: string;
  section: string;
  label: string;
}

const SUBJECTS = [
  { value: 'Computer Science', label: 'Computer Science' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Banking', label: 'Banking' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Other', label: 'Other' },
];

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function uploadExamFile(
  file: File,
  folder: string
): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('answer-scripts')
    .upload(path, file, { upsert: true });
  if (error) {
    console.error(error);
    return null;
  }
  const { data } = supabase.storage.from('answer-scripts').getPublicUrl(path);
  return data.publicUrl;
}

function filterItemsForFaculty(
  items: string[],
  level: TreeLevel,
  path: TreePath,
  assignments: FacultyAssignment[]
): string[] {
  if (!assignments.length) return [];

  if (level === 'batch') {
    const allowed = new Set(
      assignments.map((a) => (a.batch || '').toLowerCase()).filter(Boolean)
    );
    const hasWildcard = assignments.some((a) => !a.batch);
    if (hasWildcard || allowed.size === 0) return items;
    return items.filter((b) => allowed.has(b.toLowerCase()));
  }

  if (level === 'term') {
    const allowed = new Set(
      assignments
        .filter(
          (a) =>
            !a.batch ||
            a.batch.toLowerCase() === (path.batch || '').toLowerCase()
        )
        .map((a) => (a.term || '').toLowerCase())
        .filter(Boolean)
    );
    const hasWildcard = assignments.some(
      (a) =>
        (!a.batch ||
          a.batch.toLowerCase() === (path.batch || '').toLowerCase()) &&
        !a.term
    );
    if (hasWildcard || allowed.size === 0) return items;
    return items.filter((t) => allowed.has(t.toLowerCase()));
  }

  if (level === 'section') {
    return items.filter((name) =>
      facultyCanAccessPath(assignments, {
        org: path.org,
        batch: path.batch,
        term: path.term,
        section: name,
      })
    );
  }

  if (level === 'org') {
    const orgs = new Set(
      assignments.map((a) => a.organisation.toLowerCase()).filter(Boolean)
    );
    if (!orgs.size) return items;
    return items.filter((o) => orgs.has(o.toLowerCase()));
  }

  return items;
}

/** Flatten all sections under current tree path (for multi-select) */
function collectSections(
  tree: Record<string, any>,
  path: TreePath,
  assignments: FacultyAssignment[] | null
): SectionTarget[] {
  const out: SectionTarget[] = [];
  const verticals = path.vertical
    ? [path.vertical]
    : Object.keys(tree || {});

  for (const vertical of verticals) {
    const orgs = path.org
      ? [path.org]
      : Object.keys(tree[vertical] || {});
    for (const org of orgs) {
      const batches = path.batch
        ? [path.batch]
        : Object.keys(tree[vertical]?.[org] || {});
      for (const batch of batches) {
        const terms = path.term
          ? [path.term]
          : Object.keys(tree[vertical]?.[org]?.[batch] || {});
        for (const term of terms) {
          const sections = Object.keys(
            tree[vertical]?.[org]?.[batch]?.[term] || {}
          );
          for (const section of sections) {
            if (assignments) {
              const ok = facultyCanAccessPath(assignments, {
                org,
                batch,
                term,
                section,
              });
              if (!ok) continue;
            }
            out.push({
              vertical,
              org,
              batch,
              term,
              section,
              label: `${org} › ${batch} › ${term} › ${section}`,
            });
          }
        }
      }
    }
  }
  return out;
}

export default function CreateExamPage() {
  const { state, createExam, createRubric, showToast } = useApp();
  const navigate = useNavigate();
  const { currentUser } = state;

  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [tree, setTree] = useState<Record<string, any>>({});
  const [treeLoading, setTreeLoading] = useState(true);
  const [level, setLevel] = useState<Level>('vertical');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });

  const [myAssignments, setMyAssignments] = useState<FacultyAssignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(true);

  /** Multi-select targets (sections) */
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [multiList, setMultiList] = useState<SectionTarget[]>([]);

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [subject, setSubject] = useState('Banking');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('180');
  const [description, setDescription] = useState('');

  const [qpAnsFiles, setQpAnsFiles] = useState<File[]>([]);
  const [qpAnsUrls, setQpAnsUrls] = useState<string[]>([]);
  const [uploadingQpAns, setUploadingQpAns] = useState(false);

  const [rubricMode, setRubricMode] = useState<RubricMode>('write');
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [rubricFileUrl, setRubricFileUrl] = useState('');
  const [uploadingRubric, setUploadingRubric] = useState(false);

  const [questions, setQuestions] = useState<RubricQuestion[]>([
    {
      id: genId('rq'),
      number: '1',
      questionText: '',
      maxMarks: 10,
      criteria: [{ id: genId('rc'), description: '', maxMarks: 10 }],
    },
  ]);

  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [formStep, setFormStep] = useState<0 | 1>(0);

  const qpAnsRef = useRef<HTMLInputElement>(null);
  const rubricRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const t = await loadExamTree();
      if (!cancelled) {
        setTree(t);
        setTreeLoading(false);
      }
    }
    refresh();
    const onUpd = () => refresh();
    window.addEventListener('exam-tree-updated', onUpd);
    return () => {
      cancelled = true;
      window.removeEventListener('exam-tree-updated', onUpd);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAssign() {
      if (!currentUser?.email) {
        setAssignLoading(false);
        return;
      }
      const list = await fetchAssignmentsForFaculty(currentUser.email);
      if (!cancelled) {
        setMyAssignments(list);
        setAssignLoading(false);
      }
    }
    loadAssign();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.email]);

  if (!currentUser) return null;

  const useAssignFilter = createMode === 'assigned';

  const totalRubricMarks = questions.reduce((s, q) => s + (q.maxMarks || 0), 0);
  const treeLevel: TreeLevel =
    level === 'form' || level === 'multi-pick'
      ? 'subject'
      : (level as TreeLevel);

  const rawItems =
    level === 'form' || level === 'multi-pick'
      ? []
      : getItemsAtLevel(tree, treeLevel, path);

  const items =
    useAssignFilter && currentUser.role === 'faculty'
      ? filterItemsForFaculty(rawItems, treeLevel, path, myAssignments)
      : rawItems;

  const breadcrumbParts = [
    path.vertical,
    path.org,
    path.batch,
    path.term,
    path.section,
    path.subject,
  ].filter(Boolean);

  const crumbsForJump = [
    path.vertical,
    path.org,
    path.batch,
    path.term,
    path.section,
  ].filter(Boolean);

  function openItem(name: string) {
    if (level === 'vertical') {
      setPath({ ...EMPTY_PATH, vertical: name });
      setLevel('org');
    } else if (level === 'org') {
      setPath((p) => ({
        ...p,
        org: name,
        batch: '',
        term: '',
        section: '',
        subject: '',
      }));
      setLevel('batch');
    } else if (level === 'batch') {
      setPath((p) => ({ ...p, batch: name, term: '', section: '', subject: '' }));
      setLevel('term');
    } else if (level === 'term') {
      setPath((p) => ({ ...p, term: name, section: '', subject: '' }));
      setLevel('section');
    } else if (level === 'section') {
      setPath((p) => ({ ...p, section: name, subject: '' }));
      setLevel('subject');
    } else if (level === 'subject') {
      setPath((p) => ({ ...p, subject: name }));
      setTitle(name);
      // Single path still supported — also allow multi from section list
      setLevel('form');
      setFormStep(0);
      setSelectedKeys(
        new Set([
          `${path.vertical}|${path.org}|${path.batch}|${path.term}|${name}`,
        ])
      );
    }
  }

  function openMultiPick() {
    const list = collectSections(
      tree,
      path,
      useAssignFilter ? myAssignments : null
    );
    setMultiList(list);
    setSelectedKeys(new Set());
    setLevel('multi-pick');
  }

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function jumpCrumb(index: number) {
    if (index < 0) {
      setPath({ ...EMPTY_PATH });
      setLevel('vertical');
      return;
    }
    const { path: p, level: lv } = pathFromCrumbs(crumbsForJump, index);
    setPath(p);
    setLevel(lv);
  }

  function goBack() {
    if (level === 'form') {
      setLevel('subject');
      return;
    }
    if (level === 'multi-pick') {
      setLevel(path.term ? 'term' : path.batch ? 'batch' : 'org');
      return;
    }
    if (level === 'subject') {
      setPath((p) => ({ ...p, subject: '', section: '' }));
      setLevel('section');
      return;
    }
    if (level === 'section') {
      setPath((p) => ({ ...p, section: '', term: '' }));
      setLevel('term');
      return;
    }
    if (level === 'term') {
      setPath((p) => ({ ...p, term: '', batch: '' }));
      setLevel('batch');
      return;
    }
    if (level === 'batch') {
      setPath((p) => ({ ...p, batch: '', org: '' }));
      setLevel('org');
      return;
    }
    if (level === 'org') {
      setPath({ ...EMPTY_PATH });
      setLevel('vertical');
      return;
    }
    setCreateMode(null);
  }

  async function handleQpAnsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setQpAnsFiles(files);
    setUploadingQpAns(true);
    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadExamFile(file, 'qp-ans');
      if (url) urls.push(url);
    }
    setUploadingQpAns(false);
    setQpAnsUrls(urls);
    if (urls.length) showToast(`${urls.length} file(s) uploaded`, 'success');
    else showToast('Upload failed', 'error');
  }

  async function handleRubricFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRubricFile(file);
    setUploadingRubric(true);
    const url = await uploadExamFile(file, 'rubrics');
    setUploadingRubric(false);
    if (url) {
      setRubricFileUrl(url);
      showToast('Rubric uploaded', 'success');
    } else showToast('Rubric upload failed', 'error');
  }

  function buildNotesForTarget(t: SectionTarget): string {
    const tags = [
      t.vertical && `[vertical:${t.vertical}]`,
      t.org && `[org:${t.org}]`,
      t.batch && `[batch:${t.batch}]`,
      t.term && `[term:${t.term}]`,
      t.section && `[section:${t.section}]`,
      path.subject && `[subject:${path.subject}]`,
    ].filter(Boolean);

    return [
      description.trim(),
      `Path: ${t.label}${path.subject ? ` › ${path.subject}` : ''}`,
      ...tags,
      t.batch ? `Batch: ${t.batch}` : '',
      t.term ? `Term: ${t.term}` : '',
      qpAnsUrls.length ? `QP&Ans: ${qpAnsUrls.join(', ')}` : '',
      rubricFileUrl ? `RubricFile: ${rubricFileUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function handleSave() {
    if (!title || !code || !date) {
      showToast('Fill title, code and date', 'error');
      return;
    }

    const targets: SectionTarget[] = [];
    if (selectedKeys.size > 0) {
      const fromMulti = multiList.filter((t) =>
        selectedKeys.has(
          `${t.vertical}|${t.org}|${t.batch}|${t.term}|${t.section}`
        )
      );
      if (fromMulti.length) targets.push(...fromMulti);
      else if (path.section) {
        targets.push({
          vertical: path.vertical,
          org: path.org,
          batch: path.batch,
          term: path.term,
          section: path.section,
          label: breadcrumbParts.join(' › '),
        });
      }
    } else if (path.section) {
      targets.push({
        vertical: path.vertical,
        org: path.org,
        batch: path.batch,
        term: path.term,
        section: path.section,
        label: breadcrumbParts.join(' › '),
      });
    }

    if (!targets.length) {
      showToast('Select at least one section', 'error');
      return;
    }

    if (useAssignFilter) {
      for (const t of targets) {
        if (
          !facultyCanAccessPath(myAssignments, {
            org: t.org,
            batch: t.batch,
            term: t.term,
            section: t.section,
          })
        ) {
          showToast(`Not assigned to ${t.section}`, 'error');
          return;
        }
      }
    }

    if (
      rubricMode === 'write' &&
      questions.every((q) => !q.questionText?.trim())
    ) {
      showToast('Add question text or upload rubric', 'error');
      return;
    }
    if (rubricMode === 'upload' && !rubricFileUrl && !rubricFile) {
      showToast('Upload rubric or switch to Write', 'error');
      return;
    }

    setSaving(true);
    let created = 0;
    try {
      for (const t of targets) {
        const examId = genId('exam');
        const rubricId = genId('rubric');
        const exam: Exam = {
          id: examId,
          title: title.trim(),
          code: `${code.trim().toUpperCase()}${
            targets.length > 1 ? `-${t.section.replace(/\s+/g, '')}` : ''
          }`,
          subject,
          facultyId: currentUser.id,
          facultyName: currentUser.name,
          date,
          duration: parseInt(duration, 10) || 180,
          maxMarks:
            rubricMode === 'write' ? totalRubricMarks : totalRubricMarks || 100,
          status: 'ACTIVE',
          studentIds: [],
          rubricId,
          description: buildNotesForTarget(t),
          createdAt: new Date().toISOString(),
        };

        const rubric: Rubric = {
          id: rubricId,
          examId,
          questions:
            rubricMode === 'write'
              ? questions
              : [
                  {
                    id: genId('rq'),
                    number: '1',
                    questionText: rubricFile
                      ? `See uploaded rubric: ${rubricFile.name}`
                      : 'See uploaded rubric',
                    maxMarks: totalRubricMarks || 100,
                    criteria: [
                      {
                        id: genId('rc'),
                        description: rubricFileUrl || 'Uploaded rubric',
                        maxMarks: totalRubricMarks || 100,
                      },
                    ],
                  },
                ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await createExam(exam);
        createRubric(rubric);
        created++;
      }
      setSuccessCount(created);
      setSuccessModal(true);
      showToast(
        created > 1
          ? `Created ${created} exams (one per section)`
          : 'Exam saved',
        'success'
      );
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ——— Mode picker ———
  if (createMode === null) {
    return (
      <PageContainer>
        <PageHeader
          title="Create Exam"
          subtitle="Choose how you want to pick sections"
          breadcrumb="Faculty"
          showBack
          backTo="/faculty"
        />
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <button
            type="button"
            onClick={() => {
              setCreateMode('assigned');
              setLevel('vertical');
              setPath({ ...EMPTY_PATH });
            }}
            className="text-left p-6 rounded-xl border-2 border-navy-200 bg-navy-50/40 hover:border-navy-500 transition-all"
          >
            <p className="font-semibold text-navy-900 text-lg mb-1">
              HOD assigned
            </p>
            <p className="text-sm text-slate-600">
              Only batches / terms / sections your HOD assigned to you.
            </p>
            {!assignLoading && (
              <p className="text-xs text-slate-500 mt-2">
                {myAssignments.length} assignment
                {myAssignments.length !== 1 ? 's' : ''}
              </p>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateMode('free');
              setLevel('vertical');
              setPath({ ...EMPTY_PATH });
            }}
            className="text-left p-6 rounded-xl border-2 border-slate-200 bg-white hover:border-navy-400 transition-all"
          >
            <p className="font-semibold text-slate-900 text-lg mb-1">
              Create freely
            </p>
            <p className="text-sm text-slate-600">
              Full Exam Structure — same as before. Any path.
            </p>
          </button>
        </div>
      </PageContainer>
    );
  }

  // ——— Multi-select sections ———
  if (level === 'multi-pick') {
    return (
      <PageContainer>
        <PageHeader
          title="Select sections"
          subtitle="Check one or more sections — one exam will be created for each"
          breadcrumb="Faculty"
          showBack
          backTo="/faculty"
        />
        <Button variant="ghost" size="sm" className="mb-4" onClick={goBack}>
          ← Back
        </Button>

        {multiList.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-8">
              No sections found under this path.
            </p>
          </Card>
        ) : (
          <Card className="space-y-2 mb-4">
            {multiList.map((t) => {
              const key = `${t.vertical}|${t.org}|${t.batch}|${t.term}|${t.section}`;
              const checked = selectedKeys.has(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                    checked
                      ? 'border-navy-500 bg-navy-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKey(key)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-800">{t.label}</span>
                </label>
              );
            })}
          </Card>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedKeys(
                new Set(
                  multiList.map(
                    (t) =>
                      `${t.vertical}|${t.org}|${t.batch}|${t.term}|${t.section}`
                  )
                )
              );
            }}
          >
            Select all
          </Button>
          <Button
            disabled={selectedKeys.size === 0}
            onClick={() => {
              setLevel('form');
              setFormStep(0);
              if (!title && multiList[0]) setTitle(multiList[0].section);
            }}
          >
            Continue ({selectedKeys.size}) →
          </Button>
        </div>
      </PageContainer>
    );
  }

  // ——— Tree browse ———
  if (level !== 'form') {
    const noAssign =
      useAssignFilter &&
      currentUser.role === 'faculty' &&
      !assignLoading &&
      myAssignments.length === 0;

    return (
      <PageContainer>
        <PageHeader
          title={
            level === 'vertical'
              ? 'Select Vertical / Client'
              : LEVEL_TITLES[level as TreeLevel]
          }
          subtitle={
            useAssignFilter
              ? 'HOD-assigned paths only'
              : 'Full structure — create freely'
          }
          breadcrumb="Faculty"
          showBack
          backTo="/faculty"
        />

        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <Badge variant={useAssignFilter ? 'navy' : 'muted'}>
            {useAssignFilter ? 'Assigned' : 'Free'}
          </Badge>
          <button
            type="button"
            className="text-xs text-navy-600 hover:underline"
            onClick={() => setCreateMode(null)}
          >
            Change mode
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <button
            type="button"
            className="text-navy-600 hover:underline"
            onClick={() => jumpCrumb(-1)}
          >
            Root
          </button>
          {crumbsForJump.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-slate-300">›</span>
              <button
                type="button"
                className="font-medium text-navy-700 hover:underline"
                onClick={() => jumpCrumb(i)}
              >
                {part}
              </button>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Back
          </Button>
          {(level === 'org' ||
            level === 'batch' ||
            level === 'term' ||
            level === 'section') && (
            <Button size="sm" variant="secondary" onClick={openMultiPick}>
              Multi-select sections ☑
            </Button>
          )}
        </div>

        {treeLoading || assignLoading ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-10">
              Loading…
            </p>
          </Card>
        ) : noAssign ? (
          <Card>
            <p className="text-sm text-amber-800 text-center py-10">
              No HOD assignments.
              <br />
              <button
                type="button"
                className="text-navy-700 underline text-xs mt-2"
                onClick={() => setCreateMode('free')}
              >
                Switch to Create freely
              </button>
            </p>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-10">
              Nothing here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => openItem(name)}
                className="text-left p-5 rounded-xl border-2 border-slate-200 bg-white hover:border-navy-400 hover:shadow-md transition-all"
              >
                <p className="font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-400 mt-1">Tap to open →</p>
              </button>
            ))}
          </div>
        )}
      </PageContainer>
    );
  }

  // ——— Form ———
  return (
    <PageContainer>
      <PageHeader
        title="Create Exam"
        subtitle={
          selectedKeys.size > 1
            ? `${selectedKeys.size} sections selected`
            : breadcrumbParts.join(' › ')
        }
        breadcrumb="Faculty"
        showBack
        backTo="/faculty"
      />

      {selectedKeys.size > 0 && (
        <Card className="mb-4 text-xs text-slate-600">
          <p className="font-medium text-slate-800 mb-1">
            Will create {selectedKeys.size} exam
            {selectedKeys.size !== 1 ? 's' : ''} (one per section)
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {[...selectedKeys].slice(0, 8).map((k) => (
              <li key={k}>{k.split('|').slice(1).join(' › ')}</li>
            ))}
            {selectedKeys.size > 8 && (
              <li>…and {selectedKeys.size - 8} more</li>
            )}
          </ul>
        </Card>
      )}

      <Button variant="ghost" size="sm" className="mb-4" onClick={goBack}>
        ← Back
      </Button>

      <div className="flex gap-2 mb-6 text-xs font-medium">
        {['Details', 'Rubric'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setFormStep(i as 0 | 1)}
            className={`px-3 py-1.5 rounded-full ${
              formStep === i
                ? 'bg-navy-900 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {formStep === 0 && (
        <div className="max-w-xl space-y-4">
          <Card className="space-y-4">
            <Input
              label="Exam Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Exam Code *"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <Select
                label="Subject"
                options={SUBJECTS}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Exam Date *"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input
                label="Duration (min)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <Textarea
              label="Description (optional)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Card>
          <Button
            disabled={!title || !code || !date}
            onClick={() => setFormStep(1)}
          >
            Next: Rubric →
          </Button>
        </div>
      )}

      {formStep === 1 && (
        <div className="max-w-2xl space-y-6">
          <Card className="border-2 border-dashed border-navy-200 bg-navy-50/30">
            <h3 className="font-semibold text-navy-900 text-center mb-1">
              Upload QP &amp; Ans
            </h3>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <input
                ref={qpAnsRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={handleQpAnsChange}
              />
              <Button
                variant="secondary"
                loading={uploadingQpAns}
                onClick={() => qpAnsRef.current?.click()}
              >
                {qpAnsFiles.length ? 'Change files' : 'Upload'}
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 mb-1">Rubrics</h3>
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setRubricMode('write')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium ${
                  rubricMode === 'write'
                    ? 'border-navy-700 bg-navy-50'
                    : 'border-slate-200'
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setRubricMode('upload')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium ${
                  rubricMode === 'upload'
                    ? 'border-navy-700 bg-navy-50'
                    : 'border-slate-200'
                }`}
              >
                Upload
              </button>
            </div>

            {rubricMode === 'upload' && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                <input
                  ref={rubricRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={handleRubricFileChange}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  loading={uploadingRubric}
                  onClick={() => rubricRef.current?.click()}
                >
                  {rubricFile ? 'Change file' : 'Choose rubric'}
                </Button>
              </div>
            )}

            {rubricMode === 'write' && (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <p className="text-sm text-slate-500">
                    Total: <span className="font-mono">{totalRubricMarks}</span>
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setQuestions((prev) => [
                        ...prev,
                        {
                          id: genId('rq'),
                          number: String(prev.length + 1),
                          questionText: '',
                          maxMarks: 10,
                          criteria: [
                            {
                              id: genId('rc'),
                              description: '',
                              maxMarks: 10,
                            },
                          ],
                        },
                      ])
                    }
                  >
                    + Question
                  </Button>
                </div>
                {questions.map((q, qi) => (
                  <Card key={q.id} className="space-y-3 bg-slate-50">
                    <span className="font-medium">Q{qi + 1}</span>
                    <Textarea
                      label="Question text"
                      rows={2}
                      value={q.questionText}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x) =>
                            x.id === q.id
                              ? { ...x, questionText: e.target.value }
                              : x
                          )
                        )
                      }
                    />
                    <Input
                      label="Max marks"
                      type="number"
                      value={q.maxMarks}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x) =>
                            x.id === q.id
                              ? {
                                  ...x,
                                  maxMarks: parseInt(e.target.value, 10) || 0,
                                }
                              : x
                          )
                        )
                      }
                    />
                  </Card>
                ))}
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setFormStep(0)}>
              ← Back
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Create Exam
              {selectedKeys.size > 1 ? ` × ${selectedKeys.size}` : ''}
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={successModal}
        onClose={() => {
          setSuccessModal(false);
          navigate('/faculty');
        }}
        title="Exam Created"
      >
        <div className="text-center py-4">
          <p className="font-semibold text-slate-900 mb-2">
            {successCount > 1
              ? `${successCount} exams created`
              : `“${title}” is live`}
          </p>
          <Button
            className="w-full"
            onClick={() => {
              setSuccessModal(false);
              navigate('/faculty');
            }}
          >
            Go to Dashboard
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}