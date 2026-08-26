import React, { useState, useRef, useEffect } from 'react';
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
  StepIndicator,
} from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Exam, Rubric, RubricQuestion, RubricCriterion, User } from '../../types';
import { supabase } from '../../lib/supabase';

type Step = 0 | 1 | 2;

const SUBJECTS = [
  { value: 'Computer Science', label: 'Computer Science' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Physics', label: 'Physics' },
  { value: 'Chemistry', label: 'Chemistry' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'Economics', label: 'Economics' },
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
    console.error('loadStudentsFromCloud', error);
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
  const [step, setStep] = useState<Step>(0);

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('180');
  const [description, setDescription] = useState('');

  const [questions, setQuestions] = useState<RubricQuestion[]>([
    {
      id: genId('rq'),
      number: '1',
      questionText: '',
      maxMarks: 10,
      criteria: [{ id: genId('rc'), description: '', maxMarks: 10, order: '' }],
    },
  ]);

  const [extracting, setExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [studentList, setStudentList] = useState<User[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

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

  const totalRubricMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);
  const allSelected =
    studentList.length > 0 && selectedStudents.length === studentList.length;

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        id: genId('rq'),
        number: String(prev.length + 1),
        questionText: '',
        maxMarks: 10,
        criteria: [{ id: genId('rc'), description: '', maxMarks: 10 }],
      },
    ]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) =>
      prev
        .filter((q) => q.id !== id)
        .map((q, i) => ({ ...q, number: String(i + 1) }))
    );
  }

  function updateQuestion(id: string, patch: Partial<RubricQuestion>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  }

  function addCriterion(qId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              criteria: [
                ...q.criteria,
                { id: genId('rc'), description: '', maxMarks: 2 },
              ],
            }
          : q
      )
    );
  }

  function removeCriterion(qId: string, cId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, criteria: q.criteria.filter((c) => c.id !== cId) }
          : q
      )
    );
  }

  function updateCriterion(
    qId: string,
    cId: string,
    patch: Partial<RubricCriterion>
  ) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              criteria: q.criteria.map((c) =>
                c.id === cId ? { ...c, ...patch } : c
              ),
            }
          : q
      )
    );
  }

  function syncQuestionMarks(qId: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const total = q.criteria.reduce((sum, c) => sum + (c.maxMarks || 0), 0);
        return { ...q, maxMarks: total };
      })
    );
  }

  function toggleStudent(id: string) {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(studentList.map((s) => s.id));
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg',
    ];

    if (
      !allowed.includes(file.type) &&
      !file.name.match(/\.(pdf|docx?|jpe?g|png|webp)$/i)
    ) {
      showToast('Please upload PDF, Word, or Image file only.', 'error');
      return;
    }

    setUploadedFileName(file.name);
    setExtracting(true);

    try {
      await new Promise((r) => setTimeout(r, 2200));

      const extracted: RubricQuestion[] = [
        {
          id: genId('rq'),
          number: '1',
          questionText:
            'Explain the difference between stack and queue with suitable examples.',
          maxMarks: 10,
          criteria: [
            {
              id: genId('rc'),
              description: 'Correct definition of stack and queue',
              maxMarks: 3,
            },
            {
              id: genId('rc'),
              description: 'Difference points (LIFO vs FIFO)',
              maxMarks: 4,
            },
            {
              id: genId('rc'),
              description: 'Valid examples for both',
              maxMarks: 3,
            },
          ],
        },
        {
          id: genId('rq'),
          number: '2',
          questionText:
            'Write an algorithm for binary search and analyse its time complexity.',
          maxMarks: 12,
          criteria: [
            {
              id: genId('rc'),
              description: 'Correct binary search algorithm',
              maxMarks: 6,
            },
            {
              id: genId('rc'),
              description: 'Time complexity analysis (best/avg/worst)',
              maxMarks: 4,
            },
            {
              id: genId('rc'),
              description: 'Space complexity mentioned',
              maxMarks: 2,
            },
          ],
        },
        {
          id: genId('rq'),
          number: '3',
          questionText:
            'What is a Binary Search Tree? Insert the following elements and draw the tree: 50, 30, 70, 20, 40, 60, 80.',
          maxMarks: 8,
          criteria: [
            { id: genId('rc'), description: 'Definition of BST', maxMarks: 2 },
            {
              id: genId('rc'),
              description: 'Correct tree construction',
              maxMarks: 6,
            },
          ],
        },
      ];

      setQuestions(extracted);
      showToast(
        `Extracted ${extracted.length} questions from "${file.name}"`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast(
        'Failed to extract questions. Please try again or enter manually.',
        'error'
      );
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // FIXED: define exam/rubric FIRST, then await createExam once
  async function handleSave() {
    if (!title || !code || !date) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    if (!currentUser) {
      showToast('Not logged in', 'error');
      return;
    }

    setSaving(true);

    try {
      const examId = genId('exam');
      const rubricId = genId('rubric');

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
        description: description.trim(),
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
      showToast('Exam saved successfully', 'success');
    } catch (e: any) {
      console.error('handleSave error', e);
      showToast(e?.message || 'Exam save failed. Check console.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create New Exam"
        subtitle="Define the exam details, rubric, and enrol students."
        breadcrumb="Faculty"
        showBack
        backTo="/faculty"
      />

      <div className="mb-8 max-w-2xl">
        <StepIndicator
          steps={['Exam Details', 'Rubric', 'Students']}
          current={step}
        />
      </div>

      {step === 0 && (
        <div className="max-w-xl space-y-5">
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Exam Information</h3>
            <div className="space-y-4">
              <Input
                label="Exam Title *"
                placeholder="e.g. Data Structures and Algorithms"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Exam Code *"
                  placeholder="e.g. CS201"
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
                  label="Duration (minutes)"
                  type="number"
                  min="30"
                  max="300"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <Textarea
                label="Description (optional)"
                placeholder="Brief description of topics covered…"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate('/faculty')}>
              Cancel
            </Button>
            <Button
              disabled={!title || !code || !date}
              onClick={() => setStep(1)}
            >
              Next: Rubric →
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="max-w-2xl">
          <Card className="mb-6 border-dashed border-2 border-navy-200 bg-navy-50/40">
            <div className="text-center py-2">
              <p className="font-semibold text-navy-900 mb-1">Upload Exam Paper</p>
              <p className="text-xs text-slate-500 mb-4">
                PDF, Word (.docx) or Image → AI will extract questions, marks &
                criteria
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={extracting}
              />

              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                loading={extracting}
              >
                {extracting ? 'Extracting questions…' : 'Choose File to Extract'}
              </Button>

              {uploadedFileName && !extracting && (
                <p className="text-xs text-emerald-600 mt-3">
                  ✓ Extracted from:{' '}
                  <span className="font-medium">{uploadedFileName}</span>
                </p>
              )}
            </div>
          </Card>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-500">
                Total marks:{' '}
                <span className="font-semibold text-slate-900 font-mono">
                  {totalRubricMarks}
                </span>
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={addQuestion}>
              + Add Question
            </Button>
          </div>

          <div className="space-y-5">
            {questions.map((q, qi) => (
              <Card key={q.id}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-navy-900 text-white rounded-lg flex items-center justify-center text-sm font-semibold shrink-0">
                      {qi + 1}
                    </div>
                    <span className="font-medium text-slate-800">
                      Question {q.number}
                    </span>
                    <Badge variant="muted" className="font-mono">
                      {q.maxMarks} marks
                    </Badge>
                  </div>
                  {questions.length > 1 && (
                    <button
                      onClick={() => removeQuestion(q.id)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mb-4">
                  <Textarea
                    label="Question text *"
                    placeholder="Enter the question as it appears on the exam paper…"
                    rows={2}
                    value={q.questionText}
                    onChange={(e) =>
                      updateQuestion(q.id, { questionText: e.target.value })
                    }
                  />
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">
                      Marking Criteria
                    </p>
                    <button
                      onClick={() => addCriterion(q.id)}
                      className="text-xs text-navy-600 hover:text-navy-800"
                    >
                      + Add criterion
                    </button>
                  </div>
                  <div className="space-y-2">
                    {q.criteria.map((c, ci) => (
                      <div
                        key={c.id}
                        className="flex items-start gap-2 bg-slate-50 rounded-lg p-2.5"
                      >
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              className="w-full h-8 px-2.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-navy-700"
                              placeholder={`Criterion ${ci + 1} description…`}
                              value={c.description}
                              onChange={(e) =>
                                updateCriterion(q.id, c.id, {
                                  description: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="w-16 h-8 px-2 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-navy-700 font-mono text-center"
                              value={c.maxMarks}
                              onChange={(e) => {
                                updateCriterion(q.id, c.id, {
                                  maxMarks: parseInt(e.target.value) || 0,
                                });
                                setTimeout(() => syncQuestionMarks(q.id), 0);
                              }}
                            />
                            <span className="text-xs text-slate-400">marks</span>
                          </div>
                        </div>
                        {q.criteria.length > 1 && (
                          <button
                            onClick={() => removeCriterion(q.id, c.id)}
                            className="text-slate-400 hover:text-red-500 text-xs mt-0.5 shrink-0"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex gap-3 mt-5">
            <Button variant="ghost" onClick={() => setStep(0)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(2)}>Next: Students →</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-xl">
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Enrol Students</h3>
              <div className="flex items-center gap-3">
                {studentList.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs font-medium text-navy-600 hover:text-navy-800"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <Badge variant="navy">{selectedStudents.length} selected</Badge>
              </div>
            </div>

            {loadingStudents ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Loading students…
              </p>
            ) : studentList.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-700 mb-1">
                  No students found
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                  Register at least one account with role <strong>Student</strong>{' '}
                  from the Sign Up page. Then refresh this page.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    setLoadingStudents(true);
                    const list = await loadStudentsFromCloud();
                    setStudentList(list);
                    setLoadingStudents(false);
                    if (list.length === 0) {
                      showToast(
                        'Still no students. Please register a student account first.',
                        'info'
                      );
                    }
                  }}
                >
                  Refresh list
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {studentList.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="w-4 h-4 rounded accent-navy-900"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {student.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {student.email}
                        {student.studentId ? ` · ${student.studentId}` : ''}
                        {student.department ? ` · ${student.department}` : ''}
                        {!student.calibrated && (
                          <span className="ml-2 text-amber-600">
                            · Not calibrated
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </Card>

          <Card className="mb-5 bg-navy-50 border-navy-200">
            <h3 className="font-semibold text-navy-900 text-sm mb-3">
              Exam Summary
            </h3>
            <dl className="text-sm space-y-1">
              <div className="flex gap-2">
                <dt className="text-navy-600 w-24 shrink-0">Title</dt>
                <dd className="font-medium text-navy-900">{title}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-navy-600 w-24 shrink-0">Code</dt>
                <dd className="font-medium text-navy-900">{code}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-navy-600 w-24 shrink-0">Date</dt>
                <dd className="font-medium text-navy-900">{date}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-navy-600 w-24 shrink-0">Questions</dt>
                <dd className="font-medium text-navy-900">{questions.length}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-navy-600 w-24 shrink-0">Max marks</dt>
                <dd className="font-medium text-navy-900">{totalRubricMarks}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-navy-600 w-24 shrink-0">Students</dt>
                <dd className="font-medium text-navy-900">
                  {selectedStudents.length}
                </dd>
              </div>
            </dl>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>
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
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-3xl mx-auto mb-4">
            ✓
          </div>
          <p className="font-semibold text-slate-900 mb-1">
            &ldquo;{title}&rdquo; is live
          </p>
          <p className="text-sm text-slate-500 mb-5">
            The exam has been created and {selectedStudents.length} student
            {selectedStudents.length !== 1 ? 's' : ''} enrolled. Students can now
            submit their answer sheets.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setSuccessModal(false);
                navigate('/faculty');
              }}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}