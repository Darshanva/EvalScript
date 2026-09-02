import { supabase } from './supabase';
import type {
  User,
  Exam,
  Rubric,
  Submission,
  Evaluation,
  AuditLog,
  CalibrationSample,
} from '../types';

/* ───────────── Profiles ───────────── */

export async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
}): Promise<User | null> {
  const meta = authUser.user_metadata || {};
  const email = authUser.email || meta.email || '';

  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existing) {
    return mapProfile(existing);
  }

  const name =
    meta.name || meta.full_name || email.split('@')[0] || 'User';
  const role = (meta.role as User['role']) || 'student';
  const row = {
    id: authUser.id,
    email,
    name,
    role,
    avatar_initials: name.slice(0, 2).toUpperCase(),
    student_id: meta.studentId || meta.student_id || null,
    faculty_id: meta.facultyId || meta.faculty_id || null,
    department: meta.department || null,
    calibrated: false,
    client: meta.client || null,
    organisation: meta.organisation || null,
    batch: meta.batch || null,
    term: meta.term || null,
    section: meta.section || null,
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('ensureProfile', error);
    return {
      id: authUser.id,
      email,
      name,
      role,
      avatarInitials: name.slice(0, 2).toUpperCase(),
      calibrated: false,
      createdAt: new Date().toISOString(),
    };
  }
  return mapProfile(data);
}

function mapProfile(row: any): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    avatarInitials:
      row.avatar_initials || row.name?.slice(0, 2).toUpperCase() || 'U',
    studentId: row.student_id,
    facultyId: row.faculty_id,
    department: row.department,
    calibrated: !!row.calibrated,
    createdAt: row.created_at,
    client: row.client || undefined,
    organisation: row.organisation || undefined,
    batch: row.batch || undefined,
    term: row.term || undefined,
    section: row.section || undefined,
  };
}

/* ───────────── Submissions ───────────── */

function mapSubmission(row: any): Submission {
  return {
    id: row.id,
    examId: row.exam_id,
    studentId: row.student_id,
    studentName: row.student_name || '',
    examTitle: row.exam_title || '',
    examCode: row.exam_code || '',
    status: row.status || 'SUBMITTED',
    pages: row.pages || [],
    pageCount: row.page_count ?? (row.pages?.length || 0),
    submittedAt: row.submitted_at || row.created_at,
    evaluationId: row.evaluation_id || undefined,
    createdAt: row.created_at,
  } as Submission;
}

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('fetchSubmissions', error.message);
    return [];
  }
  return (data || []).map(mapSubmission);
}

export async function saveSubmission(sub: Submission): Promise<boolean> {
  const row = {
    id: sub.id,
    exam_id: sub.examId,
    student_id: sub.studentId,
    student_name: sub.studentName,
    exam_title: sub.examTitle || null,
    exam_code: (sub as any).examCode || null,
    status: sub.status || 'SUBMITTED',
    pages: sub.pages || [],
    page_count: sub.pageCount ?? sub.pages?.length ?? 0,
    submitted_at: sub.submittedAt || new Date().toISOString(),
    evaluation_id: sub.evaluationId || null,
  };

  const { error } = await supabase.from('submissions').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    console.error('saveSubmission', error.message, error);
    return false;
  }
  return true;
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: string,
  evaluationId?: string
): Promise<boolean> {
  const patch: Record<string, unknown> = { status };
  if (evaluationId) patch.evaluation_id = evaluationId;

  const { error } = await supabase
    .from('submissions')
    .update(patch)
    .eq('id', submissionId);

  if (error) {
    console.error('updateSubmissionStatus', error.message);
    return false;
  }
  return true;
}

/* ───────────── Evaluations (cloud persist) ───────────── */

