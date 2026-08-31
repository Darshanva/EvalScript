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
  DEMO_AI_USAGE,
  DEFAULT_SYSTEM_SETTINGS,
} from '../lib/seed-data';
import { runDemoEvaluation } from '../lib/demo-ai';
import { runClaudeEvaluation } from '../lib/claude-ai';
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
  fetchRubrics,
  saveRubric,
  fetchCalibrations,
  saveCalibration,
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

function mapProfileRow(row: any): User {
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
    calibrated: row.calibrated || false,
    createdAt: row.created_at,
    client: row.client || undefined,
    organisation: row.organisation || undefined,
    batch: row.batch || undefined,
    term: row.term || undefined,
    section: row.section || undefined,
  };
}

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
    case 'ADD_SUBMISSION': {
      const exists = state.submissions.some((s) => s.id === action.submission.id);
      if (exists) {
        return {
          ...state,
          submissions: state.submissions.map((s) =>
            s.id === action.submission.id ? action.submission : s
          ),
        };
      }
      return { ...state, submissions: [action.submission, ...state.submissions] };
    }
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
          s.id === action.submissionId
            ? { ...s, evaluationId: action.evaluationId }
            : s
        ),
      };
    case 'ADD_EVALUATION': {
      const exists = state.evaluations.some((e) => e.id === action.evaluation.id);
      if (exists) {
        return {
          ...state,
          evaluations: state.evaluations.map((e) =>
            e.id === action.evaluation.id ? action.evaluation : e
          ),
        };
      }
      return { ...state, evaluations: [action.evaluation, ...state.evaluations] };
    }
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
    case 'ADD_RUBRIC': {
      const exists = state.rubrics.some((r) => r.id === action.rubric.id);
      if (exists) {
        return {
          ...state,
          rubrics: state.rubrics.map((r) =>
            r.id === action.rubric.id ? action.rubric : r
          ),
        };
      }
      return { ...state, rubrics: [...state.rubrics, action.rubric] };
    }
    case 'UPDATE_RUBRIC':
      return {
        ...state,
        rubrics: state.rubrics.map((r) =>
          r.id === action.rubric.id ? action.rubric : r
        ),
      };
    case 'ADD_CALIBRATION': {
      // One calibration per student — replace on re-calibrate
      const others = state.calibrations.filter(
        (c) => c.studentId !== action.calibration.studentId
      );
      return {
        ...state,
        calibrations: [action.calibration, ...others],
      };
    }
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
        users: state.users.map((u) =>
          u.id === action.userId ? { ...u, calibrated: true } : u
        ),
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
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SYSTEM_SETTINGS,
        ...parsed,
        claudeModel: parsed.claudeModel || 'claude-sonnet-4-20250514',
      };
    }
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
  exams: [],
  rubrics: [],
  submissions: [],
  evaluations: [],
  calibrations: [],
  auditLogs: [],
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
  resolveDispute: (
    disputeId: string,
    resolution: string,
    status: 'RESOLVED' | 'REJECTED'
  ) => void;
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
  reloadCloudData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function facultyExamIds(exams: Exam[], user: User): Set<string> {
  const ids = new Set<string>();
  exams.forEach((e) => {
    if (e.facultyId === user.id || e.facultyName === user.name) {
      ids.add(e.id);
    }
  });
  return ids;
}

