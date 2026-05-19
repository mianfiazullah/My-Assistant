import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewCase from './pages/NewCase';
import Cases from './pages/Cases';
import Drive from './pages/Drive';
import QuickEdit from './pages/QuickEdit';
import Chat from './pages/Chat';
import Trash from './pages/Trash';
import Login from './pages/Login';
import Admin from './pages/Admin';
import FeederMonitoring from './pages/FeederMonitoring';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="new-case" element={<NewCase />} />
              <Route path="cases" element={<Cases />} />
              <Route path="drive" element={<Drive />} />
              <Route path="quick-edit" element={<QuickEdit />} />
              <Route path="chat" element={<Chat />} />
              <Route path="trash" element={<Trash />} />
              <Route path="admin" element={<Admin />} />
              <Route path="feeder-monitoring" element={<FeederMonitoring />} />
            </Route>
          </Routes>
          <Toaster position="bottom-right" />
        </div>
      </Router>
    </AuthProvider>
  );
}
