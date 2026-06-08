import { useState, ReactNode, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, PlusCircle, FileText, Settings, ShieldAlert, Menu, X, Trash2, MessageSquare, ExternalLink, Zap, Activity, UserX } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { auth as firebaseAuth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, isImpersonating, impersonateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);

  useEffect(() => {
    const checkStep = () => {
      const savedStep = localStorage.getItem('lesco_new_case_step');
      if (savedStep) {
        try {
          const step = JSON.parse(savedStep);
          if (step > 1) {
            setActiveStep(step);
          } else {
            setActiveStep(null);
          }
        } catch (e) {
          setActiveStep(null);
        }
      } else {
        setActiveStep(null);
      }
    };

    checkStep();
    // Also listen for storage changes in case it's updated in another tab or elsewhere
    window.addEventListener('storage', checkStep);
    // And check periodically since NewCase might update it
    const interval = setInterval(checkStep, 2000);
    
    return () => {
      window.removeEventListener('storage', checkStep);
      clearInterval(interval);
    };
  }, []);

  const handleLogout = async () => {
    if (isImpersonating) {
      impersonateUser(null);
    }
    await firebaseAuth.signOut();
    navigate('/login');
  };

  const handleExitImpersonation = () => {
    impersonateUser(null);
    navigate('/admin');
  };

  const isMianFiazullah = user?.email?.toLowerCase() === 'mianfiazullah@gmail.com';

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ...(activeStep ? [{ icon: Activity, label: `Active Case (S${activeStep})`, path: '/new-case', pulse: true }] : []),
    { icon: FileText, label: 'Past Cases', path: '/cases' },
    { icon: ExternalLink, label: 'My Assistant Drive', path: '/drive' },
    { icon: MessageSquare, label: 'AI Chat', path: '/chat' },
    ...(isMianFiazullah ? [{ icon: Zap, label: 'Feeder Monitoring', path: '/feeder-monitoring' }] : []),
    { icon: Trash2, label: 'Trash', path: '/trash' },
    ...((isMianFiazullah || user?.role === 'admin') ? [{ icon: Settings, label: 'Admin Panel', path: '/admin' }] : []),
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-slate-100 dark:border-slate-800">
        <h1 className="font-display font-bold text-lg leading-tight text-slate-900 dark:text-slate-50">
          My Assistant
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item: any) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
              location.pathname === item.path
                ? "bg-brand-primary text-white shadow-lg shadow-indigo-600/20 font-medium"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
              item.pulse && "text-emerald-600 dark:text-emerald-400 font-bold"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
              location.pathname === item.path ? "text-white" : (item.pulse ? "text-emerald-500 font-bold" : "text-slate-400 group-hover:text-brand-primary dark:text-slate-500 dark:group-hover:text-indigo-400")
            )} />
            {item.label}
            {item.pulse && (
              <span className="absolute right-4 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-2 border-t border-slate-50 dark:border-slate-800/50">
        <a 
          href="https://www.lesco.gov.pk:36269/Modules/CustomerBillN/CheckBill.asp" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-brand-primary transition-colors uppercase tracking-[0.2em] dark:text-slate-500 dark:hover:text-indigo-400"
        >
          <ExternalLink className="w-3 h-3" />
          Official Portal
        </a>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800">
        <div className={cn("p-4 rounded-2xl mb-4 border", isImpersonating ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" : "bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800")}>
          <p className={cn("text-[10px] uppercase tracking-widest font-bold mb-1", isImpersonating ? "text-amber-600 dark:text-amber-500 animate-pulse" : "text-slate-400 dark:text-slate-500")}>
            {isImpersonating ? 'Impersonating User' : 'Officer'}
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name || 'Loading...'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">Sub-Division: {user?.subDivision || 'N/A'}</p>
          {isImpersonating && (
             <button
               onClick={handleExitImpersonation}
               className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-400 rounded-lg text-xs font-bold transition-colors"
             >
               <UserX className="w-4 h-4" />
               Exit Impersonation
             </button>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-brand-primary hover:bg-indigo-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400 rounded-xl transition-all duration-300 group"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-brand-primary p-1.5 rounded-lg shadow-lg shadow-indigo-600/20">
            <ShieldAlert className="text-white w-5 h-5" />
          </div>
          <span className="font-display font-bold text-slate-900 dark:text-slate-100">My Assistant</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6 text-slate-600 dark:text-slate-400" /> : <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 pb-24 md:pb-32 relative">
        {isImpersonating && (
          <div className="fixed top-4 right-4 md:right-8 z-50 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            Impersonating: {user?.name}
          </div>
        )}
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
