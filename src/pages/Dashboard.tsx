import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  FileText, 
  AlertCircle,
  Search,
  Calendar,
  X
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { DetectionCase } from '../types';
import { cn } from '../lib/utils';

export default function Dashboard() {
  const [recentCases, setRecentCases] = useState<DetectionCase[]>([]);
  const [stats, setStats] = useState([
    { label: 'Total Cases', value: '0', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'New This Month', value: '0', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { label: 'Pending FIR', value: '0', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Sync Efficiency', value: '98%', icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-100' },
  ]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DetectionCase));
      
      const filteredCases = allCases.filter(c => {
        if (!c.createdAt) return false;
        const caseDate = new Date(c.createdAt).toISOString().split('T')[0];
        const isAfterStart = !dateRange.start || caseDate >= dateRange.start;
        const isBeforeEnd = !dateRange.end || caseDate <= dateRange.end;
        return isAfterStart && isBeforeEnd;
      });

      setRecentCases(filteredCases.slice(0, 5));
      
      setStats(prev => [
        { ...prev[0], value: filteredCases.length.toString() },
        { ...prev[1], value: filteredCases.filter(c => {
            const date = new Date(c.createdAt);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length.toString() 
        },
        { ...prev[2], value: filteredCases.filter(c => !c.registeredFirNo).length.toString() },
        { ...prev[3], value: '1' },
      ]);
    });

    return () => unsubscribe();
  }, [dateRange]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Dashboard Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Welcome back. Here's what's happening with your cases.</p>
      </header>

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-4 px-2">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Start Date</label>
          <input
            type="date"
            value={dateRange.start}
            max={today}
            onChange={(e) => {
              const newStart = e.target.value;
              setDateRange(prev => {
                const nextState = { ...prev, start: newStart };
                if (prev.end && newStart > prev.end) {
                  nextState.end = newStart;
                }
                return nextState;
              });
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
          />
        </div>
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">End Date</label>
          <input
            type="date"
            value={dateRange.end}
            min={dateRange.start || undefined}
            max={today}
            onChange={(e) => {
              const newEnd = e.target.value;
              if (dateRange.start && newEnd < dateRange.start) {
                return;
              }
              setDateRange(prev => ({ ...prev, end: newEnd }));
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
          />
        </div>
        {(dateRange.start || dateRange.end) && (
          <button
            onClick={() => setDateRange({ start: '', end: '' })}
            className="mt-6 p-3 text-slate-400 hover:text-red-500 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", stat.bg)}>
              <stat.icon className={cn("w-6 h-6", stat.color)} />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold">Recent Cases</h2>
          <button className="text-brand-primary text-sm font-bold hover:underline">View All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4">Consumer</th>
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentCases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{c.billData.consumerName}</td>
                  <td className="px-6 py-4 text-slate-500">{c.billData.referenceNumber}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase",
                      c.registeredFirNo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {c.registeredFirNo ? 'Completed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
