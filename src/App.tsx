import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/Layout';
import { Toast, Spinner } from './components/ui';

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

function AutoProcessor() {
  const { state, processEvaluation } = useApp();
  const processed = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    state.submissions.forEach((sub) => {
      if (sub.status === 'SUBMITTED' && !processed.current.has(sub.id)) {
        processed.current.add(sub.id);
        processEvaluation(sub.id);
      }
    });
  }, [state.submissions, processEvaluation]);

  return null;
}

function Router() {
  const { state, clearToast } = useApp();
  const { page, currentUser, toast, authLoading } = state;

  // Show loading while restoring session
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

  // Not logged in → only Landing or Auth
  if (!currentUser) {
    if (page === 'auth') return <AuthPage />;
    return <LandingPage />;
  }

  // Faculty review (full screen, no layout)
  if (page === 'f-review') {
    return (
      <>
        <ReviewInterfacePage />
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={clearToast} />
        )}
      </>
    );
  }

  const content = (() => {
    if (currentUser.role === 'student') {
      if (page === 's-dashboard') return <StudentDashboard />;
      if (page === 's-calibration') return <CalibrationPage />;
      if (page === 's-submit') return <SubmitExamPage />;
      if (page === 's-results' || page === 's-result-detail') return <ResultsPage />;
      if (page === 's-disputes') return <DisputePage />;
    }

    if (currentUser.role === 'faculty' || currentUser.role === 'admin') {
      if (page === 'f-dashboard') return <FacultyDashboard />;
      if (page === 'f-create-exam' || page === 'f-rubric-builder') return <CreateExamPage />;
      if (page === 'f-reviews') return <PendingReviewsPage />;
      if (page === 'f-results') return <PublishedResultsPage />;
      if (page === 'f-disputes') return <DisputeManagementPage />;
    }

    if (currentUser.role === 'admin') {
      if (page === 'a-dashboard') return <AdminDashboard />;
      if (page === 'a-users') return <UsersPage />;
      if (page === 'a-usage') return <UsagePage />;
      if (page === 'a-audit') return <AuditLogsPage />;
      if (page === 'a-settings') return <SettingsPage />;
      if (page === 'a-groq') return <GroqSetupPage />;
    }

    // Fallbacks
    if (currentUser.role === 'student') return <StudentDashboard />;
    if (currentUser.role === 'faculty') return <FacultyDashboard />;
    return <AdminDashboard />;
  })();

  return (
    <AppLayout>
      <AutoProcessor />
      {content}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}