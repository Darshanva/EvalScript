import { supabase } from './supabase';
import type {
  User,
  Exam,
  Submission,
  Evaluation,
  AuditLog,
} from '../types';

function mapProfile(row: any): User {
  return {
    id: row.id,
    email: row.email || '',
    name: row.name || 'User',
    role: (row.role || 'student') as User['role'],
    avatarInitials:
      row.avatar_initials ||
      (row.name || 'U').slice(0, 2).toUpperCase(),
    studentId: row.student_id || undefined,
    facultyId: row.faculty_id || undefined,
    department: row.department || undefined,
    calibrated: !!row.calibrated,
    createdAt: row.created_at || undefined,
    client: row.client || undefined,
    organisation: row.organisation || undefined,
    batch: row.batch || undefined,
    term: row.term || undefined,
    section: row.section || undefined,
  };
}

/** After auth — load or create profile (keeps client/batch/section) */
export async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('ensureProfile select', error);
    }

    if (data) {
      return mapProfile(data);
    }

    // First login — create minimal profile from metadata
    const meta = authUser.user_metadata || {};
    const name =
      (meta.name as string) ||
      authUser.email?.split('@')[0] ||
      'User';
    const role = (meta.role as string) || 'student';
    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const insertRow: Record<string, unknown> = {
      id: authUser.id,
      email: authUser.email || '',
      name,
      role,
      avatar_initials: initials,
      calibrated: false,
      client: meta.client || null,
      organisation: meta.organisation || null,
      batch: meta.batch || null,
      term: meta.term || null,
      section: meta.section || null,
    };

    const { data: created, error: insertErr } = await supabase
      .from('profiles')
      .upsert(insertRow)
      .select('*')
      .single();

    if (insertErr) {
      console.error('ensureProfile insert', insertErr);
      return {
        id: authUser.id,
        email: authUser.email || '',
        name,
        role: role as User['role'],
        avatarInitials: initials,
        calibrated: false,
      };
    }

    return mapProfile(created);
  } catch (e) {
    console.error('ensureProfile', e);
    return null;
  }
}

function mapExam(row: any): Exam {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    subject: row.subject || '',
    facultyId: row.faculty_id,
    facultyName: row.faculty_name || '',
    date: row.date,
    duration: row.duration ?? 180,
    maxMarks: row.max_marks ?? 100,
    status: row.status || 'ACTIVE',
    studentIds: row.student_ids || [],
    rubricId: row.rubric_id || '',
    description: row.description || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function fetchExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchExams', error);
    return [];
  }
  return (data || []).map(mapExam);
}

/** No demo seed — cloud only */
export async function ensureExamsSeeded(): Promise<Exam[]> {
  return fetchExams();
}

export async function saveExam(exam: Exam): Promise<void> {
  const row = {
    id: exam.id,
    title: exam.title,
    code: exam.code,
    subject: exam.subject,
    faculty_id: exam.facultyId,
    faculty_name: exam.facultyName,
    date: exam.date,
    duration: exam.duration,
    max_marks: exam.maxMarks,
    status: exam.status || 'ACTIVE',
    student_ids: exam.studentIds || [],
    rubric_id: exam.rubricId,
    description: exam.description || '',
    created_at: exam.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from('exams').upsert(row);
  if (error) {
    console.error('saveExam', error);
    throw error;
  }
}

export async function deleteExam(examId: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) {
    console.error('deleteExam', error);
    throw error;
  }
}

function mapSubmission(row: any): Submission {
  return {
    id: row.id,
    examId: row.exam_id,
    examTitle: row.exam_title || '',
    examCode: row.exam_code || '',
    studentId: row.student_id,
    studentName: row.student_name || '',
    pages: Array.isArray(row.pages) ? row.pages : [],
    pageCount: row.page_count ?? (Array.isArray(row.pages) ? row.pages.length : 0),
    status: row.status || 'SUBMITTED',
    submittedAt: row.submitted_at || row.created_at,
    createdAt: row.created_at,
    evaluationId: row.evaluation_id || undefined,
  } as Submission;
}

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchSubmissions', error);
    return [];
  }
  return (data || []).map(mapSubmission);
}

