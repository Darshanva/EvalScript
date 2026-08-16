import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button, Card, Input, Textarea, Select, Badge, Modal, StepIndicator } from '../../components/ui';
import { PageContainer, PageHeader } from '../../components/Layout';
import type { Exam, Rubric, RubricQuestion, RubricCriterion } from '../../types';

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

export default function CreateExamPage() {
  const { state, navigate, createExam, createRubric, showToast } = useApp();
  const { currentUser, users } = state;
  const [step, setStep] = useState<Step>(0);

  // Exam fields
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('180');
  const [description, setDescription] = useState('');

  // Rubric
  const [questions, setQuestions] = useState<RubricQuestion[]>([
    {
      id: genId('rq'),
      number: '1',
      questionText: '',
      maxMarks: 10,
      criteria: [{ id: genId('rc'), description: '', maxMarks: 10, guidance: '' }],
    },
  ]);

  // Students
  const studentList = users.filter((u) => u.role === 'student');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  if (!currentUser) return null;

  const totalRubricMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);

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
    setQuestions((prev) => prev.filter((q) => q.id !== id).map((q, i) => ({ ...q, number: String(i + 1) })));
  }

  function updateQuestion(id: string, patch: Partial<RubricQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function addCriterion(qId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, criteria: [...q.criteria, { id: genId('rc'), description: '', maxMarks: 2 }] }
          : q
      )
    );
  }

  function removeCriterion(qId: string, cId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, criteria: q.criteria.filter((c) => c.id !== cId) } : q
      )
    );
  }

  function updateCriterion(qId: string, cId: string, patch: Partial<RubricCriterion>) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, criteria: q.criteria.map((c) => (c.id === cId ? { ...c, ...patch } : c)) }
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

  async function handleSave() {
    if (!title || !code || !date) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));

    const examId = genId('exam');
    const rubricId = genId('rubric');

    const exam: Exam = {
      id: examId,
      title,
      code,
      subject,
      facultyId: currentUser!.id,
      facultyName: currentUser!.name,
      date,
      duration: parseInt(duration) || 180,
      maxMarks: totalRubricMarks,
      status: 'ACTIVE',
      studentIds: selectedStudents,
      rubricId,
      description,
      createdAt: new Date().toISOString(),
    };

    const rubric: Rubric = {
      id: rubricId,
      examId,
      questions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    createExam(exam);
    createRubric(rubric);
    setSaving(false);
    setSuccessModal(true);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create New Exam"
        subtitle="Define the exam details, rubric, and enrol students."
        breadcrumb="Faculty"
      />

      <div className="mb-8 max-w-2xl">
        <StepIndicator steps={['Exam Details', 'Rubric', 'Students']} current={step} />
      </div>

      {/* Step 0: Exam details */}
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
            <Button variant="ghost" onClick={() => navigate('f-dashboard')}>Cancel</Button>
            <Button
              disabled={!title || !code || !date}
              onClick={() => setStep(1)}
            >
              Next: Rubric →
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Rubric */}
      {step === 1 && (
        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-500">
                Total marks:{' '}
                <span className="font-semibold text-slate-900 font-mono">{totalRubricMarks}</span>
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
                    <span className="font-medium text-slate-800">Question {q.number}</span>
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
                    onChange={(e) => updateQuestion(q.id, { questionText: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">Marking Criteria</p>
                    <button
                      onClick={() => addCriterion(q.id)}
                      className="text-xs text-navy-600 hover:text-navy-800"
                    >
                      + Add criterion
                    </button>
                  </div>
                  <div className="space-y-2">
                    {q.criteria.map((c, ci) => (
                      <div key={c.id} className="flex items-start gap-2 bg-slate-50 rounded-lg p-2.5">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              className="w-full h-8 px-2.5 text-xs rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-navy-700"
                              placeholder={`Criterion ${ci + 1} description…`}
                              value={c.description}
                              onChange={(e) =>
                                updateCriterion(q.id, c.id, { description: e.target.value })
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
                                updateCriterion(q.id, c.id, { maxMarks: parseInt(e.target.value) || 0 });
                                syncQuestionMarks(q.id);
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
            <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
            <Button onClick={() => setStep(2)}>Next: Students →</Button>
          </div>
        </div>
      )}

      {/* Step 2: Students */}
      {step === 2 && (
        <div className="max-w-xl">
          <Card className="mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Enrol Students</h3>
              <Badge variant="navy">{selectedStudents.length} selected</Badge>
            </div>
            <div className="space-y-2">
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
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-400">
                      {student.studentId} · {student.department}
                      {!student.calibrated && (
                        <span className="ml-2 text-amber-600">· Not calibrated</span>
                      )}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </Card>

          <Card className="mb-5 bg-navy-50 border-navy-200">
            <h3 className="font-semibold text-navy-900 text-sm mb-3">Exam Summary</h3>
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
                <dd className="font-medium text-navy-900">{selectedStudents.length}</dd>
              </div>
            </dl>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
            <Button loading={saving} onClick={handleSave}>
              Create Exam
            </Button>
          </div>
        </div>
      )}

      <Modal open={successModal} onClose={() => { setSuccessModal(false); navigate('f-dashboard'); }} title="Exam Created">
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 text-3xl mx-auto mb-4">
            ✓
          </div>
          <p className="font-semibold text-slate-900 mb-1">&ldquo;{title}&rdquo; is live</p>
          <p className="text-sm text-slate-500 mb-5">
            The exam has been created and {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} enrolled. Students can now submit their answer sheets.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setSuccessModal(false); navigate('f-dashboard'); }}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
