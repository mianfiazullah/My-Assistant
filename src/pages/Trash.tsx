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
import { collection, query, onSnapshot, doc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DetectionCase } from '../types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function Trash() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deletedCases, setDeletedCases] = useState<DetectionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [caseToPermanentlyDelete, setCaseToPermanentlyDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    // Query directly from the trash collection where cases are actually stored on deletion
    const q = query(collection(db, 'trash'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DetectionCase));
      
      const isUserAdmin = user?.email?.toLowerCase() === 'mianfiazullah@gmail.com' || user?.role === 'admin';
      if (!isUserAdmin) {
        const userSub = (user?.subDivision || '').trim().toLowerCase();
        cases = cases.filter(c => {
          const caseSub = (c.billData?.subDivisionName || '').trim().toLowerCase();
          return userSub ? (caseSub === userSub) : (c.userId === user?.uid);
        });
      }

      setDeletedCases(cases);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trash');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const restoreCase = async (id: string) => {
    setIsRestoring(id);
    try {
      const trashDoc = await getDoc(doc(db, 'trash', id));
      if (trashDoc.exists()) {
        const caseData = trashDoc.data();
        const { deletedAt, ...restOfCaseData } = caseData as any;
        
        // Optimistically remove from deleted list
        setDeletedCases(prev => prev.filter(c => c.id !== id));

        const batch = writeBatch(db);
        batch.set(doc(db, 'cases', id), {
          ...restOfCaseData,
          updatedAt: new Date().toISOString()
        });
        batch.delete(doc(db, 'trash', id));
        await batch.commit();
        toast.success('Case restored successfully');
      } else {
        toast.error('Case not found in trash');
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'cases');
      toast.error('Failed to restore case');
    } finally {
      setIsRestoring(null);
    }
  };

  const permanentlyDelete = async (id: string) => {
    setIsDeleting(true);
    // Optimistically remove from deleted list
    setDeletedCases(prev => prev.filter(c => c.id !== id));
    try {
      await deleteDoc(doc(db, 'trash', id));
      toast.success('Case permanently deleted');
      setCaseToPermanentlyDelete(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'trash');
      toast.error('Failed to delete case');
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteAllTrash = async () => {
    setIsDeletingAll(true);
    const toastId = toast.loading('Emptying trash...');
    try {
      // Create a batch
      const batch = writeBatch(db);
      deletedCases.forEach(item => {
        if (item.id) {
          batch.delete(doc(db, 'trash', item.id));
        }
      });
      await batch.commit();
      toast.success('Trash emptied successfully', { id: toastId });
      setShowDeleteAllConfirm(false);
      setDeletedCases([]);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'trash');
      toast.error('Failed to empty trash', { id: toastId });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const filteredCases = deletedCases.filter(c => {
    const consumerName = c.name || c.billData?.consumerName || '';
    const referenceNumber = c.referenceNumber || c.billData?.referenceNumber || '';
    return consumerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           referenceNumber.includes(searchQuery);
  });

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
        {deletedCases.length > 0 && (
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-550 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all hover:bg-red-700 active:scale-95 self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete All
          </button>
        )}
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
                {filteredCases.map((item) => {
                  const consumerName = item.name || item.billData?.consumerName || 'Unknown Consumer';
                  const connectionType = item.tariff || item.billData?.connectionType || 'General';
                  const referenceNumber = item.referenceNumber || item.billData?.referenceNumber || 'N/A';
                  return (
                    <tr key={item.id} className="group hover:bg-neutral-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-500 font-bold">
                            {consumerName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900">{consumerName}</p>
                            <p className="text-[10px] text-neutral-400 font-medium uppercase">{connectionType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-neutral-500">
                          <Hash className="w-4 h-4" />
                          <span className="text-sm font-mono font-medium">{referenceNumber}</span>
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
                          disabled={isRestoring !== null}
                          className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all disabled:opacity-50"
                          title="Restore Case"
                        >
                          {isRestoring === item.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-5 h-5" />
                          )}
                        </button>
                        <button 
                          onClick={() => setCaseToPermanentlyDelete(item.id!)}
                          disabled={isRestoring !== null}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ); })}
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

      {/* Modern Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {caseToPermanentlyDelete && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 max-w-md w-full rounded-[2rem] p-8 shadow-2xl border border-neutral-100 dark:border-slate-800 text-center space-y-6"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Permanently Delete?</h3>
                <p className="text-neutral-500 dark:text-slate-400 mt-2 text-sm">
                  Are you sure you want to permanently delete this case? This action belongs to Zero-Trust constraints, is completely irreversible and cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCaseToPermanentlyDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-700 dark:text-slate-300 bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => permanentlyDelete(caseToPermanentlyDelete)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty Trash Confirmation Modal */}
      <AnimatePresence>
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 max-w-md w-full rounded-[2rem] p-8 shadow-2xl border border-neutral-100 dark:border-slate-800 text-center space-y-6"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-950/30 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Empty Trash?</h3>
                <p className="text-neutral-500 dark:text-slate-400 mt-2 text-sm">
                  Are you sure you want to permanently delete all {deletedCases.length} items from the trash? This action is completely irreversible and cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteAllConfirm(false)}
                  disabled={isDeletingAll}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-700 dark:text-slate-300 bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={deleteAllTrash}
                  disabled={isDeletingAll}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-650 hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting All...
                    </>
                  ) : (
                    'Empty Trash'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