export async function saveSubmission(submission: Submission): Promise<void> {
  const row = {
    id: submission.id,
    exam_id: submission.examId,
    exam_title: submission.examTitle || null,
    exam_code: submission.examCode || null,
    student_id: submission.studentId,
    student_name: submission.studentName,
    pages: submission.pages || [],
    page_count: submission.pageCount ?? submission.pages?.length ?? 0,
    status: submission.status || 'SUBMITTED',
    submitted_at: submission.submittedAt || new Date().toISOString(),
    created_at: submission.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from('submissions').upsert(row);
  if (error) {
    console.error('saveSubmission', error);
    throw error;
  }
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: string,
  evaluationId?: string
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (evaluationId) patch.evaluation_id = evaluationId;
  const { error } = await supabase
    .from('submissions')
    .update(patch)
    .eq('id', submissionId);
  if (error) {
    console.error('updateSubmissionStatus', error);
    throw error;
  }
}

function mapEvaluation(row: any): Evaluation {
  return {
    id: row.id,
    submissionId: row.submission_id,
    examId: row.exam_id,
    examTitle: row.exam_title || '',
    examCode: row.exam_code,
    studentId: row.student_id,
    studentName: row.student_name || '',
    status: row.status,
    totalMarks: row.total_marks ?? 0,
    facultyTotalMarks: row.faculty_total_marks,
    maxMarks: row.max_marks ?? 100,
    overallConfidence: row.overall_confidence,
    overallConfidenceLevel: row.overall_confidence_level,
    flags: row.flags || [],
    transcription: row.transcription,
    questions: row.questions || [],
    facultyNotes: row.faculty_notes,
    facultyId: row.faculty_id,
    facultyName: row.faculty_name,
    aiGeneratedAt: row.ai_generated_at,
    facultyReviewedAt: row.faculty_reviewed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export async function fetchEvaluations(): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchEvaluations', error);
    return [];
  }
  return (data || []).map(mapEvaluation);
}

export async function saveEvaluation(evaluation: Evaluation): Promise<void> {
  const row = {
    id: evaluation.id,
    submission_id: evaluation.submissionId,
    exam_id: evaluation.examId,
    exam_title: evaluation.examTitle,
    exam_code: evaluation.examCode,
    student_id: evaluation.studentId,
    student_name: evaluation.studentName,
    status: evaluation.status,
    total_marks: evaluation.totalMarks,
    faculty_total_marks: evaluation.facultyTotalMarks,
    max_marks: evaluation.maxMarks,
    overall_confidence: evaluation.overallConfidence,
    overall_confidence_level: evaluation.overallConfidenceLevel,
    flags: evaluation.flags || [],
    transcription: evaluation.transcription,
    questions: evaluation.questions || [],
    faculty_notes: evaluation.facultyNotes,
    faculty_id: evaluation.facultyId,
    faculty_name: evaluation.facultyName,
    ai_generated_at: evaluation.aiGeneratedAt,
    faculty_reviewed_at: evaluation.facultyReviewedAt,
    published_at: evaluation.publishedAt,
    created_at: evaluation.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from('evaluations').upsert(row);
  if (error) {
    console.error('saveEvaluation', error);
    throw error;
  }
}

function mapAudit(row: any): AuditLog {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    details: row.details,
    timestamp: row.timestamp || row.created_at,
  };
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(200);
  if (error) {
    console.error('fetchAuditLogs', error);
    return [];
  }
  return (data || []).map(mapAudit);
}

export async function saveAuditLog(log: AuditLog): Promise<void> {
  const row = {
    id: log.id,
    user_id: log.userId,
    user_name: log.userName,
    user_role: log.userRole,
    action: log.action,
    entity: log.entity,
    entity_id: log.entityId,
    details: log.details,
    timestamp: log.timestamp,
  };
  const { error } = await supabase.from('audit_logs').upsert(row);
  if (error) {
    console.error('saveAuditLog', error);
  }
}