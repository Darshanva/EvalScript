import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Modal,
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

type Level = TreeLevel | 'form';
type RubricMode = 'write' | 'upload';

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

export default function CreateExamPage() {
  const { state, createExam, createRubric, showToast } = useApp();
  const navigate = useNavigate();
  const { currentUser } = state;

  const [tree, setTree] = useState<Record<string, any>>({});
  const [treeLoading, setTreeLoading] = useState(true);
  const [level, setLevel] = useState<Level>('vertical');
  const [path, setPath] = useState<TreePath>({ ...EMPTY_PATH });

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
    window.addEventListener('storage', onUpd);
    return () => {
      cancelled = true;
      window.removeEventListener('exam-tree-updated', onUpd);
      window.removeEventListener('storage', onUpd);
    };
  }, []);

  if (!currentUser) return null;

  const totalRubricMarks = questions.reduce((s, q) => s + (q.maxMarks || 0), 0);
  const treeLevel: TreeLevel =
    level === 'form' ? 'subject' : (level as TreeLevel);
  const items =
    level === 'form' ? [] : getItemsAtLevel(tree, treeLevel, path);

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
      setPath((p) => ({ ...p, org: name }));
      setLevel('batch');
    } else if (level === 'batch') {
      setPath((p) => ({ ...p, batch: name }));
      setLevel('term');
    } else if (level === 'term') {
      setPath((p) => ({ ...p, term: name }));
      setLevel('section');
    } else if (level === 'section') {
      setPath((p) => ({ ...p, section: name }));
      setLevel('subject');
    } else if (level === 'subject') {
      setPath((p) => ({ ...p, subject: name }));
      setTitle(name);
      setLevel('form');
      setFormStep(0);
    }
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
    navigate('/faculty');
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
    if (urls.length) {
      showToast(`${urls.length} file(s) uploaded (QP & Ans)`, 'success');
    } else {
      showToast('Upload failed — check storage bucket', 'error');
    }
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
      showToast('Rubric file uploaded', 'success');
    } else {
      showToast('Rubric upload failed', 'error');
    }
  }

  async function handleSave() {
    if (!title || !code || !date) {
      showToast('Fill title, code and date', 'error');
      return;
    }
    if (
      rubricMode === 'write' &&
      questions.every((q) => !q.questionText?.trim())
    ) {
      showToast('Add question text, or switch to Upload rubric', 'error');
      return;
    }
    if (rubricMode === 'upload' && !rubricFileUrl && !rubricFile) {
      showToast('Upload a rubric file, or switch to Write', 'error');
      return;
    }

    setSaving(true);
    try {
      const examId = genId('exam');
      const rubricId = genId('rubric');

      const hierarchyPath =
        typeof formatHierarchyPath === 'function'
          ? formatHierarchyPath(path)
          : breadcrumbParts.join(' › ');

      // Machine-readable tags for student matching (AppContext)
      const tags = [
        path.vertical && `[vertical:${path.vertical}]`,
        path.org && `[org:${path.org}]`,
        path.batch && `[batch:${path.batch}]`,
        path.term && `[term:${path.term}]`,
        path.section && `[section:${path.section}]`,
        path.subject && `[subject:${path.subject}]`,
      ].filter(Boolean);

      const sectionLabel = path.section
        ? path.section.match(/^[A-Za-z]$/)
          ? `Section ${path.section.toUpperCase()}`
          : path.section
        : '';

      const extraNotes = [
        description.trim(),
        hierarchyPath ? `Path: ${hierarchyPath}` : '',
        ...tags,
        sectionLabel,
        path.batch ? `Batch: ${path.batch}` : '',
        path.term ? `Term: ${path.term}` : '',
        qpAnsUrls.length ? `QP&Ans: ${qpAnsUrls.join(', ')}` : '',
        rubricFileUrl ? `RubricFile: ${rubricFileUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const exam: Exam = {
        id: examId,
        title: title.trim(),
        code: code.trim().toUpperCase(),
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
        description: extraNotes,
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
                    : 'See uploaded rubric file',
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
      setSuccessModal(true);
      showToast('Exam saved for batch/section', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (level !== 'form') {
    return (
      <PageContainer>
        <PageHeader
          title={
            level === 'vertical'
              ? 'Select Vertical / Client'
              : LEVEL_TITLES[level as TreeLevel]
          }
          subtitle="Pick Batch → Term → Section → Subject. Exams are for the section, not individual students."
          breadcrumb="Faculty"
          showBack
          backTo="/faculty"
        />

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

        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" onClick={goBack}>
            ← Back
          </Button>
        </div>

        {treeLoading ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-10">
              Loading structure…
            </p>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-10">
              Nothing here. Ask Admin / HOD to add items under{' '}
              <strong>Exam Structure</strong>.
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

  return (
    <PageContainer>
      <PageHeader
        title="Create Exam"
        subtitle={breadcrumbParts.join(' › ')}
        breadcrumb="Faculty"
        showBack
        backTo="/faculty"
      />

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
        {path.subject && (
          <span className="flex items-center gap-1">
            <span className="text-slate-300">›</span>
            <span className="font-medium text-slate-700">{path.subject}</span>
          </span>
        )}
      </div>

      <Button variant="ghost" size="sm" className="mb-4" onClick={goBack}>
        ← Back to subjects
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
            <p className="text-xs text-slate-500">
              Target: <strong>{breadcrumbParts.join(' › ') || '—'}</strong>
              {path.section ? (
                <>
                  {' '}
                  · Section:{' '}
                  <strong>{path.section}</strong>
                </>
              ) : null}
            </p>
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
            <p className="text-xs text-slate-500 text-center mb-5">
              Question paper + answer key (multiple files OK)
            </p>
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
              {qpAnsFiles.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {qpAnsFiles.map((f) => (
                    <li
                      key={f.name + f.size}
                      className="text-xs text-emerald-600 truncate"
                    >
                      ✓ {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 mb-1">Rubrics</h3>
            <p className="text-xs text-slate-500 mb-4">Write or upload</p>
            <div className="flex gap-2 mb-5">
              <button
                type="button"
                onClick={() => setRubricMode('write')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium ${
                  rubricMode === 'write'
                    ? 'border-navy-700 bg-navy-50 text-navy-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setRubricMode('upload')}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium ${
                  rubricMode === 'upload'
                    ? 'border-navy-700 bg-navy-50 text-navy-900'
                    : 'border-slate-200 text-slate-600'
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
                  {rubricFile ? 'Change file' : 'Choose rubric file'}
                </Button>
                {rubricFile && (
                  <p className="text-xs text-emerald-600 mt-3">
                    ✓ {rubricFile.name}
                  </p>
                )}
              </div>
            )}

            {rubricMode === 'write' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-500">
                    Total:{' '}
                    <span className="font-mono font-semibold">
                      {totalRubricMarks}
                    </span>
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
                    <div className="flex justify-between">
                      <span className="font-medium">Q{qi + 1}</span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-500"
                          onClick={() =>
                            setQuestions((prev) =>
                              prev.filter((x) => x.id !== q.id)
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
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
            &ldquo;{title}&rdquo; is live
          </p>
          <p className="text-xs text-slate-500 mb-1">
            {breadcrumbParts.join(' › ')}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Tags saved for student section matching
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