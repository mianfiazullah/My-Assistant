import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Briefcase, 
  HardDrive, 
  MessageSquare, 
  Trash2, 
  Settings,
  LogOut,
  Zap
} from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../lib/utils';

export default function Layout() {
  const location = useLocation();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: PlusCircle, label: 'New Case', path: '/new-case' },
    { icon: Briefcase, label: 'All Cases', path: '/cases' },
    { icon: HardDrive, label: 'My Assistant Drive', path: '/drive' },
    { icon: MessageSquare, label: 'AI Chat', path: '/chat' },
    { icon: Zap, label: 'Feeder Monitoring', path: '/feeder-monitoring' },
    { icon: Trash2, label: 'Trash', path: '/trash' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-brand-primary flex items-center gap-2">
            <Zap className="fill-brand-primary" />
            LESCO Assistant
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                location.pathname === item.path
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8">
        <Outlet />
      </main>
    </div>
  );
}
