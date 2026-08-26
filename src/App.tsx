import React, { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/Layout';
import { Toast, Spinner } from './components/ui';
import { navigationRef } from './lib/navigation';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';

import StudentDashboard from './pages/student/StudentDashboard';
import CalibrationPage from './pages/student/CalibrationPage';
import SubmitExamPage from './pages/student/SubmitExamPage';
import ResultsPage from './pages/student/ResultsPage';
import DisputePage from './pages/student/DisputePage';

import FacultyDashboard from './pages/faculty/FacultyDashboard';
import CreateExamPage from './pages/faculty/CreateExamPage';
import PendingReviewsPage from './pages/faculty/PendingReviewsPage';
import ReviewInterfacePage from './pages/faculty/ReviewInterfacePage';
import PublishedResultsPage from './pages/faculty/PublishedResultsPage';
import DisputeManagementPage from './pages/faculty/DisputeManagementPage';

import AdminDashboard from './pages/admin/AdminDashboard';
import UsersPage from './pages/admin/UsersPage';
import UsagePage from './pages/admin/UsagePage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import SettingsPage from './pages/admin/SettingsPage';
import GroqSetupPage from './pages/admin/GroqSetupPage';
import ExamStructurePage from './pages/admin/ExamStructurePage';

function NavigationBinder() {
  const navigate = useNavigate();

  useEffect(() => {
    navigationRef.current = (path: string) => navigate(path);
    return () => {
      navigationRef.current = null;
    };
  }, [navigate]);

  return null;
}

function AutoProcessor() {
  const { state, processEvaluation } = useApp();
  const processed = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    state.submissions.forEach((sub) => {
      if (sub.status === 'SUBMITTED' && !processed.current.has(sub.id)) {
        processed.current.add(sub.id);
        processEvaluation(sub.id);
      }
    });
  }, [state.submissions, processEvaluation]);

  return null;
}

function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { state } = useApp();

  if (state.authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!state.currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(state.currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { state, clearToast } = useApp();
  const { currentUser, toast, authLoading } = state;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  const home =
    currentUser?.role === 'student'
      ? '/student'
      : currentUser?.role === 'faculty'
        ? '/faculty'
        : currentUser?.role === 'admin'
          ? '/admin'
          : '/';

  return (
    <>
      <NavigationBinder />
      <Routes>
        <Route
          path="/"
          element={
            !currentUser ? <LandingPage /> : <Navigate to={home} replace />
          }
        />
        <Route
          path="/login"
          element={
            !currentUser ? <AuthPage /> : <Navigate to={home} replace />
          }
        />
        <Route
          path="/auth"
          element={
            !currentUser ? <AuthPage /> : <Navigate to={home} replace />
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute roles={['student']}>
              <AppLayout>
                <StudentDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/calibration"
          element={
            <ProtectedRoute roles={['student']}>
              <AppLayout>
                <CalibrationPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/submit"
          element={
            <ProtectedRoute roles={['student']}>
              <AppLayout>
                <SubmitExamPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/results"
          element={
            <ProtectedRoute roles={['student']}>
              <AppLayout>
                <ResultsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/disputes"
          element={
            <ProtectedRoute roles={['student']}>
              <AppLayout>
                <DisputePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/faculty"
          element={
            <ProtectedRoute roles={['faculty', 'admin']}>
              <AppLayout>
                <FacultyDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/create-exam"
          element={
            <ProtectedRoute roles={['faculty', 'admin']}>
              <AppLayout>
                <CreateExamPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/reviews"
          element={
            <ProtectedRoute roles={['faculty', 'admin']}>
              <AppLayout>
                <PendingReviewsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/review"
          element={
            <ProtectedRoute roles={['faculty', 'admin']}>
              <ReviewInterfacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/results"
          element={
            <ProtectedRoute roles={['faculty', 'admin']}>
              <AppLayout>
                <PublishedResultsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/faculty/disputes"
          element={
            <ProtectedRoute roles={['faculty', 'admin']}>
              <AppLayout>
                <DisputeManagementPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <AdminDashboard />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <UsersPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/structure"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <ExamStructurePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/usage"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <UsagePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <AuditLogsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <SettingsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/groq"
          element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout>
                <GroqSetupPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {currentUser && <AutoProcessor />}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}