async function loadCloudData(dispatch: React.Dispatch<AppAction>) {
  const [subs, evals, exams, logs, rubrics, calibrations] = await Promise.all([
    fetchSubmissions(),
    fetchEvaluations(),
    ensureExamsSeeded(),
    fetchAuditLogs(),
    fetchRubrics(),
    fetchCalibrations(),
  ]);

  let users: User[] = [];
  try {
    const { data } = await supabase.from('profiles').select('*').order('name');
    users = (data || []).map(mapProfileRow);
  } catch (e) {
    console.warn('profiles load failed', e);
  }

  dispatch({
    type: 'SET_DATA',
    payload: {
      submissions: subs,
      evaluations: evals,
      exams,
      users,
      auditLogs: logs,
      rubrics,
      calibrations,
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
          dispatch({ type: 'LOGIN_SUCCESS', user: profile as User });
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
          dispatch({ type: 'LOGIN_SUCCESS', user: profile as User });
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

  const reloadCloudData = useCallback(async () => {
    await loadCloudData(dispatch);
  }, []);

  const navigate = useCallback(
    (page: PageRoute | string, navCtx?: NavigationContext) => {
      const path = toPath(page);
      dispatch({ type: 'NAVIGATE', page: page as PageRoute, navCtx });
      if (navigationRef.current) {
        navigationRef.current(path);
      }
    },
    []
  );

  const setAuthUser = useCallback((user: User | null) => {
    if (user) {
      dispatch({ type: 'LOGIN_SUCCESS', user });
      loadCloudData(dispatch);
    } else {
      dispatch({ type: 'LOGOUT' });
    }
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

  const submitExam = useCallback(async (submission: Submission) => {
    dispatch({ type: 'ADD_SUBMISSION', submission });
    try {
      await saveSubmission(submission);
    } catch (e) {
      console.error('submitExam cloud save failed', e);
      throw e;
    }
  }, []);

  const processEvaluation = useCallback(
    (submissionId: string) => {
      const submission = state.submissions.find((s) => s.id === submissionId);
      if (!submission) {
        console.warn('processEvaluation: submission not found', submissionId);
        return;
      }
      const exam = state.exams.find((e) => e.id === submission.examId);
      if (!exam) {
        dispatch({
          type: 'SHOW_TOAST',
          message: 'Exam not found for this submission',
          toastType: 'error',
        });
        return;
      }

      let rubric =
        state.rubrics.find((r) => r.examId === submission.examId) ||
        state.rubrics.find((r) => r.id === exam.rubricId);

      if (!rubric) {
        rubric = {
          id: exam.rubricId || `rubric-auto-${exam.id}`,
          examId: exam.id,
          questions: [
            {
              id: 'q1',
              number: '1',
              questionText: 'Overall answer quality',
              maxMarks: exam.maxMarks || 100,
              criteria: [
                {
                  id: 'c1',
                  description: 'Content and clarity',
                  maxMarks: exam.maxMarks || 100,
                },
              ],
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_RUBRIC', rubric });
        saveRubric(rubric).catch(console.error);
      }

      dispatch({
        type: 'UPDATE_SUBMISSION_STATUS',
        submissionId,
        status: 'PROCESSING',
      });
      updateSubmissionStatus(submissionId, 'PROCESSING').catch(console.error);

      const calibration = state.calibrations.find(
        (c) => c.studentId === submission.studentId
      );

      const useClaude =
        state.systemSettings.aiMode === 'claude' ||
        state.systemSettings.aiProvider === 'claude' ||
        state.systemSettings.aiMode === 'groq';

      (async () => {
        try {
          let evaluation: Evaluation;

          if (useClaude) {
            evaluation = await runClaudeEvaluation({
              submission,
              rubric: rubric!,
              examTitle: `${exam.title} (${exam.code})`,
              studentName: submission.studentName || 'Student',
              calibrationImageUrl:
                calibration?.imageUrl || calibration?.imageUrls?.slow,
            });
          } else {
            evaluation = runDemoEvaluation({
              submission,
              rubric: rubric!,
              examTitle: `${exam.title} (${exam.code})`,
              studentName: submission.studentName || 'Student',
            });
          }

          evaluation = {
            ...evaluation,
            examId: submission.examId,
            submissionId: submission.id,
            studentId: submission.studentId,
            studentName: submission.studentName,
            examTitle: evaluation.examTitle || exam.title,
            status: evaluation.status || 'AI_COMPLETE',
          };

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

          try {
            await saveEvaluation(evaluation);
            await updateSubmissionStatus(
              submissionId,
              'AI_COMPLETE',
              evaluation.id
            );
          } catch (e) {
            console.error('save evaluation failed', e);
          }

          if (state.currentUser) {
            addAuditLog({
              userId: state.currentUser.id,
              userName: state.currentUser.name,
              userRole: state.currentUser.role,
              action: 'AI_EVALUATION_COMPLETE',
              entity: 'evaluation',
              entityId: evaluation.id,
              details: `AI scored ${evaluation.totalMarks}/${evaluation.maxMarks} for ${evaluation.studentName}.`,
            });
          }
        } catch (e) {
          console.error('processEvaluation failed', e);
          dispatch({
            type: 'UPDATE_SUBMISSION_STATUS',
            submissionId,
            status: 'SUBMITTED',
          });
          updateSubmissionStatus(submissionId, 'SUBMITTED').catch(console.error);
          dispatch({
            type: 'SHOW_TOAST',
            message: 'AI evaluation failed — submission kept in queue',
            toastType: 'error',
          });
        }
      })();
    },
    [
      state.submissions,
      state.exams,
      state.rubrics,
      state.calibrations,
      state.systemSettings,
      state.currentUser,
      addAuditLog,
    ]
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
        facultyReviewedAt:
          evaluation.facultyReviewedAt ?? new Date().toISOString(),
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
      try {
        await saveExam(exam);
        dispatch({ type: 'ADD_EXAM', exam });
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
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    [state.currentUser, addAuditLog]
  );

  const deleteExam = useCallback(
    async (examId: string) => {
      const exam = state.exams.find((e) => e.id === examId);
      try {
        await deleteExamFromDb(examId);
        dispatch({ type: 'DELETE_EXAM', examId });
        if (state.currentUser) {
          addAuditLog({
            userId: state.currentUser.id,
            userName: state.currentUser.name,
            userRole: state.currentUser.role,
            action: 'EXAM_DELETED',
            entity: 'exam',
            entityId: examId,
            details: exam
              ? `Exam ${exam.code} (${exam.title}) deleted.`
              : `Exam ${examId} deleted.`,
          });
        }
      } catch (e) {
        console.error('Failed to delete exam', e);
        throw e;
      }
    },
    [state.exams, state.currentUser, addAuditLog]
  );

  const createRubric = useCallback((rubric: Rubric) => {
    dispatch({ type: 'ADD_RUBRIC', rubric });
    saveRubric(rubric).catch((e) => console.error('saveRubric', e));
  }, []);

  const updateRubric = useCallback((rubric: Rubric) => {
    dispatch({ type: 'UPDATE_RUBRIC', rubric });
    saveRubric(rubric).catch((e) => console.error('saveRubric', e));
  }, []);

  const addCalibration = useCallback((calibration: CalibrationSample) => {
    dispatch({ type: 'ADD_CALIBRATION', calibration });
    dispatch({ type: 'UPDATE_USER_CALIBRATED', userId: calibration.studentId });
    saveCalibration(calibration).catch((e) =>
      console.error('saveCalibration', e)
    );
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
    const u = state.currentUser;
    if (!u) return [];

    if (u.role === 'admin') return state.exams;

    if (u.role === 'faculty') {
      return state.exams.filter(
        (e) => e.facultyId === u.id || e.facultyName === u.name
      );
    }

    if (u.role === 'hod') {
      const c = (u.client || u.organisation || '').toLowerCase();
      if (!c) return state.exams;
      return state.exams.filter((e) =>
        `${e.description || ''} ${e.title || ''}`.toLowerCase().includes(c)
      );
    }

    if (u.role === 'student') {
      const section = (u.section || '').toLowerCase().trim();
      const batch = (u.batch || '').toLowerCase().trim();
      const org = (u.organisation || u.client || '').toLowerCase().trim();

      return state.exams.filter((exam) => {
        const status = (exam.status || 'ACTIVE').toUpperCase();
        if (status !== 'ACTIVE' && status !== 'OPEN') return false;

        if (exam.studentIds?.length && exam.studentIds.includes(u.id)) {
          return true;
        }

        const hay =
          `${exam.description || ''} ${exam.title || ''} ${exam.code || ''}`.toLowerCase();

        if (section && hay.includes(`[section:${section}]`)) return true;
        if (
          batch &&
          hay.includes(`[batch:${batch}]`) &&
          section &&
          hay.includes(section)
        )
          return true;
        if (
          section &&
          (hay.includes(section) || hay.includes(`section ${section}`))
        ) {
          if (batch && hay.includes('batch') && !hay.includes(batch)) {
            return hay.includes(section);
          }
          return true;
        }
        if (!section && batch && hay.includes(batch)) return true;
        if (!section && !batch && org && hay.includes(org)) return true;
        if (!section && !batch && !org) return true;
        return false;
      });
    }

    return [];
  }, [state.currentUser, state.exams]);

  const getSubmissionsForCurrentUser = useCallback((): Submission[] => {
    if (!state.currentUser) return [];
    if (state.currentUser.role === 'student') {
      return state.submissions.filter(
        (s) => s.studentId === state.currentUser!.id
      );
    }
    if (state.currentUser.role === 'faculty') {
      const ids = facultyExamIds(state.exams, state.currentUser);
      return state.submissions.filter((s) => ids.has(s.examId));
    }
    if (state.currentUser.role === 'admin') {
      return state.submissions;
    }
    return state.submissions;
  }, [state.currentUser, state.exams, state.submissions]);

  const getEvaluationsForCurrentUser = useCallback((): Evaluation[] => {
    if (!state.currentUser) return [];
    if (state.currentUser.role === 'student') {
      return state.evaluations.filter(
        (e) =>
          e.studentId === state.currentUser!.id && e.status === 'PUBLISHED'
      );
    }
    if (state.currentUser.role === 'faculty') {
      const ids = facultyExamIds(state.exams, state.currentUser);
      return state.evaluations.filter((e) => ids.has(e.examId));
    }
    return state.evaluations;
  }, [state.currentUser, state.exams, state.evaluations]);

  const getPendingReviewsForFaculty = useCallback((): Evaluation[] => {
    if (!state.currentUser || state.currentUser.role !== 'faculty') return [];
    const ids = facultyExamIds(state.exams, state.currentUser);
    return state.evaluations.filter(
      (e) =>
        ids.has(e.examId) &&
        (e.status === 'AI_COMPLETE' ||
          e.status === 'FACULTY_REVIEW' ||
          e.status === 'REVIEWED')
    );
  }, [state.currentUser, state.exams, state.evaluations]);

  const getCalibrationForStudent = useCallback(
    (studentId: string) =>
      state.calibrations.find((c) => c.studentId === studentId),
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
    (
      disputeId: string,
      resolution: string,
      status: 'RESOLVED' | 'REJECTED'
    ) => {
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
      const existing = state.resultVersions.filter(
        (v) => v.evaluationId === evaluationId
      );
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
        reloadCloudData,
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