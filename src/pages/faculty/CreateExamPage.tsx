import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Button,
  Card,
  Input,
  Textarea,
  Select,
  Badge,
  Modal,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Exam, Rubric, RubricQuestion, User } from '../../types';
import { supabase } from '../../lib/supabase';
import {
  loadExamTree,
  getItemsAtLevel,
  EMPTY_PATH,
  LEVEL_TITLES,
  pathFromCrumbs,
  type TreeLevel,
  type TreePath,
} from '../../lib/exam-tree';

type Level = TreeLevel | 'form';

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

async function loadStudentsFromCloud(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('name');
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as User['role'],
    avatarInitials:
      row.avatar_initials || row.name?.slice(0, 2).toUpperCase() || 'ST',
    studentId: row.student_id,
    department: row.department,
    calibrated: row.calibrated || false,
  }));
}

export default function CreateExamPage() {
  const { state, createExam, createRubric, showToast } = useApp();
  const navigate = useNavigate();
  const { currentUser, users } = state;

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
  const [questions, setQuestions] = useState<RubricQuestion[]>([
    {
      id: genId('rq'),
      number: '1',
      questionText: '',
      maxMarks: 10,
      criteria: [{ id: genId('rc'), description: '', maxMarks: 10 }],
    },
  ]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentList, setStudentList] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [formStep, setFormStep] = useState<0 | 1 | 2>(0);

  // Load shared tree (admin updates → faculty sees)
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingStudents(true);
      const fromContext = (users || []).filter((u) => u.role === 'student');
      if (fromContext.length > 0) {
        if (!cancelled) {
          setStudentList(fromContext);
          setLoadingStudents(false);
        }
        return;
      }
      const fromCloud = await loadStudentsFromCloud();
      if (!cancelled) {
        setStudentList(fromCloud);
        setLoadingStudents(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [users]);

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

  async function handleSave() {
    if (!title || !code || !date) {
      showToast('Fill title, code and date', 'error');
      return;
    }
    setSaving(true);
    try {
      const examId = genId('exam');
      const rubricId = genId('rubric');
      const hierarchyPath = breadcrumbParts.join(' > ');

      const exam: Exam = {
        id: examId,
        title: title.trim(),
        code: code.trim().toUpperCase(),
        subject,
        facultyId: currentUser.id,
        facultyName: currentUser.name,
        date,
        duration: parseInt(duration, 10) || 180,
        maxMarks: totalRubricMarks,
        status: 'ACTIVE',
        studentIds: selectedStudents,
        rubricId,
        description: [
          description.trim(),
          hierarchyPath ? `Path: ${hierarchyPath}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        createdAt: new Date().toISOString(),
      };

      const rubric: Rubric = {
        id: rubricId,
        examId,
        questions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createExam(exam);
      createRubric(rubric);
      setSuccessModal(true);
      showToast('Exam saved', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ——— Hierarchy browser (NO add / delete) ———
  if (level !== 'form') {
    return (
      <PageContainer>
        <PageHeader
          title={
            level === 'vertical'
              ? 'Select Vertical / Client'
              : LEVEL_TITLES[level as TreeLevel]
          }
          subtitle="Browse structure set by Admin. Tap a card to open next level."
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
              Nothing here. Ask Admin to add items under{' '}
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

  // ——— Exam form ———
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
              onClick={() => {
                jumpCrumb(i);
              }}
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
        {['Details', 'Rubric', 'Students'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setFormStep(i as 0 | 1 | 2)}
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
              label="Description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-slate-400">
              Path: {breadcrumbParts.join(' › ') || '—'}
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
        <div className="max-w-2xl space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              Total marks:{' '}
              <span className="font-mono font-semibold">{totalRubricMarks}</span>
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
                      { id: genId('rc'), description: '', maxMarks: 10 },
                    ],
                  },
                ])
              }
            >
              + Question
            </Button>
          </div>
          {questions.map((q, qi) => (
            <Card key={q.id} className="space-y-3">
              <div className="flex justify-between">
                <span className="font-medium">Q{qi + 1}</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-red-500"
                    onClick={() =>
                      setQuestions((prev) => prev.filter((x) => x.id !== q.id))
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
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setFormStep(0)}>
              ← Back
            </Button>
            <Button onClick={() => setFormStep(2)}>Next: Students →</Button>
          </div>
        </div>
      )}

      {formStep === 2 && (
        <div className="max-w-xl space-y-4">
          <Card>
            <div className="flex justify-between mb-3">
              <h3 className="font-semibold text-sm">Enrol Students</h3>
              <Badge variant="navy">{selectedStudents.length} selected</Badge>
            </div>
            {loadingStudents ? (
              <p className="text-sm text-slate-400 text-center py-6">Loading…</p>
            ) : studentList.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No students found.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {studentList.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(s.id)}
                      onChange={() =>
                        setSelectedStudents((prev) =>
                          prev.includes(s.id)
                            ? prev.filter((x) => x !== s.id)
                            : [...prev, s.id]
                        )
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 truncate">{s.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Card>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setFormStep(1)}>
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
          <p className="text-xs text-slate-500 mb-4">
            {breadcrumbParts.join(' › ')}
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