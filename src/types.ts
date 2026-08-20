// src/types/index.ts  (or src/types.ts)

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
  | 'f-rubric-builder'
  | 'f-reviews'
  | 'f-review'
  | 'f-results'
  | 'f-disputes'
  | 'a-dashboard'
  | 'a-users'
  | 'a-usage'
  | 'a-audit'
  | 'a-settings'
  | 'a-groq';

export interface NavigationContext {
  role?: string;
  examId?: string;
  submissionId?: string;
  evaluationId?: string;
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarInitials: string;
  studentId?: string;
  department?: string;
  calibrated?: boolean;
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
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  studentIds: string[];
  rubricId: string;
  description?: string;
  createdAt: string;
}

export interface RubricCriterion {
  id: string;
  description: string;
  maxMarks: number;
  order?: string;
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
  thumbnailUrl?: string;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  submittedAt: string;
  pages: SubmissionPage[];
  status:
    | 'SUBMITTED'
    | 'PROCESSING'
    | 'AI_COMPLETE'
    | 'FACULTY_REVIEW'
    | 'REVIEWED'
    | 'PUBLISHED'
    | 'FAILED';
  pageCount: number;
  evaluationId?: string;
}

export interface EvaluationQuestion {
  questionId: string;
  questionNumber: string;
  questionText: string;
  maxMarks: number;
  aiMarks: number;
  facultyMarks?: number;
  confidence: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  transcription?: string;
  feedback?: string;
  flags?: string[];
  criteriaScores?: {
    criterionId: string;
    description: string;
    maxMarks: number;
    aiMarks: number;
    facultyMarks?: number;
  }[];
}

export interface Evaluation {
  id: string;
  submissionId: string;
  examId: string;
  studentId: string;
  studentName: string;
  totalMarks: number;
  maxMarks: number;
  facultyTotalMarks?: number;
  status: 'AI_COMPLETE' | 'FACULTY_REVIEW' | 'REVIEWED' | 'PUBLISHED';
  questions: EvaluationQuestion[];
  overallConfidence?: number;
  facultyId?: string;
  facultyName?: string;
  facultyReviewedAt?: string;
  facultyNotes?: string;
  publishedAt?: string;
  createdAt?: string;
}

export interface CalibrationSample {
  id: string;
  studentId: string;
  imageUrl: string;
  uploadedAt: string;
  qualityScore?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface AIUsageRecord {
  id: string;
  date: string;
  pagesProcessed: number;
  tokensUsed?: number;
  cost?: number;
}

export interface SystemSettings {
  aiMode: 'demo' | 'groq' | 'anthropic';
  maxPagesPerSubmission: number;
  autoPublish: boolean;
  [key: string]: any;
}

export interface DisputeRequest {
  id: string;
  evaluationId: string;
  studentId: string;
  studentName: string;
  reason: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  resolution?: string;
  resolvedAt?: string;
  facultyId?: string;
  facultyName?: string;
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
  questionChanges: {
    questionId: string;
    oldMarks: number;
    newMarks: number;
  }[];
}