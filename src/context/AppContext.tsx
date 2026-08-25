import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
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
  DEMO_RUBRICS,
  DEMO_CALIBRATIONS,
  DEMO_AI_USAGE,
  DEFAULT_SYSTEM_SETTINGS,
  DEMO_EXAMS,
} from '../lib/seed-data';
import { runDemoEvaluation } from '../lib/demo-ai';
import { supabase } from '../lib/supabase';
import {
  ensureProfile,
  fetchSubmissions,
  fetchEvaluations,
  ensureExamsSeeded,
  saveSubmission,
  updateSubmissionStatus,
  saveEvaluation,
  saveExam,
  deleteExam as deleteExamFromDb,
  fetchAuditLogs,
  saveAuditLog,
} from '../lib/db';
import { toPath } from '../lib/routes';
import { navigationRef } from '../lib/navigation';

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
  | { type: 'SET_DATA'; payload: Partial<AppState> }
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
  | { type: 'DELETE_EXAM'; examId: string }
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
      return { ...state, currentUser: action.user, loginError: null, authLoading: false };
    case 'LOGIN_ERROR':
      return { ...state, loginError: action.message, authLoading: false };
    case 'LOGOUT':
      return { ...state, currentUser: null, authLoading: false };
    case 'SET_AUTH_LOADING':
      return { ...state, authLoading: action.loading };
    case 'SET_DATA':
      return { ...state, ...action.payload };
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
    case 'DELETE_EXAM':
      return {
        ...state,
        exams: state.exams.filter((e) => e.id !== action.examId),
        rubrics: state.rubrics.filter((r) => r.examId !== action.examId),
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

function loadSavedSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem('evalscript_system_settings');
    if (raw) return { ...DEFAULT_SYSTEM_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SYSTEM_SETTINGS;
}

const initialState: AppState = {
  currentUser: null,
  page: 'landing',
  navCtx: {},
  users: [],
  exams: DEMO_EXAMS,
  rubrics: DEMO_RUBRICS,
  submissions: [],
  evaluations: [],
  calibrations: DEMO_CALIBRATIONS,
  auditLogs: [], // real only — no demo seed
  aiUsage: DEMO_AI_USAGE,
  systemSettings: loadSavedSettings(),
  disputes: [],
  resultVersions: [],
  toast: null,
  loginError: null,
  authLoading: true,
};

interface AppContextValue {
  state: AppState;
  navigate: (page: PageRoute | string, navCtx?: NavigationContext) => void;
  setAuthUser: (user: User | null) => void;
  logout: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  submitExam: (submission: Submission) => Promise<void>;
  processEvaluation: (submissionId: string) => void;
  updateEvaluation: (evaluation: Evaluation) => Promise<void>;
  publishEvaluation: (evaluationId: string, facultyNotes?: string) => Promise<void>;
  createExam: (exam: Exam) => Promise<void>;
  deleteExam: (examId: string) => Promise<void>;
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

async function loadCloudData(dispatch: React.Dispatch<AppAction>) {
  const [subs, evals, exams, logs] = await Promise.all([
    fetchSubmissions(),
    fetchEvaluations(),
    ensureExamsSeeded(),
    fetchAuditLogs(),
  ]);

  let users: User[] = [];
  try {
    const { data } = await supabase.from('profiles').select('*').order('name');
    users = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      avatarInitials:
        row.avatar_initials || row.name?.slice(0, 2).toUpperCase() || 'U',
      studentId: row.student_id,
      department: row.department,
      calibrated: row.calibrated || false,
      createdAt: row.created_at,
    }));
  } catch (e) {
    console.warn('profiles load failed', e);
  }

  dispatch({
    type: 'SET_DATA',
    payload: {
      submissions: subs,
      evaluations: evals,
      exams: exams.length ? exams : DEMO_EXAMS,
      users,
      auditLogs: logs,
    },
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    let mounted = true;

    async function init() {
      dispatch({ type: 'SET_AUTH_LOADING', loading: true });
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user && mounted) {
        const profile = await ensureProfile(session.user);
        if (profile) {
          dispatch({ type: 'LOGIN_SUCCESS', user: profile });
          await loadCloudData(dispatch);
        }
      }
      if (mounted) dispatch({ type: 'SET_AUTH_LOADING', loading: false });
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await ensureProfile(session.user);
        if (profile) {
          dispatch({ type: 'LOGIN_SUCCESS', user: profile });
          await loadCloudData(dispatch);
        }
      }
      if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const navigate = useCallback((page: PageRoute | string, navCtx?: NavigationContext) => {
    const path = toPath(page);
    dispatch({ type: 'NAVIGATE', page: page as PageRoute, navCtx });
    if (navigationRef.current) {
      navigationRef.current(path);
    }
  }, []);

  const setAuthUser = useCallback((user: User | null) => {
    if (user) dispatch({ type: 'LOGIN_SUCCESS', user });
    else dispatch({ type: 'LOGOUT' });
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'LOGOUT' });
    navigationRef.current?.('/');
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      dispatch({ type: 'SHOW_TOAST', message, toastType: type });
      setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 4000);
    },
    []
  );

  const clearToast = useCallback(() => dispatch({ type: 'CLEAR_TOAST' }), []);

  const addAuditLog = useCallback((log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    const fullLog: AuditLog = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_AUDIT_LOG', log: fullLog });
    saveAuditLog(fullLog).catch(console.error);
  }, []);

  const submitExam = useCallback(
    async (submission: Submission) => {
      dispatch({ type: 'ADD_SUBMISSION', submission });
      try {
        await saveSubmission(submission);
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  const processEvaluation = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;
      const exam = state.exams.find((e) => e.id === submission.examId);
      const rubric = state.rubrics.find((r) => r.examId === submission.examId);
      if (!exam || !rubric) return;

      dispatch({ type: 'UPDATE_SUBMISSION_STATUS', submissionId, status: 'PROCESSING' });
      updateSubmissionStatus(submissionId, 'PROCESSING').catch(console.error);

      setTimeout(async () => {
        const evaluation = runDemoEvaluation({
          submission,
          rubric,
          examTitle: `${exam.title} (${exam.code})`,
          studentName: submission.studentName || 'Student',
        });
        dispatch({ type: 'ADD_EVALUATION', evaluation });
        dispatch({ type: 'UPDATE_SUBMISSION_STATUS', submissionId, status: 'AI_COMPLETE' });
        dispatch({
          type: 'UPDATE_SUBMISSION_EVALUATION_ID',
          submissionId,
          evaluationId: evaluation.id,
        });
        try {
          await saveEvaluation(evaluation);
          await updateSubmissionStatus(submissionId, 'AI_COMPLETE', evaluation.id);
        } catch (e) {
          console.error(e);
        }
      }, 2500);
    },
    [state.submissions, state.exams, state.rubrics]
  );

  const updateEvaluation = useCallback(async (evaluation: Evaluation) => {
    dispatch({ type: 'UPDATE_EVALUATION', evaluation });
    try {
      await saveEvaluation(evaluation);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const publishEvaluation = useCallback(
    async (evaluationId: string, facultyNotes?: string) => {
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
      try {
        await saveEvaluation(updatedEval);
        await updateSubmissionStatus(evaluation.submissionId, 'PUBLISHED');
      } catch (e) {
        console.error(e);
      }
      addAuditLog({
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        userRole: state.currentUser.role,
        action: 'RESULT_PUBLISHED',
        entity: 'evaluation',
        entityId: evaluationId,
        details: `Published result for ${evaluation.studentName || 'student'}.`,
      });
    },
    [state.evaluations, state.currentUser, addAuditLog]
  );

  const createExam = useCallback(
    async (exam: Exam) => {
      dispatch({ type: 'ADD_EXAM', exam });
      try {
        await saveExam(exam);
      } catch (e) {
        console.error(e);
      }
      if (state.currentUser) {
        addAuditLog({
          userId: state.currentUser.id,
          userName: state.currentUser.name,
          userRole: state.currentUser.role,
          action: 'EXAM_CREATED',
          entity: 'exam',
          entityId: exam.id,
          details: `Exam ${exam.code} (${exam.title}) created.`,
        });
      }
    },
    [state.currentUser, addAuditLog]
  );

  const deleteExam = useCallback(async (examId: string) => {
    dispatch({ type: 'DELETE_EXAM', examId });
    try {
      await deleteExamFromDb(examId);
    } catch (e) {
      console.error('Failed to delete exam from cloud', e);
      throw e;
    }
  }, []);

  const createRubric = useCallback((rubric: Rubric) => {
    dispatch({ type: 'ADD_RUBRIC', rubric });
  }, []);

  const updateRubric = useCallback((rubric: Rubric) => {
    dispatch({ type: 'UPDATE_RUBRIC', rubric });
  }, []);

  const addCalibration = useCallback((calibration: CalibrationSample) => {
    dispatch({ type: 'ADD_CALIBRATION', calibration });
    dispatch({ type: 'UPDATE_USER_CALIBRATED', userId: calibration.studentId });
  }, []);

  const updateSystemSettings = useCallback((settings: SystemSettings) => {
    dispatch({ type: 'UPDATE_SYSTEM_SETTINGS', settings });
    try {
      localStorage.setItem('evalscript_system_settings', JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, []);

  const getExamsForCurrentUser = useCallback((): Exam[] => {
    if (!state.currentUser) return [];
    if (state.currentUser.role === 'student') {
      return state.exams.filter(
        (e) => !e.studentIds?.length || e.studentIds.includes(state.currentUser!.id)
      );
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
      const ids = state.exams
        .filter((e) => e.facultyId === state.currentUser!.id)
        .map((e) => e.id);
      return state.submissions.filter((s) => ids.includes(s.examId));
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
      const ids = state.exams
        .filter((e) => e.facultyId === state.currentUser!.id)
        .map((e) => e.id);
      return state.evaluations.filter((e) => ids.includes(e.examId));
    }
    return state.evaluations;
  }, [state.currentUser, state.exams, state.evaluations]);

  const getPendingReviewsForFaculty = useCallback((): Evaluation[] => {
    if (!state.currentUser || state.currentUser.role !== 'faculty') return [];
    const ids = state.exams
      .filter((e) => e.facultyId === state.currentUser!.id)
      .map((e) => e.id);
    return state.evaluations.filter(
      (e) =>
        ids.includes(e.examId) &&
        (e.status === 'AI_COMPLETE' || e.status === 'FACULTY_REVIEW')
    );
  }, [state.currentUser, state.exams, state.evaluations]);

  const getCalibrationForStudent = useCallback(
    (studentId: string) => state.calibrations.find((c) => c.studentId === studentId),
    [state.calibrations]
  );

  const submitDispute = useCallback(
    (disputeInput: Omit<DisputeRequest, 'id' | 'createdAt' | 'status'>) => {
      dispatch({
        type: 'ADD_DISPUTE',
        dispute: {
          ...disputeInput,
          id: `dispute-${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'OPEN',
        },
      });
    },
    []
  );

  const resolveDispute = useCallback(
    (disputeId: string, resolution: string, status: 'RESOLVED' | 'REJECTED') => {
      const dispute = state.disputes.find((d) => d.id === disputeId);
      if (!dispute || !state.currentUser) return;
      dispatch({
        type: 'UPDATE_DISPUTE',
        dispute: {
          ...dispute,
          status,
          resolution,
          resolvedAt: new Date().toISOString(),
          facultyId: state.currentUser.id,
          facultyName: state.currentUser.name,
        },
      });
    },
    [state.disputes, state.currentUser]
  );

  const createResultVersion = useCallback(
    (
      evaluationId: string,
      reason: string,
      questionChanges: ResultVersion['questionChanges']
    ) => {
      if (!state.currentUser) return;
      const existing = state.resultVersions.filter((v) => v.evaluationId === evaluationId);
      const evaluation = state.evaluations.find((e) => e.id === evaluationId);
      if (!evaluation) return;
      dispatch({
        type: 'ADD_RESULT_VERSION',
        version: {
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
        },
      });
    },
    [state.currentUser, state.resultVersions, state.evaluations]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        navigate,
        setAuthUser,
        logout,
        showToast,
        clearToast,
        submitExam,
        processEvaluation,
        updateEvaluation,
        publishEvaluation,
        createExam,
        deleteExam,
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