export function mapEvaluation(row: any): Evaluation {
  return {
    id: row.id,
    submissionId: row.submission_id,
    examId: row.exam_id,
    studentId: row.student_id,
    studentName: row.student_name || '',
    examTitle: row.exam_title || '',
    examCode: row.exam_code || '',
    status: row.status || 'AI_COMPLETE',
    totalMarks: Number(row.total_marks) || 0,
    maxMarks: Number(row.max_marks) || 100,
    facultyTotalMarks:
      row.faculty_total_marks != null
        ? Number(row.faculty_total_marks)
        : undefined,
    overallConfidence: Number(row.overall_confidence) || 0,
    overallConfidenceLevel: row.overall_confidence_level || 'MEDIUM',
    transcription: row.transcription || '',
    flags: Array.isArray(row.flags) ? row.flags : [],
    questions: Array.isArray(row.questions) ? row.questions : [],
    facultyNotes: row.faculty_notes || '',
    facultyId: row.faculty_id || '',
    facultyName: row.faculty_name || '',
    facultyReviewedAt: row.faculty_reviewed_at || undefined,
    publishedAt: row.published_at || undefined,
    aiGeneratedAt:
      row.ai_generated_at || row.created_at || new Date().toISOString(),
  } as Evaluation;
}

export async function fetchEvaluations(): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .order('ai_generated_at', { ascending: false });

  if (error) {
    console.error('fetchEvaluations', error.message, error);
    return [];
  }
  return (data || []).map(mapEvaluation);
}

export async function saveEvaluation(ev: Evaluation): Promise<boolean> {
  const full: Record<string, unknown> = {
    id: ev.id,
    submission_id: ev.submissionId ?? null,
    exam_id: ev.examId ?? null,
    student_id: ev.studentId ?? null,
    student_name: ev.studentName ?? null,
    exam_title: ev.examTitle ?? null,
    exam_code: (ev as any).examCode ?? null,
    status: ev.status || 'AI_COMPLETE',
    total_marks: ev.totalMarks ?? 0,
    max_marks: ev.maxMarks ?? 100,
    faculty_total_marks: ev.facultyTotalMarks ?? null,
    overall_confidence: ev.overallConfidence ?? null,
    overall_confidence_level: ev.overallConfidenceLevel ?? null,
    transcription: ev.transcription ?? null,
    flags: ev.flags ?? [],
    questions: ev.questions ?? [],
    faculty_notes: ev.facultyNotes ?? null,
    faculty_id: ev.facultyId ?? null,
    faculty_name: ev.facultyName ?? null,
    faculty_reviewed_at: ev.facultyReviewedAt ?? null,
    published_at: ev.publishedAt ?? null,
    ai_generated_at: ev.aiGeneratedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('evaluations').upsert(full, {
    onConflict: 'id',
  });

  if (!error) return true;

  console.error(
    'saveEvaluation FULL ERROR:',
    error.message,
    error.details,
    error.hint,
    error
  );

  // Slim retry (no heavy jsonb) — still keeps marks for refresh
  const slim: Record<string, unknown> = {
    id: full.id,
    submission_id: full.submission_id,
    exam_id: full.exam_id,
    student_id: full.student_id,
    student_name: full.student_name,
    exam_title: full.exam_title,
    exam_code: full.exam_code,
    status: full.status,
    total_marks: full.total_marks,
    max_marks: full.max_marks,
    overall_confidence: full.overall_confidence,
    overall_confidence_level: full.overall_confidence_level,
    transcription: full.transcription,
    ai_generated_at: full.ai_generated_at,
    updated_at: full.updated_at,
  };

  const { error: e2 } = await supabase.from('evaluations').upsert(slim, {
    onConflict: 'id',
  });

  if (e2) {
    console.error('saveEvaluation slim failed:', e2.message, e2);
    return false;
  }

  console.warn('saveEvaluation: slim row only (questions/flags skipped)');
  return true;
}

/* ───────────── Exams ───────────── */

function mapExam(row: any): Exam {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    subject: row.subject,
    date: row.date,
    duration: row.duration,
    description: row.description || '',
    facultyId: row.faculty_id,
    facultyName: row.faculty_name,
    maxMarks: row.max_marks ?? 100,
    status: row.status || 'ACTIVE',
    rubricId: row.rubric_id,
    studentIds: row.student_ids || [],
    createdAt: row.created_at,
    questionPaperUrl: row.question_paper_url || undefined,
  } as Exam;
}

