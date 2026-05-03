import { useState, ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, PlusCircle, FileText, Settings, ShieldAlert, Menu, X, Trash2, MessageSquare, ExternalLink, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { auth as firebaseAuth } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await firebaseAuth.signOut();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'Past Cases', path: '/cases' },
    { icon: MessageSquare, label: 'AI Chat', path: '/chat' },
    { icon: Zap, label: 'Feeder Monitoring', path: '/feeder-monitoring' },
    { icon: Trash2, label: 'Trash', path: '/trash' },
    { icon: Settings, label: 'Admin Panel', path: '/admin' },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-slate-100">
        <h1 className="font-display font-bold text-lg leading-tight text-slate-900">
          My Assistant
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
              location.pathname === item.path
                ? "bg-brand-primary text-white shadow-lg shadow-indigo-600/20 font-medium"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-transform duration-300 group-hover:scale-110",
              location.pathname === item.path ? "text-white" : "text-slate-400 group-hover:text-brand-primary"
            )} />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-4 py-2 border-t border-slate-50">
        <a 
          href="https://www.lesco.gov.pk:36269/Modules/CustomerBillN/CheckBill.asp" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold text-slate-400 hover:text-brand-primary transition-colors uppercase tracking-[0.2em]"
        >
          <ExternalLink className="w-3 h-3" />
          Official Portal
        </a>
      </div>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Employee</p>
          <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'Loading...'}</p>
          <p className="text-xs text-slate-500 truncate font-medium">Sub-Division: {user?.subDivision || 'N/A'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-brand-primary hover:bg-indigo-50 rounded-xl transition-all duration-300 group"
        >
          <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-brand-primary p-1.5 rounded-lg shadow-lg shadow-indigo-600/20">
            <ShieldAlert className="text-white w-5 h-5" />
          </div>
          <span className="font-display font-bold text-slate-900">My Assistant</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6 text-slate-600" /> : <Menu className="w-6 h-6 text-slate-600" />}
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
              className="fixed inset-y-0 left-0 w-72 bg-white z-[70] md:hidden flex flex-col shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-100 flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 pb-24 md:pb-32">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
