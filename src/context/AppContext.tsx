import React, { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type {
  User,
  Exam,
  Rubric,
  Submission,
  Evaluation,
  AuditLog,
  AIUsageRecord,
  SystemSettings,
  CalibrationSample,
  PageRoute,
  NavigationContext,
  DisputeRequest,
  ResultVersion,
} from '../types';
import {
  DEMO_USERS,
  DEMO_CREDENTIALS,
  DEMO_EXAMS,
  DEMO_RUBRICS,
  DEMO_SUBMISSIONS,
  DEMO_EVALUATIONS,
  DEMO_CALIBRATIONS,
  DEMO_AUDIT_LOGS,
  DEMO_AI_USAGE,
  DEFAULT_SYSTEM_SETTINGS,
} from '../lib/seed-data';
import { runDemoEvaluation } from '../lib/demo-ai';

interface AppState {
  currentUser: User | null;
  page: PageRoute;
  navCtx: NavigationContext;
  users: User[];
  exams: Exam[];
  rubrics: Rubric[];
  submissions: Submission[];
  evaluations: Evaluation[];
  calibrations: CalibrationSample[];
  auditLogs: AuditLog[];
  aiUsage: AIUsageRecord[];
  systemSettings: SystemSettings;
  disputes: DisputeRequest[];
  resultVersions: ResultVersion[];
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  loginError: string | null;
  authLoading: boolean;
}

type AppAction =
  | { type: 'LOGIN_SUCCESS'; user: User }
  | { type: 'LOGIN_ERROR'; message: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_AUTH_LOADING'; loading: boolean }
  | { type: 'NAVIGATE'; page: PageRoute; navCtx?: NavigationContext }
  | { type: 'SHOW_TOAST'; message: string; toastType: 'success' | 'error' | 'info' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'ADD_SUBMISSION'; submission: Submission }
  | { type: 'UPDATE_SUBMISSION_STATUS'; submissionId: string; status: Submission['status'] }
  | { type: 'UPDATE_SUBMISSION_EVALUATION_ID'; submissionId: string; evaluationId: string }
  | { type: 'ADD_EVALUATION'; evaluation: Evaluation }
  | { type: 'UPDATE_EVALUATION'; evaluation: Evaluation }
  | { type: 'ADD_EXAM'; exam: Exam }
  | { type: 'UPDATE_EXAM'; exam: Exam }
  | { type: 'ADD_DISPUTE'; dispute: DisputeRequest }
  | { type: 'UPDATE_DISPUTE'; dispute: DisputeRequest }
  | { type: 'ADD_RESULT_VERSION'; version: ResultVersion }
  | { type: 'ADD_RUBRIC'; rubric: Rubric }
  | { type: 'UPDATE_RUBRIC'; rubric: Rubric }
  | { type: 'ADD_CALIBRATION'; calibration: CalibrationSample }
  | { type: 'UPDATE_CALIBRATION'; calibration: CalibrationSample }
  | { type: 'UPDATE_USER_CALIBRATED'; userId: string }
  | { type: 'ADD_AUDIT_LOG'; log: AuditLog }
  | { type: 'UPDATE_SYSTEM_SETTINGS'; settings: SystemSettings }
  | { type: 'ADD_USER'; user: User };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        currentUser: action.user,
        loginError: null,
        authLoading: false,
        page: getRoleHome(action.user),
      };
    case 'LOGIN_ERROR':
      return { ...state, loginError: action.message, authLoading: false };
    case 'LOGOUT':
      return { ...state, currentUser: null, page: 'landing', navCtx: {}, authLoading: false };
    case 'SET_AUTH_LOADING':
      return { ...state, authLoading: action.loading };
    case 'NAVIGATE':
      return { ...state, page: action.page, navCtx: action.navCtx ?? state.navCtx };
    case 'SHOW_TOAST':
      return { ...state, toast: { message: action.message, type: action.toastType } };
    case 'CLEAR_TOAST':
      return { ...state, toast: null };
    case 'ADD_SUBMISSION':
      return { ...state, submissions: [...state.submissions, action.submission] };
    case 'UPDATE_SUBMISSION_STATUS':
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === action.submissionId ? { ...s, status: action.status } : s
        ),
      };
    case 'UPDATE_SUBMISSION_EVALUATION_ID':
      return {
        ...state,
        submissions: state.submissions.map((s) =>
          s.id === action.submissionId ? { ...s, evaluationId: action.evaluationId } : s
        ),
      };
    case 'ADD_EVALUATION':
      return { ...state, evaluations: [...state.evaluations, action.evaluation] };
    case 'UPDATE_EVALUATION':
      return {
        ...state,
        evaluations: state.evaluations.map((e) =>
          e.id === action.evaluation.id ? action.evaluation : e
        ),
      };
    case 'ADD_EXAM':
      return { ...state, exams: [...state.exams, action.exam] };
    case 'UPDATE_EXAM':
      return {
        ...state,
        exams: state.exams.map((e) => (e.id === action.exam.id ? action.exam : e)),
      };
    case 'ADD_RUBRIC':
      return { ...state, rubrics: [...state.rubrics, action.rubric] };
    case 'UPDATE_RUBRIC':
      return {
        ...state,
        rubrics: state.rubrics.map((r) => (r.id === action.rubric.id ? action.rubric : r)),
      };
    case 'ADD_CALIBRATION':
      return { ...state, calibrations: [...state.calibrations, action.calibration] };
    case 'UPDATE_CALIBRATION':
      return {
        ...state,
        calibrations: state.calibrations.map((c) =>
          c.id === action.calibration.id ? action.calibration : c
        ),
      };
    case 'UPDATE_USER_CALIBRATED':
      return {
        ...state,
        users: state.users.map((u) =>
          u.id === action.userId ? { ...u, calibrated: true } : u
        ),
        currentUser:
          state.currentUser?.id === action.userId
            ? { ...state.currentUser, calibrated: true }
            : state.currentUser,
      };
    case 'ADD_USER':
      return { ...state, users: [...state.users, action.user] };
    case 'ADD_AUDIT_LOG':
      return { ...state, auditLogs: [action.log, ...state.auditLogs] };
    case 'UPDATE_SYSTEM_SETTINGS':
      return { ...state, systemSettings: action.settings };
    case 'ADD_DISPUTE':
      return { ...state, disputes: [...state.disputes, action.dispute] };
    case 'UPDATE_DISPUTE':
      return {
        ...state,
        disputes: state.disputes.map((d) =>
          d.id === action.dispute.id ? action.dispute : d
        ),
      };
    case 'ADD_RESULT_VERSION':
      return { ...state, resultVersions: [...state.resultVersions, action.version] };
    default:
      return state;
  }
}

