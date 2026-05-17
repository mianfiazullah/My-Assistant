import React, { useEffect, useState, useRef, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, FileText, ChevronRight, Hash, Calendar, User, Loader2, X, MapPin, Zap, Activity, Home, ShieldAlert, ExternalLink, Users, Printer, Eye, Trash2, Edit2, Copy, Check, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DetectionCase } from '../types';
import { format } from 'date-fns';
import { ProformaTemplates } from '../components/ProformaTemplates';
import { toast } from 'sonner';

export default function Cases() {
  const [cases, setCases] = useState<DetectionCase[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCase, setSelectedCase] = useState<DetectionCase | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ type: string; data: any } | null>(null);
  const printRefDetectionBill = useRef<HTMLDivElement>(null);
  const printRefNotice = useRef<HTMLDivElement>(null);
  const printRefFIR = useRef<HTMLDivElement>(null);
  const printRefFIRUrdu = useRef<HTMLDivElement>(null);
  const printRefRegister = useRef<HTMLDivElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCaseExcel = (item: DetectionCase) => {
    const data = [
      item.billData.referenceNumber,
      item.billData.consumerName,
      item.billData.address,
      item.dateOfChecking,
      item.billData.customerId || item.customerId || "",
      item.tariff || item.billData.tariff || "",
      item.sanctionLoad || item.billData.sanctionedLoad || "",
      item.connectedLoad || "",
      item.meterNumber || item.billData.meterNoOnBill || "",
      item.meterType || "",
      item.meterMake || "",
      item.capacity || "",
      item.meterStatus || item.billData.meterStatus || "",
      item.presentReading || "",
      item.billData.previousReading || item.previousReading || "",
      item.billData.difference || item.difference || "",
      item.unitsAssessed || "",
      item.netUnitsToBeCharged || "",
      item.billData.billingMonth || item.billingMonth || "",
      item.firNumber || item.registeredFirNo || "",
      item.policeStation || "",
      item.registeredFirDated || item.firDated || "",
      item.remarks || "",
      (item.checkedBy || []).join(', '),
      (item.witnesses || []).join(', ')
    ];

    const textToCopy = data.join('\t');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(item.id);
      toast.success('Case data copied for Excel/Sheets!');
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy case data');
    });
  };

  const printTemplate = (ref: RefObject<HTMLDivElement | null>) => {
    const content = ref.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Print</title>`);
    printWindow.document.write(`<script src="https://cdn.tailwindcss.com"></script>`);
    printWindow.document.write(`<style>@media print { body { -webkit-print-color-adjust: exact; } }</style>`);
    printWindow.document.write(`</head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const triggerPrint = (type: any) => {
    let ref = null;
    if (type === 'DETECTION BILL PROFORMA') ref = printRefDetectionBill;
    else if (type === 'NOTICE') ref = printRefNotice;
    else if (type === 'FIR Request') ref = printRefFIR;
    else if (type === 'FIR Urdu') ref = printRefFIRUrdu;
    else if (type === 'Detection Register') ref = printRefRegister;
    
    if (ref) {
        printTemplate(ref);
    }
  };

  const downloadAsJpeg = async (type: string, fileData: any) => {
    let templateRef = null;
    if (type === 'DETECTION BILL PROFORMA') templateRef = printRefDetectionBill;
    else if (type === 'NOTICE') templateRef = printRefNotice;
    else if (type === 'FIR Request') templateRef = printRefFIR;
    else if (type === 'FIR Urdu') templateRef = printRefFIRUrdu;
    else if (type === 'Detection Register') templateRef = printRefRegister;

    if (templateRef && templateRef.current) {
      try {
        toast.loading('Generating image for download...', { id: 'downloadJpeg' });
        
        let domToJpeg;
        try {
          const mod = await import('modern-screenshot');
          domToJpeg = mod.domToJpeg;
        } catch {
          throw new Error('Image generation library not available.');
        }

        const dataUrl = await domToJpeg(templateRef.current, {
          scale: 3,
          backgroundColor: '#ffffff',
        });
        
        const link = document.createElement('a');
        const fileName = type === 'DETECTION BILL PROFORMA' 
          ? `D_Bill_Performa_${fileData?.referenceNumber || 'Case'}.jpg`
          : `${type.replace(/\s+/g, '_')}_${fileData?.referenceNumber || 'Case'}.jpg`;
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success(`Successfully downloaded ${fileName}!`, { id: 'downloadJpeg' });
      } catch (err) {
        console.error('Error downloading:', err);
        toast.error('Failed to download image.', { id: 'downloadJpeg' });
      }
    } else {
        toast.error('Template is not ready for download.');
    }
  };

  const uploadToDrive = async (type: string, fileData: any) => {
    let templateRef = null;
    if (type === 'DETECTION BILL PROFORMA') templateRef = printRefDetectionBill;
    else if (type === 'NOTICE') templateRef = printRefNotice;
    else if (type === 'FIR Request') templateRef = printRefFIR;
    else if (type === 'FIR Urdu') templateRef = printRefFIRUrdu;
    else if (type === 'Detection Register') templateRef = printRefRegister;

    if (templateRef && templateRef.current) {
      try {
        toast.loading('Uploading to My Assistant folder...', { id: 'uploadDrive' });
        
        let domToJpeg;
        try {
          const mod = await import('modern-screenshot');
          domToJpeg = mod.domToJpeg;
        } catch {
          throw new Error('Image generation library not available.');
        }

        const dataUrl = await domToJpeg(templateRef.current, {
          scale: 3,
          backgroundColor: '#ffffff',
        });
        
        const { ref: storageRef, uploadString, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('../firebase');
        
        const fileName = type === 'DETECTION BILL PROFORMA' 
          ? `D_Bill_Performa_${fileData?.referenceNumber || 'Case'}.jpg`
          : `${type.replace(/\s+/g, '_')}_${fileData?.referenceNumber || 'Case'}.jpg`;
        
        const fileRef = storageRef(storage, `My Assistant/${fileName}`);
        
        await uploadString(fileRef, dataUrl, 'data_url');
        await getDownloadURL(fileRef);
        
        toast.success(`Successfully saved ${fileName} to Drive!`, { id: 'uploadDrive' });
      } catch (err: any) {
        console.error('Error uploading:', err);
        const errMsg = err?.message || String(err);
        if (errMsg.includes('retry-limit-exceeded')) {
           toast.error('Firebase Storage is not initialized or rules are blocking access. Go to Firebase Console -> Storage and click Get Started.', { id: 'uploadDrive', duration: 10000 });
        } else {
           toast.error('Failed to upload. Make sure you have permission to write to storage.', { id: 'uploadDrive' });
        }
      }
    } else {
        toast.error('Template is not ready for upload.');
    }
  };

  const formatDF = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    const str = val.toString();
    if (str.toUpperCase() === 'DF') {
      return <span className="text-red-700 font-bold">Est. Def.</span>;
    }
    return val;
  };

  useEffect(() => {
    const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const casesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DetectionCase));
      setCases(casesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cases');
    });

    return () => unsubscribe();
  }, []);

  const filteredCases = cases.filter(c => 
    (c.name || c.billData.consumerName).toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.billData.referenceNumber.includes(searchTerm) ||
    c.discrepancy.some(d => d.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCase = async (id: string) => {
    setIsDeleting(true);
    try {
      const caseDoc = await getDoc(doc(db, 'cases', id));
      if (caseDoc.exists()) {
        const caseData = caseDoc.data();
        const batch = writeBatch(db);
        batch.set(doc(db, 'trash', id), {
          ...caseData,
          deletedAt: new Date().toISOString()
        });
        batch.delete(doc(db, 'cases', id));
        await batch.commit();
      }
      setCaseToDelete(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'cases');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 px-2 sm:px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 dark:text-slate-100">Past Detection Cases</h1>
          <p className="text-sm text-neutral-500 dark:text-slate-400">View and manage all recorded theft detections</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button 
            onClick={() => navigate('/quick-edit')}
            className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 text-neutral-700 dark:text-slate-300 px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold shadow-sm hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" /> Quick Editor
          </button>
          <button className="flex-1 sm:flex-none bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 text-neutral-700 dark:text-slate-300 px-3 sm:px-4 py-2 sm:py-3 rounded-xl font-bold shadow-sm hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2 text-sm">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5" /> Filter
          </button>
          <button className="w-full sm:w-auto bg-neutral-900 dark:bg-indigo-600 text-white px-4 py-2 sm:py-3 rounded-xl font-bold shadow-sm hover:bg-neutral-800 dark:hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 text-sm shadow-indigo-600/10">
            <Download className="w-4 h-4 sm:w-5 sm:h-5" /> Export All
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-neutral-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Reference Number, Consumer Name, or Date..."
          className="w-full bg-white dark:bg-slate-900 border border-neutral-100 dark:border-slate-800 rounded-2xl sm:rounded-3xl py-3 sm:py-5 pl-12 sm:pl-16 pr-4 sm:pr-6 text-sm sm:text-base text-neutral-900 dark:text-slate-100 shadow-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
        />
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-neutral-500">Loading cases from database...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 dark:border-slate-800">
            <FileText className="w-12 h-12 text-neutral-200 dark:text-slate-800 mx-auto mb-4" />
            <p className="text-neutral-500 dark:text-slate-500">No matching cases found.</p>
          </div>
        ) : (
          filteredCases.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedCase(item)}
              className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-500 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-base sm:text-lg font-bold text-neutral-900 dark:text-slate-100 truncate">{item.billData.consumerName}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                        item.firNumber ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                      )}>
                        {item.firNumber ? 'Completed' : 'Pending FIR'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-neutral-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {item.billData.referenceNumber}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {format(new Date(item.createdAt), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {(Array.isArray(item.discrepancy) ? item.discrepancy : []).slice(0, 2).join(', ')}{(Array.isArray(item.discrepancy) ? item.discrepancy.length : 0) > 2 ? '...' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 self-end md:self-auto">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCaseExcel(item);
                    }}
                    className={cn(
                      "p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all",
                      copiedId === item.id 
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
                        : "bg-neutral-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-neutral-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                    )}
                    title="Copy Data for Excel/Sheets"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Copy className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/quick-edit', { state: { case: item } });
                    }}
                    className="p-2 sm:p-3 bg-neutral-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-neutral-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl sm:rounded-2xl transition-all"
                    title="Edit Case"
                  >
                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button className="p-2 sm:p-3 bg-neutral-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-neutral-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl sm:rounded-2xl transition-all">
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCaseToDelete(item.id);
                    }}
                    className="p-2 sm:p-3 bg-neutral-50 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 text-neutral-400 dark:text-slate-500 hover:text-white rounded-xl sm:rounded-2xl transition-all"
                    title="Delete Case"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button className="p-2 sm:p-3 bg-neutral-50 dark:bg-slate-800 hover:bg-neutral-100 dark:hover:bg-slate-700 text-neutral-400 dark:text-slate-500 hover:text-neutral-900 dark:hover:text-slate-100 rounded-xl sm:rounded-2xl transition-all">
                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {caseToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Delete Case?</h3>
                <p className="text-neutral-500 dark:text-slate-400 mt-2">Are you sure you want to delete this case? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCaseToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-700 dark:text-slate-300 bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteCase(caseToDelete)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="text-center py-8">
        <button className="text-neutral-500 font-bold hover:text-indigo-600 transition-colors">
          Load More Cases
        </button>
      </div>

      {/* Case Details Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
          >
              <div className="p-6 border-b border-neutral-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Case Details</h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleCopyCaseExcel(selectedCase)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                      copiedId === selectedCase.id
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    )}
                  >
                    {copiedId === selectedCase.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === selectedCase.id ? 'Copied!' : 'Copy for Excel'}
                  </button>
                  <button 
                    onClick={() => navigate('/quick-edit', { state: { case: selectedCase } })}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Template
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCase(null)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-neutral-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Header Info */}
              <div className="flex items-start gap-6">
                <div className="relative group/case-photo">
                  <img 
                    src={selectedCase.photoUrl} 
                    alt="Detection" 
                    className="w-32 h-32 rounded-2xl object-cover border-4 border-neutral-50 dark:border-slate-800 shadow-sm"
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement('a');
                      link.href = selectedCase.photoUrl;
                      link.download = `evidence_${selectedCase.billData.referenceNumber || 'case'}.jpeg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="absolute top-2 right-2 bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-neutral-900 dark:text-slate-100 p-1.5 rounded-lg shadow-lg opacity-0 group-hover/case-photo:opacity-100 transition-all"
                    title="Download Photo"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-slate-100">{selectedCase.name || selectedCase.billData.consumerName}</h3>
                  <p className="text-neutral-500 dark:text-slate-400 font-mono">{selectedCase.billData.referenceNumber}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      selectedCase.firNumber ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                    )}>
                      {selectedCase.firNumber ? `FIR: ${selectedCase.firNumber}` : 'Pending FIR'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Consumer Information</h4>
                  <div className="space-y-3">
                    <DetailItem icon={MapPin} label="Address : -" value={selectedCase.address || selectedCase.billData.address} />
                    <DetailItem icon={Hash} label="Customer ID : -" value={selectedCase.customerId || selectedCase.billData.customerId || 'N/A'} />
                    <DetailItem icon={Zap} label="Sanction Load : -" value={selectedCase.sanctionLoad || `${selectedCase.billData.sanctionedLoad} kW`} />
                    <DetailItem icon={Activity} label="Tariff : -" value={selectedCase.tariff || 'N/A'} />
                    <DetailItem icon={User} label="Mobile No. : -" value={selectedCase.mobileNo || 'N/A'} />
                    <DetailItem icon={FileText} label="E Mail : -" value={selectedCase.email || 'N/A'} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Detection Details</h4>
                    <a 
                      href="https://docs.google.com/forms/d/e/1FAIpQLSfRahSaD9D-DeGCldxwYg_f2IPIheuxXpheTDXx5iBtPkTFGg/viewform?usp=header" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Form
                    </a>
                  </div>
                  <div className="space-y-3">
                    <DetailItem icon={Users} label="Checked By : -" value={Array.isArray(selectedCase.checkedBy) ? selectedCase.checkedBy.join(', ') : selectedCase.checkedBy} />
                    <DetailItem icon={Activity} label="Type : -" value={selectedCase.meterType} />
                    <DetailItem icon={Home} label="Capacity : -" value={selectedCase.capacity} />
                    <DetailItem 
                      icon={Activity} 
                      label="Meter Status : -" 
                      value={formatDF(selectedCase.meterStatus || selectedCase.billData?.meterStatus || 'N/A')} 
                      className={cn(
                        (selectedCase.meterStatus?.toUpperCase()?.includes('REPLACED') || 
                         selectedCase.billData?.meterStatus?.toUpperCase()?.includes('REPLACED') ||
                         selectedCase.meterStatus?.toUpperCase() === 'DF' ||
                         selectedCase.billData?.meterStatus?.toUpperCase() === 'DF') && 
                        "text-red-600 font-bold"
                      )}
                    />
                    <DetailItem icon={Zap} label="Present Reading : -" value={selectedCase.presentReading} />
                    <DetailItem icon={Zap} label="Present Reading at Site : -" value={selectedCase.presentReadingAtSite || 'N/A'} />
                    <DetailItem icon={Hash} label="Meter No. : -" value={selectedCase.meterNumber || 'N/A'} />
                    <DetailItem icon={ShieldAlert} label="Make : -" value={selectedCase.meterMake} />
                    <DetailItem icon={Activity} label="No of AC : -" value={selectedCase.noOfAC} />
                    <DetailItem icon={Activity} label="AC Type : -" value={selectedCase.acType} />
                    <DetailItem icon={Activity} label="AC Period From : -" value={selectedCase.acPeriodFrom || 'N/A'} />
                    <DetailItem icon={Activity} label="AC Period To : -" value={selectedCase.acPeriodTo || 'N/A'} />
                    <DetailItem icon={Activity} label="AC Period Months : -" value={selectedCase.acPeriodMonths || 'N/A'} />
                    <DetailItem icon={Activity} label="Units of AC Period : -" value={selectedCase.unitsOfAcPeriod || 'N/A'} />
                    <DetailItem icon={MapPin} label="Police Station : -" value={(selectedCase.firNo && !selectedCase.registeredFirNo) ? (
                      <>
                        {selectedCase.policeStation || 'N/A'} <span className="text-red-100 bg-red-600 px-1 rounded ml-1 animate-pulse">(PENDING FIR)</span>
                      </>
                    ) : (selectedCase.policeStation || 'N/A')} />
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Additional Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Date of Checking : -</p>
                    <p className="text-sm font-medium text-neutral-900">{selectedCase.dateOfChecking}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Discrepancy : -</p>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(selectedCase.discrepancy) ? selectedCase.discrepancy : []).map((d, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Detection Date : -</p>
                    <p className="text-sm font-medium text-neutral-900">{format(new Date(selectedCase.createdAt), 'MMMM d, yyyy HH:mm')}</p>
                  </div>
                </div>
                {selectedCase.remarks && (
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Remarks : -</p>
                    <p className="text-sm text-indigo-600 font-bold leading-relaxed">{selectedCase.remarks}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest md:col-span-2">Generate Documents</h4>
                {[
                  { name: 'DETECTION BILL PROFORMA', icon: FileText },
                  { name: 'NOTICE', icon: Activity },
                  { name: 'FIR Request', icon: ShieldAlert },
                  { name: 'FIR Urdu', icon: ShieldAlert },
                  { name: 'Detection Register', icon: FileText },
                ].map((doc) => (
                  <div 
                    key={doc.name}
                    className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <doc.icon className="w-5 h-5 text-neutral-400 group-hover:text-indigo-500" />
                      <span className="text-sm font-bold text-neutral-700">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setPreviewDoc({ 
                          type: doc.name, 
                          data: {
                            ...selectedCase,
                            referenceNumber: selectedCase.billData.referenceNumber,
                            dateOfChecking: selectedCase.dateOfChecking,
                            monthWiseUnits: selectedCase.billData.monthWiseUnits,
                            billingMonth: selectedCase.billData.billingMonth,
                            difference: selectedCase.billData.difference,
                            previousReading: selectedCase.billData.previousReading,
                            presentReading: selectedCase.billData.presentReading,
                            currentBill: selectedCase.billData.currentBill,
                            deferredAmount: selectedCase.billData.deferredAmount,
                            meterNoOnBill: selectedCase.billData.meterNoOnBill,
                            photoUrl: selectedCase.photoUrl,
                            presentOccupier: selectedCase.presentOccupier,
                            presentOccupierUrdu: selectedCase.presentOccupierUrdu,
                          }
                        })}
                        className="p-2 hover:bg-indigo-100 text-neutral-400 hover:text-indigo-600 rounded-xl transition-all"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => triggerPrint(doc.name)}
                        className="p-2 hover:bg-indigo-100 text-neutral-400 hover:text-indigo-600 rounded-xl transition-all"
                        title="Print"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button 
                  onClick={() => triggerPrint('DETECTION BILL PROFORMA')}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" /> Download PDF Report
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col border border-transparent dark:border-slate-800"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 z-10">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Document Preview: {previewDoc.type}</h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => downloadAsJpeg(previewDoc.type, previewDoc.data)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20"
                  >
                    <Download className="w-4 h-4" /> Download JPG
                  </button>
                  <button 
                    onClick={() => uploadToDrive(previewDoc.type, previewDoc.data)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20"
                  >
                    <Save className="w-4 h-4" /> Drive Sync
                  </button>
                  <button 
                    onClick={() => triggerPrint(previewDoc.type)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    <Printer className="w-4 h-4" /> Print / Download
                  </button>
                  <button 
                    onClick={() => setPreviewDoc(null)}
                    className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-neutral-400 dark:text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 bg-neutral-100 dark:bg-slate-950">
                <div className="bg-white dark:bg-white shadow-xl mx-auto transform origin-top scale-[0.85] md:scale-100">
                  <ProformaTemplates 
                    type={previewDoc.type as any}
                    data={previewDoc.data}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Print Templates */}
      <div className="fixed top-0 left-[-9999px]">
        {selectedCase && (
          <>
            {[
              { type: 'DETECTION BILL PROFORMA', ref: printRefDetectionBill },
              { type: 'NOTICE', ref: printRefNotice },
              { type: 'FIR Request', ref: printRefFIR },
              { type: 'FIR Urdu', ref: printRefFIRUrdu },
              { type: 'Detection Register', ref: printRefRegister },
            ].map(({ type, ref }) => (
              <ProformaTemplates 
                key={type}
                ref={ref}
                type={type as any}
                data={{
                  ...selectedCase,
                  referenceNumber: selectedCase.billData.referenceNumber,
                  dateOfChecking: selectedCase.dateOfChecking,
                  monthWiseUnits: selectedCase.billData.monthWiseUnits,
                  billingMonth: selectedCase.billData.billingMonth,
                  difference: selectedCase.billData.difference,
                  previousReading: selectedCase.billData.previousReading,
                  presentReading: selectedCase.billData.presentReading,
                  currentBill: selectedCase.billData.currentBill,
                  deferredAmount: selectedCase.billData.deferredAmount,
                  meterNoOnBill: selectedCase.billData.meterNoOnBill,
                  photoUrl: selectedCase.photoUrl,
                  presentOccupier: selectedCase.presentOccupier,
                  presentOccupierUrdu: selectedCase.presentOccupierUrdu,
                }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, className }: { icon: any, label: string, value: React.ReactNode, className?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-neutral-50 dark:bg-slate-800 p-2 rounded-lg text-black dark:text-slate-100">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-black dark:text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className={cn("text-sm font-bold text-black dark:text-slate-100 border-b border-neutral-200 dark:border-slate-800 inline-block whitespace-nowrap", className)}>{value}</p>
      </div>
    </div>
  );
}
