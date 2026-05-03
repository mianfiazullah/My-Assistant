import { ReactNode, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import FeederMonitoring from './pages/FeederMonitoring';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewCase from './pages/NewCase';
import Cases from './pages/Cases';
import QuickEdit from './pages/QuickEdit';
import Admin from './pages/Admin';
import Chat from './pages/Chat';
import Trash from './pages/Trash';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Auth Guard
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, isAuthReady } = useAuth();
  
  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600/30 border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
};

// Path Persistence
const PathPersistence = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const savedPath = localStorage.getItem('lesco_last_path');
    // Only redirect if we are at root and have a saved path
    if (savedPath && location.pathname === '/' && savedPath !== '/') {
      navigate(savedPath, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== '/login') {
      localStorage.setItem('lesco_last_path', location.pathname);
    }
  }, [location.pathname]);

  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <PathPersistence>
            <Toaster position="top-center" richColors />
            <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/new-case" element={
              <ProtectedRoute>
                <NewCase />
              </ProtectedRoute>
            } />
            
            <Route path="/cases" element={
              <ProtectedRoute>
                <Cases />
              </ProtectedRoute>
            } />
            
            <Route path="/quick-edit" element={
              <ProtectedRoute>
                <QuickEdit />
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />

            <Route path="/chat" element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            } />

            <Route path="/trash" element={
              <ProtectedRoute>
                <Trash />
              </ProtectedRoute>
            } />

            <Route path="/feeder-monitoring" element={
              <ProtectedRoute>
                <FeederMonitoring />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          </PathPersistence>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
