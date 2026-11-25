import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import MyFilesPage from './pages/MyFilesPage';
import BackupManagementPage from './pages/BackupManagementPage';
import DisasterRecoveryPage from './pages/DisasterRecoveryPage';
import RecoveryHistoryPage from './pages/RecoveryHistoryPage';
import RecycleBinPage from './pages/RecycleBinPage';
import SettingsPage from './pages/SettingsPage';

function ProtectedShell({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  return <Layout>{children}</Layout>;
}

function PublicAuthRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<PublicAuthRoute />} />
            <Route
              path="/"
              element={
                <ProtectedShell>
                  <DashboardPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/files"
              element={
                <ProtectedShell>
                  <MyFilesPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/backups"
              element={
                <ProtectedShell>
                  <BackupManagementPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/recovery"
              element={
                <ProtectedShell>
                  <DisasterRecoveryPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedShell>
                  <RecoveryHistoryPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/trash"
              element={
                <ProtectedShell>
                  <RecycleBinPage />
                </ProtectedShell>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedShell>
                  <SettingsPage />
                </ProtectedShell>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}
