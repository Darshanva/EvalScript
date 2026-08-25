import { supabase } from './supabase';
import type { Submission, Evaluation, Exam, User, AuditLog } from '../types';
import { DEMO_EXAMS } from './seed-data';

export async function fetchProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    avatarInitials:
      data.avatar_initials || data.name?.slice(0, 2).toUpperCase() || 'U',
    studentId: data.student_id,
    department: data.department,
    calibrated: data.calibrated || false,
    createdAt: data.created_at,
  };
}

export async function ensureProfile(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
}): Promise<User | null> {
  let profile = await fetchProfile(authUser.id);
  if (profile) return profile;

  const email = authUser.email || '';
  const name =
    authUser.user_metadata?.name || email.split('@')[0] || 'User';
  const role = (authUser.user_metadata?.role as string) || 'student';
  const avatarInitials = name
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { error } = await supabase.from('profiles').upsert({
    id: authUser.id,
    email,
    name,
    role: ['student', 'faculty', 'admin'].includes(role) ? role : 'student',
    avatar_initials: avatarInitials || 'U',
    calibrated: false,
  });

  if (error) {
    console.error('ensureProfile failed', error);
    return {
      id: authUser.id,
      email,
      name,
      role: (role as User['role']) || 'student',
      avatarInitials: avatarInitials || 'U',
      calibrated: false,
    };
  }

  return fetchProfile(authUser.id);
}

export async function fetchSubmissions(): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    examId: row.exam_id,
    submittedAt: row.submitted_at,
    pages: row.pages || [],
    status: row.status,
    pageCount: row.page_count,
    evaluationId: row.evaluation_id,
  }));
}

export async function saveSubmission(submission: Submission) {
  const { error } = await supabase.from('submissions').upsert({
    id: submission.id,
    student_id: submission.studentId,
    student_name: submission.studentName,
    exam_id: submission.examId,
    submitted_at: submission.submittedAt,
    pages: submission.pages,
    status: submission.status,
    page_count: submission.pageCount,
    evaluation_id: submission.evaluationId || null,
  });
  if (error) throw error;
}

export async function updateSubmissionStatus(
  id: string,
  status: string,
  evaluationId?: string
) {
  const payload: any = { status };
  if (evaluationId) payload.evaluation_id = evaluationId;
  const { error } = await supabase.from('submissions').update(payload).eq('id', id);
  if (error) throw error;
}

export async function saveEvaluation(evaluation: Evaluation) {
  const { error } = await supabase.from('evaluations').upsert({
    id: evaluation.id,
    submission_id: evaluation.submissionId,
    student_id: evaluation.studentId,
    student_name: evaluation.studentName,
    exam_id: evaluation.examId,
    total_marks: evaluation.totalMarks,
    max_marks: evaluation.maxMarks,
    status: evaluation.status,
    faculty_total_marks: evaluation.facultyTotalMarks,
    faculty_id: evaluation.facultyId,
    faculty_name: evaluation.facultyName,
    faculty_notes: evaluation.facultyNotes,
    faculty_reviewed_at: evaluation.facultyReviewedAt,
    published_at: evaluation.publishedAt,
    data: evaluation,
  });
  if (error) throw error;
}

export async function fetchEvaluations(): Promise<Evaluation[]> {
  const { data, error } = await supabase.from('evaluations').select('*');
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((row: any) =>
    row.data
      ? row.data
      : {
          id: row.id,
          submissionId: row.submission_id,
          studentId: row.student_id,
          studentName: row.student_name,
          examId: row.exam_id,
          totalMarks: row.total_marks,
          maxMarks: row.max_marks,
          status: row.status,
          facultyTotalMarks: row.faculty_total_marks,
          facultyId: row.faculty_id,
          facultyName: row.faculty_name,
          facultyNotes: row.faculty_notes,
          facultyReviewedAt: row.faculty_reviewed_at,
          publishedAt: row.published_at,
        }
  );
}

export async function fetchExams(): Promise<Exam[]> {
  const { data, error } = await supabase.from('exams').select('*');
  if (error) {
    console.error(error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    code: row.code,
    subject: row.subject,
    facultyId: row.faculty_id,
    facultyName: row.faculty_name,
    maxMarks: row.max_marks,
    status: row.status,
    studentIds: row.student_ids || [],
    date: row.date,
    duration: row.duration,
    description: row.description,
    rubricId: row.rubric_id,
    createdAt: row.created_at,
  }));
}

export async function saveExam(exam: Exam) {
  const { error } = await supabase.from('exams').upsert({
    id: exam.id,
    title: exam.title,
    code: exam.code,
    subject: exam.subject,
    faculty_id: exam.facultyId,
    faculty_name: exam.facultyName,
    max_marks: exam.maxMarks,
    status: exam.status,
    student_ids: exam.studentIds || [],
    date: exam.date,
    duration: exam.duration,
    description: exam.description,
    rubric_id: exam.rubricId,
    created_at: exam.createdAt,
  });
  if (error) throw error;
}

export async function deleteExam(examId: string) {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) throw error;
}

export async function ensureExamsSeeded(): Promise<Exam[]> {
  const existing = await fetchExams();
  if (existing.length > 0) return existing;

  for (const exam of DEMO_EXAMS) {
    try {
      await saveExam(exam);
    } catch (e) {
      console.warn('seed exam failed', exam.id, e);
    }
  }
  const after = await fetchExams();
  return after.length ? after : DEMO_EXAMS;
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

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    details: row.details,
    ipAddress: row.ip_address,
    timestamp: row.timestamp,
  }));
}

export async function saveAuditLog(log: {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
  timestamp: string;
}) {
  const { error } = await supabase.from('audit_logs').insert({
    id: log.id,
    user_id: log.userId || null,
    user_name: log.userName || null,
    user_role: log.userRole || null,
    action: log.action,
    entity: log.entity || null,
    entity_id: log.entityId || null,
    details: log.details || null,
    ip_address: log.ipAddress || null,
    timestamp: log.timestamp,
  });
  if (error) console.error('saveAuditLog', error);
}