export async function ensureExamsSeeded(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('ensureExamsSeeded', error.message);
    return [];
  }
  return (data || []).map(mapExam);
}

export async function saveExam(exam: Exam): Promise<boolean> {
  const row = {
    id: exam.id,
    title: exam.title,
    code: exam.code,
    subject: exam.subject || null,
    date: exam.date || null,
    duration: exam.duration || null,
    description: exam.description || null,
    faculty_id: exam.facultyId || null,
    faculty_name: exam.facultyName || null,
    max_marks: exam.maxMarks ?? 100,
    status: exam.status || 'ACTIVE',
    rubric_id: exam.rubricId || null,
    student_ids: exam.studentIds || [],
    question_paper_url: (exam as any).questionPaperUrl || null,
  };

  const { error } = await supabase.from('exams').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('saveExam', error.message, error);
    return false;
  }
  return true;
}

export async function deleteExam(examId: string): Promise<boolean> {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) {
    console.error('deleteExam', error.message);
    return false;
  }
  return true;
}

/* ───────────── Rubrics ───────────── */

export async function fetchRubrics(): Promise<Rubric[]> {
  const { data, error } = await supabase.from('rubrics').select('*');
  if (error) {
    console.error('fetchRubrics', error.message);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    examId: row.exam_id,
    questions: row.questions || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) as Rubric[];
}

export async function saveRubric(rubric: Rubric): Promise<boolean> {
  const row = {
    id: rubric.id,
    exam_id: rubric.examId,
    questions: rubric.questions || [],
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('rubrics').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    console.error('saveRubric', error.message);
    return false;
  }
  return true;
}

/* ───────────── Calibrations ───────────── */

export async function fetchCalibrations(): Promise<CalibrationSample[]> {
  const { data, error } = await supabase.from('calibrations').select('*');
  if (error) {
    console.error('fetchCalibrations', error.message);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    imageUrl: row.image_url,
    imageUrls: row.image_urls || { slow: row.image_url },
    qualityScore: row.quality_score,
    feedback: row.feedback || '',
    transcription: row.transcription || '',
    strengths: row.strengths || [],
    improvements: row.improvements || [],
    createdAt: row.created_at,
  })) as CalibrationSample[];
}

export async function saveCalibration(
  cal: CalibrationSample
): Promise<boolean> {
  const row = {
    id: cal.id,
    student_id: cal.studentId,
    image_url: cal.imageUrl || cal.imageUrls?.slow || null,
    image_urls: cal.imageUrls || null,
    quality_score: cal.qualityScore ?? null,
    feedback: cal.feedback || null,
    transcription: cal.transcription || null,
    strengths: cal.strengths || [],
    improvements: cal.improvements || [],
  };
  const { error } = await supabase.from('calibrations').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    console.error('saveCalibration', error.message);
    return false;
  }
  return true;
}

/* ───────────── Audit logs ───────────── */

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(200);

  if (error) {
    console.error('fetchAuditLogs', error.message);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    details: row.details,
    timestamp: row.timestamp || row.created_at,
  })) as AuditLog[];
}

export async function saveAuditLog(log: AuditLog): Promise<boolean> {
  const row = {
    id: log.id,
    user_id: log.userId,
    user_name: log.userName,
    user_role: log.userRole,
    action: log.action,
    entity: log.entity,
    entity_id: log.entityId,
    details: log.details,
    timestamp: log.timestamp || new Date().toISOString(),
  };
  const { error } = await supabase.from('audit_logs').upsert(row, {
    onConflict: 'id',
  });
  if (error) {
    console.error('saveAuditLog', error.message);
    return false;
  }
  return true;
}