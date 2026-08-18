export type UserRole = 'student' | 'faculty' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentId?: string;
  facultyId?: string;
  department?: string;
  avatarInitials: string;
  calibrated?: boolean;
  createdAt: string;
}

export interface CalibrationSample {
  id: string;
  studentId: string;
  imageUrl: string;
  uploadedAt: string;
  qualityScore: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export type ExamStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

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
  status: ExamStatus;
  studentIds: string[];
  rubricId?: string;
  description?: string;
  createdAt: string;
}

export interface RubricCriterion {
  id: string;
  description: string;
  maxMarks: number;
  guidance?: string;
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

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'AI_COMPLETE'
  | 'FACULTY_REVIEW'
  | 'REVIEWED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'NEEDS_REVIEW';

export interface SubmissionPage {
  id: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl: string;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  examId: string;
  submittedAt: string;
  pages: SubmissionPage[];
  status: SubmissionStatus;
  evaluationId?: string;
  pageCount: number;
}

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type EvaluationFlag =
  | 'DIAGRAM_DETECTED'
  | 'EQUATION_DETECTED'
  | 'TABLE_DETECTED'
  | 'UNCLEAR_HANDWRITING'
  | 'LOW_IMAGE_QUALITY'
  | 'POSSIBLE_MISSING_TEXT'
  | 'QUESTION_MAPPING_UNCERTAIN';

export interface CriterionScore {
  criterionId: string;
  criterion: string;
  awarded: number;
  max: number;
}

export interface EvaluationQuestion {
  id: string;
  questionNumber: string;
  studentAnswer: string;
  answerSummary: string;
  criteriaScores: CriterionScore[];
  totalAwarded: number;
  maxMarks: number;
  facultyAwarded?: number;
  feedback: string;
  facultyFeedback?: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  flags: EvaluationFlag[];
  pageStart: number;
  pageEnd: number;
}

export type EvaluationStatus =
  | 'AI_COMPLETE'
  | 'FACULTY_REVIEW'
  | 'REVIEWED'
  | 'PUBLISHED';

export interface Evaluation {
  id: string;
  submissionId: string;
  studentId: string;
  studentName: string;
  examId: string;
  examTitle: string;
  transcription: string;
  questions: EvaluationQuestion[];
  totalMarks: number;
  maxMarks: number;
  facultyTotalMarks?: number;
  overallConfidence: number;
  overallConfidenceLevel: ConfidenceLevel;
  flags: EvaluationFlag[];
  status: EvaluationStatus;
  aiGeneratedAt: string;
  facultyReviewedAt?: string;
  publishedAt?: string;
  facultyNotes?: string;
  facultyId?: string;
  facultyName?: string;
  version: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface AIUsageRecord {
  id: string;
  date: string;
  requestCount: number;
  pageCount: number;
  successCount: number;
  failureCount: number;
  studentId?: string;
  examId?: string;
}

export interface SystemSettings {
  maxAiRequestsPerDay: number;
  maxAiRequestsPerStudentPerDay: number;
  maxPagesPerSubmission: number;
  maxUploadSizeMb: number;
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
  aiMode: 'demo' | 'groq';
  aiProvider: 'demo' | 'groq';
  groqModel: string;
}

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface DisputeRequest {
  id: string;
  studentId: string;
  studentName: string;
  evaluationId: string;
  examTitle: string;
  reason: string;
  questionNumbers: string[];
  status: DisputeStatus;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
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
    questionNumber: string;
    oldMarks: number;
    newMarks: number;
  }[];
}

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
  selectedExamId?: string;
  selectedSubmissionId?: string;
  selectedEvaluationId?: string;
  selectedDisputeId?: string;
}
