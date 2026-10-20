import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { WorkspaceProvider } from './components/workspace/WorkspaceProvider';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage'));
const AuthLayout = lazy(() => import('./pages/auth/AuthLayout'));
const OAuth2RedirectHandler = lazy(() => import('./pages/auth/OAuth2RedirectHandler'));
const WorkspaceHomePage = lazy(() => import('./pages/main/WorkspaceHomePage'));
const MyPage = lazy(() => import('./pages/main/MyPage'));
const NotesPage = lazy(() => import('./pages/main/NotesPage'));
const PersonalTravelPage = lazy(() => import('./pages/travel/PersonalTravelPage'));
const LedgerRoute = lazy(() => import('./pages/ledger/LedgerRoute'));
const InvestmentAccountDetailRoute = lazy(() => import('./pages/ledger/InvestmentAccountDetailRoute'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'));
const LearningPage = lazy(() => import('./pages/learning/LearningPage'));
const LearningEditorPage = lazy(() => import('./pages/learning/LearningEditorPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const UpdatesPage = lazy(() => import('./pages/main/UpdatesPage'));
const PublicNewsPage = lazy(() => import('./pages/main/PublicNewsPage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/news" element={<PublicNewsPage />} />
          </Route>
          <Route path="/oauth2/redirect" element={<OAuth2RedirectHandler />} />
          <Route element={<WorkspaceProvider><ProtectedRoute /></WorkspaceProvider>}>
            <Route path="/" element={<WorkspaceHomePage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/calendar/*" element={<CalendarPage />} />
            <Route path="/learning/:editorSection/new" element={<LearningEditorPage />} />
            <Route path="/learning/:editorSection/:entryId/edit" element={<LearningEditorPage />} />
            <Route path="/learning/*" element={<LearningPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/planner" element={<PersonalTravelPage />} />
            <Route path="/ledger" element={<LedgerRoute />} />
            <Route path="/ledger/investment" element={<InvestmentAccountDetailRoute />} />
            <Route path="/trips/:tripId/*" element={<PersonalTravelPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
