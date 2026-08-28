export type UserRole = 'student' | 'faculty' | 'admin';

export type PageRoute =
  | 'landing'
  | 'auth'
  | 's-dashboard'
  | 's-calibration'
  | 's-submit'
  | 's-results'
  | 's-result-detail'
  | 's-disputes'
  | 'f-dashboard'
  | 'f-create-exam'
  | 'f-reviews'
  | 'f-review'
  | 'f-results'
  | 'f-disputes'
  | 'a-dashboard'
  | 'a-users'
  | 'a-usage'
  | 'a-audit'
  | 'a-settings'
  | 'a-groq'
  | 'a-structure'
  | 'a-publish-rights';

export interface NavigationContext {
  selectedExamId?: string;
  selectedEvaluationId?: string;
  selectedSubmissionId?: string;
  role?: string;
  [key: string]: unknown;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarInitials: string;
  studentId?: string;
  facultyId?: string;
  department?: string;
  calibrated?: boolean;
  createdAt?: string;
  /** Student placement in Exam Structure */
  client?: string;
  organisation?: string;
  batch?: string;
  term?: string;
  section?: string;
}

export interface Exam {
  id: string;
  title: string;
  code: string;
  subject: string;
  facultyId: string;
  facultyName: string;
  date: string;
  duration: number;
  maxMarks: number;
  status: string;
  studentIds: string[];
  rubricId: string;
  description?: string;
  createdAt: string;
}

export interface RubricCriterion {
  id: string;
  description: string;
  maxMarks: number;
}

export interface RubricQuestion {
  id: string;
  number: string;
  questionText: string;
  maxMarks: number;
  criteria: RubricCriterion[];
}

export interface Rubric {
  id: string;
  examId: string;
  questions: RubricQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionPage {
  id: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl: string;
  fileName?: string;
}

export interface Submission {
  id: string;
  examId: string;
  examTitle?: string;
  examCode?: string;
  studentId: string;
  studentName: string;
  pages: SubmissionPage[];
  pageCount: number;
  status: string;
  submittedAt: string;
  createdAt?: string;
}

export interface CriterionScore {
  criterionId: string;
  criterion: string;
  awarded: number;
  max: number;
}

export interface EvaluationQuestion {
  id: string;
  questionNumber: number | string;
  maxMarks: number;
  totalAwarded: number;
  facultyAwarded?: number;
  confidence: number;
  confidenceLevel?: string;
  flags: string[];
  studentAnswer?: string;
  answerSummary?: string;
  feedback: string;
  facultyFeedback?: string;
  criteriaScores: CriterionScore[];
}

export interface Evaluation {
  id: string;
  submissionId: string;
  examId: string;
  examTitle: string;
  examCode?: string;
  studentId: string;
  studentName: string;
  status: string;
  totalMarks: number;
  facultyTotalMarks?: number;
  maxMarks: number;
  overallConfidence?: number;
  overallConfidenceLevel?: string;
  flags: string[];
  transcription?: string;
  questions: EvaluationQuestion[];
  facultyNotes?: string;
  facultyId?: string;
  facultyName?: string;
  aiGeneratedAt?: string;
  facultyReviewedAt?: string;
  publishedAt?: string;
  createdAt?: string;
}

export interface CalibrationSample {
  id: string;
  studentId: string;
  imageUrl?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  timestamp: string;
}

export interface AIUsageRecord {
  id: string;
  date: string;
  requestCount: number;
  pageCount: number;
  successCount: number;
  failureCount: number;
}

export interface SystemSettings {
  maxAiRequestsPerDay: number;
  maxAiRequestsPerStudentPerDay: number;
  maxPagesPerSubmission: number;
  maxUploadSizeMb: number;
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
  aiMode: string;
  aiProvider: string;
  groqModel?: string;
  claudeModel?: string;
}

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface DisputeRequest {
  id: string;
  evaluationId: string;
  studentId: string;
  studentName: string;
  examTitle: string;
  reason: string;
  questionNumbers: string[];
  status: DisputeStatus;
  resolution?: string;
  facultyName?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ResultVersion {
  id: string;
  evaluationId: string;
  version: number;
  totalMarks: number;
  maxMarks: number;
  reason: string;
  facultyId: string;
  facultyName: string;
  timestamp: string;
  questionChanges?: unknown;
}

export type UserRole = 'student' | 'faculty' | 'admin' | 'hod';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarInitials: string;
  studentId?: string;
  facultyId?: string;
  department?: string;
  calibrated?: boolean;
  createdAt?: string;
  /** Student placement OR HOD's client scope */
  client?: string;
  organisation?: string;
  batch?: string;
  term?: string;
  section?: string;
}