function getRoleHome(user: User): PageRoute {
  if (user.role === 'student') return 's-dashboard';
  if (user.role === 'faculty') return 'f-dashboard';
  return 'a-dashboard';
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('Failed to load from localStorage', key, e);
  }
  return fallback;
}

const initialState: AppState = {
  currentUser: null,
  page: 'landing',
  navCtx: {},
  users: DEMO_USERS,
  exams: loadFromStorage('evalscript_exams', DEMO_EXAMS),
  rubrics: loadFromStorage('evalscript_rubrics', DEMO_RUBRICS),
  submissions: loadFromStorage('evalscript_submissions', DEMO_SUBMISSIONS),
  evaluations: loadFromStorage('evalscript_evaluations', DEMO_EVALUATIONS),
  calibrations: loadFromStorage('evalscript_calibrations', DEMO_CALIBRATIONS),
  auditLogs: DEMO_AUDIT_LOGS,
  aiUsage: DEMO_AI_USAGE,
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  disputes: [],
  resultVersions: [],
  toast: null,
  loginError: null,
  authLoading: false,
};

interface AppContextValue {
  state: AppState;
  navigate: (page: PageRoute, navCtx?: NavigationContext) => void;
  login: (email: string, password: string) => boolean;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role: 'student' | 'faculty';
  }) => { success: boolean; message: string };
  logout: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  submitExam: (submission: Submission) => void;
  processEvaluation: (submissionId: string) => void;
  updateEvaluation: (evaluation: Evaluation) => void;
  publishEvaluation: (evaluationId: string, facultyNotes?: string) => void;
  createExam: (exam: Exam) => void;
  createRubric: (rubric: Rubric) => void;
  updateRubric: (rubric: Rubric) => void;
  addCalibration: (calibration: CalibrationSample) => void;
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  updateSystemSettings: (settings: SystemSettings) => void;
  submitDispute: (dispute: Omit<DisputeRequest, 'id' | 'createdAt' | 'status'>) => void;
  resolveDispute: (disputeId: string, resolution: string, status: 'RESOLVED' | 'REJECTED') => void;
  createResultVersion: (
    evaluationId: string,
    reason: string,
    questionChanges: ResultVersion['questionChanges']
  ) => void;
  getExamsForCurrentUser: () => Exam[];
  getSubmissionsForCurrentUser: () => Submission[];
  getEvaluationsForCurrentUser: () => Evaluation[];
  getPendingReviewsForFaculty: () => Evaluation[];
  getCalibrationForStudent: (studentId: string) => CalibrationSample | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    try {
      localStorage.setItem('evalscript_submissions', JSON.stringify(state.submissions));
      localStorage.setItem('evalscript_evaluations', JSON.stringify(state.evaluations));
      localStorage.setItem('evalscript_calibrations', JSON.stringify(state.calibrations));
      localStorage.setItem('evalscript_exams', JSON.stringify(state.exams));
      localStorage.setItem('evalscript_rubrics', JSON.stringify(state.rubrics));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [state.submissions, state.evaluations, state.calibrations, state.exams, state.rubrics]);

  const navigate = useCallback((page: PageRoute, navCtx?: NavigationContext) => {
    dispatch({ type: 'NAVIGATE', page, navCtx });
  }, []);

  const login = useCallback(
    (email: string, password: string): boolean => {
      const expectedPassword =
        DEMO_CREDENTIALS[email] || DEMO_CREDENTIALS[email.toLowerCase()];
      if (!expectedPassword || expectedPassword !== password) {
        dispatch({ type: 'LOGIN_ERROR', message: 'Invalid email or password.' });
        return false;
      }
      const user =
        DEMO_USERS.find(
          (u) => u.email === email || u.email.toLowerCase() === email.toLowerCase()
        ) ||
        state.users.find(
          (u) => u.email === email || u.email.toLowerCase() === email.toLowerCase()
        );
      if (!user) {
        dispatch({ type: 'LOGIN_ERROR', message: 'User not found.' });
        return false;
      }
      dispatch({ type: 'LOGIN_SUCCESS', user });
      return true;
    },
    [state.users]
  );

  const register = useCallback(
    (data: {
      name: string;
      email: string;
      password: string;
      role: 'student' | 'faculty';
    }): { success: boolean; message: string } => {
      const emailLower = data.email.trim().toLowerCase();

      const existsInDemo = DEMO_USERS.some((u) => u.email.toLowerCase() === emailLower);
      if (existsInDemo || DEMO_CREDENTIALS[data.email] || DEMO_CREDENTIALS[emailLower]) {
        return { success: false, message: 'Email already registered. Please sign in.' };
      }

      const existsInState = state.users.some((u) => u.email.toLowerCase() === emailLower);
      if (existsInState) {
        return { success: false, message: 'Email already registered. Please sign in.' };
      }

      const initials = data.name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const newUser: User = {
        id: `user-${Date.now()}`,
        name: data.name.trim(),
        email: data.email.trim(),
        role: data.role,
        avatarInitials: initials || 'U',
        calibrated: false,
      };

      DEMO_CREDENTIALS[data.email.trim()] = data.password;

      dispatch({ type: 'ADD_USER', user: newUser });
      dispatch({ type: 'LOGIN_SUCCESS', user: newUser });

      return { success: true, message: 'Account created successfully!' };
    },
    [state.users]
  );

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      dispatch({ type: 'SHOW_TOAST', message, toastType: type });
      setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 4000);
    },
    []
  );

  const clearToast = useCallback(() => {
    dispatch({ type: 'CLEAR_TOAST' });
  }, []);

  const addAuditLog = useCallback((log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const fullLog: AuditLog = {
      ...log,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_AUDIT_LOG', log: fullLog });
  }, []);

  const submitExam = useCallback(
    (submission: Submission) => {
      dispatch({ type: 'ADD_SUBMISSION', submission });
      if (state.currentUser) {
        addAuditLog({
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          userRole: state.currentUser.role,
          action: 'SUBMISSION_CREATED',
          entity: 'submission',
          entityId: submission.id,
          details: `Submitted exam with ${submission.pageCount} pages.`,
        });
      }
    },
    [state.currentUser, addAuditLog]
  );

  const processEvaluation = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;

      const exam = state.exams.find((e) => e.id === submission.examId);
      const rubric = state.rubrics.find((r) => r.examId === submission.examId);
      const student = state.users.find((u) => u.id === submission.studentId);
      if (!exam || !rubric || !student) return;

      dispatch({
        type: 'UPDATE_SUBMISSION_STATUS',
        submissionId,
        status: 'PROCESSING',
      });

      setTimeout(() => {
        const evaluation = runDemoEvaluation({
          submission,
          rubric,
          examTitle: `${exam.title} (${exam.code})`,
          studentName: student.name,
        });

        dispatch({ type: 'ADD_EVALUATION', evaluation });
        dispatch({
          type: 'UPDATE_SUBMISSION_STATUS',
          submissionId,
          status: 'AI_COMPLETE',
        });
        dispatch({
          type: 'UPDATE_SUBMISSION_EVALUATION_ID',
          submissionId,
          evaluationId: evaluation.id,
        });

        addAuditLog({
          userId: 'system',
          userName: 'AI System',
          userRole: 'admin',
          action: 'AI_EVALUATION_COMPLETE',
          entity: 'evaluation',
          entityId: evaluation.id,
          details: `AI evaluation complete for ${student.name}. Score: ${evaluation.totalMarks}/${evaluation.maxMarks}.`,
        });
      }, 2500);
    },
    [state.submissions, state.exams, state.rubrics, state.users, addAuditLog]
  );

  const updateEvaluation = useCallback(
    (evaluation: Evaluation) => {
      dispatch({ type: 'UPDATE_EVALUATION', evaluation });
      if (state.currentUser) {
        addAuditLog({
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          userRole: state.currentUser.role,
          action: 'EVALUATION_UPDATED',
          entity: 'evaluation',
          entityId: evaluation.id,
          details: `Evaluation updated. Faculty marks: ${evaluation.facultyTotalMarks ?? evaluation.totalMarks}/${evaluation.maxMarks}.`,
        });
      }
    },
    [state.currentUser, addAuditLog]
  );

  const publishEvaluation = useCallback(
    (evaluationId: string, facultyNotes?: string) => {
      const evaluation = state.evaluations.find((e) => e.id === evaluationId);
      if (!evaluation || !state.currentUser) return;

      const updatedEval: Evaluation = {
        ...evaluation,
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        facultyId: state.currentUser.id,
        facultyName: state.currentUser.name,
        facultyReviewedAt: evaluation.facultyReviewedAt ?? new Date().toISOString(),
        facultyNotes: facultyNotes ?? evaluation.facultyNotes,
      };

      dispatch({ type: 'UPDATE_EVALUATION', evaluation: updatedEval });
      dispatch({
        type: 'UPDATE_SUBMISSION_STATUS',
        submissionId: evaluation.submissionId,
        status: 'PUBLISHED',
      });

      addAuditLog({
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        userRole: state.currentUser.role,
        action: 'RESULT_PUBLISHED',
        entity: 'evaluation',
        entityId: evaluationId,
        details: `Result published for ${evaluation.studentName}. Final score: ${evaluation.facultyTotalMarks ?? evaluation.totalMarks}/${evaluation.maxMarks}.`,
      });
    },
    [state.evaluations, state.currentUser, addAuditLog]
  );

  const createExam = useCallback(
    (exam: Exam) => {
      dispatch({ type: 'ADD_EXAM', exam });
      if (state.currentUser) {
        addAuditLog({
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          userRole: state.currentUser.role,
          action: 'EXAM_CREATED',
          entity: 'exam',
          entityId: exam.id,
          details: `Exam "${exam.title}" (${exam.code}) created.`,
        });
      }
    },
    [state.currentUser, addAuditLog]
  );

  const createRubric = useCallback((rubric: Rubric) => {
    dispatch({ type: 'ADD_RUBRIC', rubric });
  }, []);

  const updateRubric = useCallback((rubric: Rubric) => {
    dispatch({ type: 'UPDATE_RUBRIC', rubric });
  }, []);

  const addCalibration = useCallback(
    (calibration: CalibrationSample) => {
      dispatch({ type: 'ADD_CALIBRATION', calibration });
      dispatch({ type: 'UPDATE_USER_CALIBRATED', userId: calibration.studentId });
      if (state.currentUser) {
        addAuditLog({
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          userRole: state.currentUser.role,
          action: 'CALIBRATION_UPLOADED',
          entity: 'calibration',
          entityId: calibration.id,
          details: 'Student uploaded handwriting calibration sample.',
        });
      }
    },
    [state.currentUser, addAuditLog]
  );

  const updateSystemSettings = useCallback((settings: SystemSettings) => {
    dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', settings });
  }, []);

  const getExamsForCurrentUser = useCallback((): Exam[] => {
    if (!state.currentUser) return [];
    if (state.currentUser.role === 'student') {
      return state.exams.filter((e) => e.studentIds.includes(state.currentUser!.id));
    }
    if (state.currentUser.role === 'faculty') {
      return state.exams.filter((e) => e.facultyId === state.currentUser!.id);
    }
    return state.exams;
  }, [state.currentUser, state.exams]);

  const getSubmissionsForCurrentUser = useCallback((): Submission[] => {
    if (!state.currentUser) return [];
    if (state.currentUser.role === 'student') {
      return state.submissions.filter((s) => s.studentId === state.currentUser!.id);
    }
    if (state.currentUser.role === 'faculty') {
      const facultyExamIds = state.exams
        .filter((e) => e.facultyId === state.currentUser!.id)
        .map((e) => e.id);
      return state.submissions.filter((s) => facultyExamIds.includes(s.examId));
    }
    return state.submissions;
  }, [state.currentUser, state.exams, state.submissions]);

  const getEvaluationsForCurrentUser = useCallback((): Evaluation[] => {
    if (!state.currentUser) return [];
    if (state.currentUser.role === 'student') {
      return state.evaluations.filter(
        (e) => e.studentId === state.currentUser!.id && e.status === 'PUBLISHED'
      );
    }
    if (state.currentUser.role === 'faculty') {
      const facultyExamIds = state.exams
        .filter((e) => e.facultyId === state.currentUser!.id)
        .map((e) => e.id);
      return state.evaluations.filter((e) => facultyExamIds.includes(e.examId));
    }
    return state.evaluations;
  }, [state.currentUser, state.exams, state.evaluations]);

  const getPendingReviewsForFaculty = useCallback((): Evaluation[] => {
    if (!state.currentUser || state.currentUser.role !== 'faculty') return [];
    const facultyExamIds = state.exams
      .filter((e) => e.facultyId === state.currentUser!.id)
      .map((e) => e.id);
    return state.evaluations.filter(
      (e) =>
        facultyExamIds.includes(e.examId) &&
        (e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW')
    );
  }, [state.currentUser, state.exams, state.evaluations]);

  const getCalibrationForStudent = useCallback(
    (studentId: string): CalibrationSample | undefined => {
      return state.calibrations.find((c) => c.studentId === studentId);
    },
    [state.calibrations]
  );

  const submitDispute = useCallback(
    (disputeInput: Omit<DisputeRequest, 'id' | 'createdAt' | 'status'>) => {
      const dispute: DisputeRequest = {
        ...disputeInput,
        id: `dispute-${Date.now()}`,
        createdAt: new Date().toISOString(),
        status: 'OPEN',
      };
      dispatch({ type: 'ADD_DISPUTE', dispute });
      if (state.currentUser) {
        addAuditLog({
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          userRole: state.currentUser.role,
          action: 'DISPUTE_SUBMITTED',
          entity: 'dispute',
          entityId: dispute.id,
          details: `Dispute submitted for evaluation ${dispute.evaluationId}`,
        });
      }
    },
    [state.currentUser, addAuditLog]
  );

  const resolveDispute = useCallback(
    (disputeId: string, resolution: string, status: 'RESOLVED' | 'REJECTED') => {
      const dispute = state.disputes.find((d) => d.id === disputeId);
      if (!dispute || !state.currentUser) return;
      const updated: DisputeRequest = {
        ...dispute,
        status,
        resolution,
        resolvedAt: new Date().toISOString(),
        facultyId: state.currentUser.id,
        facultyName: state.currentUser.name,
      };
      dispatch({ type: 'UPDATE_DISPUTE', dispute: updated });
      addAuditLog({
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        userRole: state.currentUser.role,
        action: 'DISPUTE_RESOLVED',
        entity: 'dispute',
        entityId: disputeId,
        details: `Dispute ${status}`,
      });
    },
    [state.disputes, state.currentUser, addAuditLog]
  );

  const createResultVersion = useCallback(
    (evaluationId: string, reason: string, questionChanges: ResultVersion['questionChanges']) => {
      if (!state.currentUser) return;
      const existing = state.resultVersions.filter((v) => v.evaluationId === evaluationId);
      const evaluation = state.evaluations.find((e) => e.id === evaluationId);
      if (!evaluation) return;
      const version: ResultVersion = {
        id: `version-${Date.now()}`,
        evaluationId,
        version: existing.length + 1,
        totalMarks: evaluation.facultyTotalMarks ?? evaluation.totalMarks,
        maxMarks: evaluation.maxMarks,
        reason,
        facultyId: state.currentUser.id,
        facultyName: state.currentUser.name,
        timestamp: new Date().toISOString(),
        questionChanges,
      };
      dispatch({ type: 'ADD_RESULT_VERSION', version });
      addAuditLog({
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        userRole: state.currentUser.role,
        action: 'RESULT_VERSION_CREATED',
        entity: 'evaluation',
        entityId: evaluationId,
        details: `New result version created (v${version.version}): ${reason}`,
      });
    },
    [state.currentUser, state.resultVersions, state.evaluations, addAuditLog]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        navigate,
        login,
        register,
        logout,
        showToast,
        clearToast,
        submitExam,
        processEvaluation,
        updateEvaluation,
        publishEvaluation,
        createExam,
        createRubric,
        updateRubric,
        addCalibration,
        addAuditLog,
        updateSystemSettings,
        submitDispute,
        resolveDispute,
        createResultVersion,
        getExamsForCurrentUser,
        getSubmissionsForCurrentUser,
        getEvaluationsForCurrentUser,
        getPendingReviewsForFaculty,
        getCalibrationForStudent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}