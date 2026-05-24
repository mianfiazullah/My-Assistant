import { ReactNode, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from './firebase';
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
import Drive from './pages/Drive';
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

  const isExpired = user.expiryDate && new Date(user.expiryDate) < new Date() && user.email.toLowerCase() !== 'mianfiazullah@gmail.com';
  const isDisabled = user.disabled && user.email.toLowerCase() !== 'mianfiazullah@gmail.com';

  if (isDisabled || isExpired) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6V9m12 3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-rose-500 mb-2">Access Restrained</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            {isDisabled 
              ? "Your LESCO Detection Engine user account has been disabled by the system administrator." 
              : "Your demo access period has expired. Please contact the administrator to renew your system permit."}
          </p>
          <div className="space-y-4 mb-6">
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800 text-xs text-left">
              <span className="text-slate-500 block font-bold mb-0.5">User Account</span>
              <span className="text-slate-300 font-mono block truncate">{user.email}</span>
            </div>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-950/20 cursor-pointer text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <Layout>{children}</Layout>;
};

// Feeder Monitoring Guard
const FeederMonitoringGuard = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  if (!user || user.email.toLowerCase() !== 'mianfiazullah@gmail.com') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

// Path Persistence
const PathPersistence = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const savedPath = localStorage.getItem('lesco_last_path');
    // Only redirect if we are at root and have a valid saved path
    if (savedPath && savedPath !== 'undefined' && savedPath !== 'null' && location.pathname === '/' && savedPath !== '/') {
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
  // Automatic permanent deletion of target case 06117520986400 (SANA ULLAH HAJI NAWAB DIN)
  useEffect(() => {
    const cleanupTarget = async () => {
      const targetRef = "06117520986400";
      
      // 1. Clean LocalStorage
      const keys = [
        'lesco_dashboard_ref',
        'lesco_new_case_ref',
        'lesco_bill_data',
        'lesco_detection_data',
        'lesco_new_case_photo',
        'lesco_new_case_step',
        'lesco_quick_edit_case',
        'lesco_quick_edit_data'
      ];
      
      let clearedAny = false;
      keys.forEach(key => {
        try {
          const val = localStorage.getItem(key);
          if (val && (val.includes(targetRef) || val.toLowerCase().includes("sana ullah") || val.toLowerCase().includes("nawab din"))) {
            localStorage.removeItem(key);
            clearedAny = true;
          }
        } catch (e) {
          console.error(`Error clearing localStorage key ${key}:`, e);
        }
      });
      if (clearedAny) {
        console.log("Successfully cleared target case reference and data from LocalStorage.");
      }

      // 2. Clear from Firestore 'cases' and 'trash' collections
      try {
        const collectionsToSearch = ['cases', 'trash'];
        for (const colName of collectionsToSearch) {
          const snap = await getDocs(collection(db, colName));
          const docsToDelete: string[] = [];
          
          snap.forEach(docSnap => {
            const data = docSnap.data();
            const refNum = data.referenceNumber || data.billData?.referenceNumber || '';
            const consumerName = data.name || data.billData?.consumerName || '';
            
            if (
              refNum.replace(/[^0-9]/g, '') === targetRef ||
              consumerName.toLowerCase().includes('sana ullah') ||
              consumerName.toLowerCase().includes('nawab din')
            ) {
              docsToDelete.push(docSnap.id);
            }
          });

          if (docsToDelete.length > 0) {
            console.log(`Deleting target docs from ${colName}:`, docsToDelete);
            const batch = writeBatch(db);
            docsToDelete.forEach(id => {
              batch.delete(doc(db, colName, id));
            });
            await batch.commit();
            console.log(`Successfully deleted target docs from ${colName}.`);
          }
        }
      } catch (err) {
        console.error("Error running Firestore cleanup background task:", err);
      }
    };

    cleanupTarget();
    // Run periodically as well to catch any recreated/restored ones
    const interval = setInterval(cleanupTarget, 5000);
    return () => clearInterval(interval);
  }, []);

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

            <Route path="/drive" element={
              <ProtectedRoute>
                <Drive />
              </ProtectedRoute>
            } />

            <Route path="/feeder-monitoring" element={
              <ProtectedRoute>
                <FeederMonitoringGuard>
                  <FeederMonitoring />
                </FeederMonitoringGuard>
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
