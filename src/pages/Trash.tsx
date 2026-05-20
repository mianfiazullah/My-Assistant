import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  Calendar, 
  User, 
  Hash,
  AlertCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DetectionCase } from '../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function Trash() {
  const navigate = useNavigate();
  const [deletedCases, setDeletedCases] = useState<DetectionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // In a real app, we'd have a 'deleted' flag or a separate collection
    // For this demo, we'll assume cases with a 'status' of 'deleted' are in trash
    const q = query(collection(db, 'cases'), where('status', '==', 'deleted'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DetectionCase));
      setDeletedCases(cases);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cases');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const restoreCase = async (id: string) => {
    try {
      await updateDoc(doc(db, 'cases', id), {
        status: 'active',
        updatedAt: new Date().toISOString()
      });
      toast.success('Case restored successfully');
    } catch (error) {
      toast.error('Failed to restore case');
    }
  };

  const permanentlyDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this case? This action cannot be undone.')) return;
    
    try {
      await deleteDoc(doc(db, 'cases', id));
      toast.success('Case permanently deleted');
    } catch (error) {
      toast.error('Failed to delete case');
    }
  };

  const filteredCases = deletedCases.filter(c => 
    c.billData.consumerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.billData.referenceNumber.includes(searchQuery)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-neutral-200 rounded-full transition-colors lg:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div className="bg-neutral-900 p-3 rounded-2xl shadow-lg">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Trash</h1>
            <p className="text-sm text-neutral-500 font-medium">Manage deleted cases and records</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-neutral-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
          <div className="relative group max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
              <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Loading trash...</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-20 text-center space-y-4">
              <div className="bg-neutral-100 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-neutral-400" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-bold text-neutral-900">Trash is empty</p>
                <p className="text-sm text-neutral-500">Deleted cases will appear here for 30 days.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50/50 border-b border-neutral-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Consumer Details</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Reference No.</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Deleted On</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredCases.map((item) => (
                  <tr key={item.id} className="group hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500 font-bold">
                          {item.billData.consumerName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-900">{item.billData.consumerName}</p>
                          <p className="text-[10px] text-neutral-400 font-medium uppercase">{item.billData.connectionType || 'General'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Hash className="w-4 h-4" />
                        <span className="text-sm font-mono font-medium">{item.billData.referenceNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">{format(new Date(item.updatedAt || item.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => restoreCase(item.id!)}
                          className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                          title="Restore Case"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => permanentlyDelete(item.id!)}
                          className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl flex items-start gap-4">
        <div className="bg-amber-100 p-2 rounded-xl">
          <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h4 className="font-bold text-amber-900">Trash Retention Policy</h4>
          <p className="text-sm text-amber-800 mt-1">Items in trash are automatically deleted after 30 days. Restoring a case will move it back to your active dashboard.</p>
        </div>
      </div>
    </div>
  );
}
