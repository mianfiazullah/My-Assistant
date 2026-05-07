import { safeStringify } from "../lib/safeStringify";
import { safeFetchJson } from "../lib/safeFetch";
import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, FileText, Download, TrendingUp, Users, AlertTriangle, ArrowRight, Loader2, Eye, X, Printer, Edit2, Save, Zap, ShieldAlert, ClipboardList, Bell, Trash2, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DetectionCase } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ProformaTemplates } from '../components/ProformaTemplates';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentCases, setRecentCases] = useState<DetectionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{ type: string; data: any; isEditing?: boolean } | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState(() => {
    const saved = localStorage.getItem('lesco_dashboard_ref');
    return (saved && saved !== 'undefined' && saved !== 'null') ? saved : '';
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    localStorage.setItem('lesco_dashboard_ref', refNumber);
  }, [refNumber]);
  const [standaloneBill, setStandaloneBill] = useState<any>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState([
    { label: 'Total Cases', value: '0', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'This Month', value: '0', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending FIRs', value: '0', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Active Users', value: '1', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ]);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear();
  const acMin = `${currentYear}-04`;
  const acMax = `${currentYear}-09`;
  const acMaxEffective = thisMonth < acMax ? thisMonth : acMax;

  const printRef = useRef<HTMLDivElement>(null);

  const printTemplate = () => {
    if (!printRef.current) return;
    const content = printRef.current;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Popup was blocked. Please allow popups for this site to print templates.');
      return;
    }

    setError('');
    printWindow.document.write('<html><head><title>Print Template</title>');
    // Copy all styles from the current document
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach(style => {
      printWindow.document.write(style.outerHTML);
    });
    printWindow.document.write(`
      <style>
        @media print {
          body { margin: 0; padding: 0; }
          .print-container { width: 100%; height: 100%; }
        }
      </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write('<div class="print-container">');
    printWindow.document.write(content.innerHTML);
    printWindow.document.write('</div>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  useEffect(() => {
    const q = query(collection(db, 'cases'), orderBy('createdAt', 'desc'), limit(5));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DetectionCase));
      setRecentCases(cases);
      
      // Update stats (mock logic for demo, in real app use aggregation or separate collection)
      setStats(prev => [
        { ...prev[0], value: snapshot.size.toString() },
        { ...prev[1], value: cases.filter(c => new Date(c.createdAt).getMonth() === new Date().getMonth()).length.toString() },
        { ...prev[2], value: cases.filter(c => !c.firNumber).length.toString() },
        { ...prev[3], value: '1' },
      ]);
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cases');
    });

    return () => unsubscribe();
  }, []);

  const handleFetchBill = async (isStandalone = false) => {
    const cleanRef = (isStandalone ? refNumber : refNumber).replace(/[^0-9]/g, '');
    if (cleanRef.length !== 14) {
      setFetchError('Reference Number must be 14 digits.');
      return;
    }

    setIsFetching(true);
    setFetchError('');
    if (isStandalone) setStandaloneBill(null);

    try {
      const response = await fetch('/api/fetch-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({ referenceNumber: cleanRef }),
      });
      
      const data = await safeFetchJson(response);
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch bill data');
      }

      if (isStandalone) {
        setStandaloneBill(data);
      } else if (previewDoc) {
        setPreviewDoc({
          ...previewDoc,
          data: {
            ...previewDoc.data,
            name: data.consumerName,
            address: data.address,
            referenceNumber: data.referenceNumber,
            customerId: data.customerId || '',
            tariff: data.tariff || data.connectionType || '',
            sanctionLoad: data.sanctionedLoad || '',
            billingMonth: data.billingMonth || '',
            presentReading: data.presentReading || '',
            previousReading: data.previousReading || '',
          }
        });
      }
      setFetchError('');
    } catch (err: any) {
      setFetchError(err.message || 'Could not fetch bill data.');
    } finally {
      setIsFetching(false);
    }
  };

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
      setError('Failed to delete case.');
      handleFirestoreError(err, OperationType.DELETE, 'cases');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl sm:text-2xl sm:text-xl sm:text-2xl md:text-3xl md:text-4xl font-display font-bold text-slate-900 mb-2">
            Welcome back, <span className="text-brand-primary">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 font-medium"></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/quick-edit"
            className="btn-secondary group flex-1 sm:flex-none justify-center"
          >
            <Edit2 className="w-5 h-5" />
            Quick Editor
          </Link>
          <button
            onClick={() => {
              localStorage.removeItem('lesco_new_case_step');
              localStorage.removeItem('lesco_new_case_photo');
              localStorage.removeItem('lesco_new_case_ref');
              localStorage.removeItem('lesco_detection_data');
              localStorage.removeItem('lesco_bill_data');
              navigate('/new-case');
            }}
            className="btn-primary group flex-1 sm:flex-none justify-center"
          >
            <PlusCircle className="w-5 h-5 transition-transform group-hover:rotate-90" />
            New Detection Case
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="bento-grid px-2">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 rounded-3xl group hover:scale-[1.02] transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl transition-colors duration-300", stat.bg, "group-hover:bg-brand-primary group-hover:text-white")}>
                <stat.icon className={cn("w-6 h-6", stat.color, "group-hover:text-white")} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
            </div>
            <p className="text-sm font-bold text-black mb-1">{stat.label}</p>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-black">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Cases */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-display font-bold text-slate-900">Recent Cases</h2>
            <Link to="/cases" className="text-sm font-bold text-brand-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="glass-card rounded-[2rem] overflow-hidden">
            {/* Desktop Table - Now scrollable on mobile too for "desktop view" */}
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/50 text-black text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="px-8 py-5">Ref Number</th>
                    <th className="px-8 py-5">Consumer</th>
                    <th className="px-8 py-5">Date</th>
                    <th className="px-8 py-5">Status</th>
                    <th className="px-8 py-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <Loader2 className="w-10 h-10 animate-spin text-brand-primary mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading cases...</p>
                      </td>
                    </tr>
                  ) : recentCases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center">
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No cases recorded yet.</p>
                      </td>
                    </tr>
                  ) : (
                    recentCases.map((item, i) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-5 font-mono text-xs font-bold text-black">{item.billData.referenceNumber}</td>
                        <td className="px-8 py-5">
                          <p className="text-sm font-bold text-black">{item.billData.consumerName}</p>
                          <p className="text-[10px] text-black font-medium truncate max-w-[200px]">{item.billData.address}</p>
                        </td>
                        <td className="px-8 py-5 text-sm font-bold text-black">{format(new Date(item.createdAt), 'MMM d, yyyy')}</td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            item.firNumber ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {item.firNumber ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => {
                                setError('');
                                setPreviewDoc({ 
                                  type: 'DETECTION BILL PROFORMA', 
                                  isEditing: true,
                                  data: {
                                    ...item,
                                    name: item.name || item.billData.consumerName,
                                    address: item.address || item.billData.address,
                                    referenceNumber: item.billData.referenceNumber,
                                    customerId: item.billData.customerId,
                                    tariff: item.billData.tariff,
                                    employeeName: user?.name || '',
                                    employeeDesignation: 'SDO',
                                  }
                                });
                              }}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white transition-all duration-300"
                              title="View Templates"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white transition-all duration-300">
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setCaseToDelete(item.id)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all duration-300"
                              title="Delete Case"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          {/* Mobile Card List (Optional, but kept for better mobile experience if they prefer it) */}
          <div className="md:hidden divide-y divide-slate-50">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-brand-primary mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading cases...</p>
              </div>
            ) : recentCases.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No cases recorded yet.</p>
              </div>
            ) : (
              recentCases.map((item) => (
                <div key={item.id} className="p-6 space-y-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-base font-bold text-slate-900">{item.billData.consumerName}</p>
                      <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">{item.billData.referenceNumber}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                      item.firNumber ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {item.firNumber ? 'Done' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{format(new Date(item.createdAt), 'MMM d, yyyy')}</p>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          setError('');
                          setPreviewDoc({ 
                            type: 'DETECTION BILL PROFORMA', 
                            isEditing: true,
                            data: {
                              ...item,
                              name: item.name || item.billData.consumerName,
                              address: item.address || item.billData.address,
                              referenceNumber: item.billData.referenceNumber,
                              customerId: item.billData.customerId,
                              tariff: item.billData.tariff,
                              employeeName: user?.name || '',
                              employeeDesignation: 'SDO',
                            }
                          });
                        }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white transition-all duration-300"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white transition-all duration-300">
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setCaseToDelete(item.id)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all duration-300"
                        title="Delete Case"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions / Templates */}
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2rem]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-slate-900">Notice Template</h2>
              <span className="px-3 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full uppercase tracking-wider">Official</span>
            </div>
            
            <div className="relative group mb-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white p-6 rounded-2xl border border-slate-100 leading-none flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-900">LESCO Official Notice</h3>
                    <p className="text-xs text-slate-500 mt-1">Section 39-A Electricity Act</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 text-left">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <span>Direct Hooking Detection</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <span>Meter Tampering Notice</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <span>Illegal Abstraction Warning</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setPreviewDoc({ 
                      type: 'NOTICE', 
                      isEditing: true,
                      data: {
                        name: "Sample Consumer",
                        address: "123 Sample Street, Lahore",
                        referenceNumber: "11751-0000000000",
                        customerId: "1234567",
                        tariff: "A1-R",
                        sanctionLoad: "5",
                        connectedLoad: "7.5",
                        loadFactor: "0.8",
                        dateOfChecking: format(new Date(), 'yyyy-MM-dd'),
                        checkedBy: user?.name || "Checking Officer",
                        meterType: "Static",
                        capacity: "10-40A",
                        meterMake: "Microtech",
                        meterNumber: "MT-99999",
                        presentReading: "45678",
                        presentReadingAtSite: "45678",
                        discrepancy: ["Direct Hooking", "Meter Tampering"],
                        remarks: "Sample remarks for template preview.",
                        employeeName: user?.name || "Officer Name",
                        employeeDesignation: "SDO",
                        witnesses: ["Witness 1", "Witness 2"]
                      }
                    })}
                    className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all"
                  >
                    <Edit2 className="w-4 h-4" /> Edit & Fill
                  </button>
                  <button 
                    onClick={() => setPreviewDoc({ 
                      type: 'NOTICE', 
                      data: {
                        name: "Sample Consumer",
                        address: "123 Sample Street, Lahore",
                        referenceNumber: "11751-0000000000",
                        customerId: "1234567",
                        tariff: "A1-R",
                        sanctionLoad: "5",
                        connectedLoad: "7.5",
                        loadFactor: "0.8",
                        dateOfChecking: format(new Date(), 'yyyy-MM-dd'),
                        checkedBy: user?.name || "Checking Officer",
                        meterType: "Static",
                        capacity: "10-40A",
                        meterMake: "Microtech",
                        meterNumber: "MT-99999",
                        presentReading: "45678",
                        presentReadingAtSite: "45678",
                        discrepancy: ["Direct Hooking", "Meter Tampering"],
                        remarks: "Sample remarks for template preview.",
                        employeeName: user?.name || "Officer Name",
                        employeeDesignation: "SDO",
                        witnesses: ["Witness 1", "Witness 2"]
                      }
                    })}
                    className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-left">Other Templates</p>
              {[
                { name: 'Detection Bill Proforma', type: 'DETECTION BILL PROFORMA', icon: FileText },
                { name: 'FIR Template', type: 'FIR Request', icon: ShieldAlert },
                { name: 'Detection Bill Register', type: 'Detection Register', icon: ClipboardList },
              ].map((template) => (
                <button
                  key={template.name}
                  onClick={() => setPreviewDoc({ 
                    type: template.type, 
                    data: {
                      name: "Sample Consumer",
                      address: "123 Sample Street, Lahore",
                      referenceNumber: "11751-0000000000",
                      customerId: "1234567",
                      tariff: "A1-R",
                      sanctionLoad: "5",
                      connectedLoad: "7.5",
                      loadFactor: "0.8",
                      dateOfChecking: format(new Date(), 'yyyy-MM-dd'),
                      checkedBy: user?.name || "Checking Officer",
                      meterType: "Static",
                      capacity: "10-40A",
                      meterMake: "Microtech",
                      meterNumber: "MT-99999",
                      presentReading: "45678",
                      presentReadingAtSite: "45678",
                      discrepancy: ["Direct Hooking", "Meter Tampering"],
                      remarks: "Sample remarks for template preview.",
                      employeeName: user?.name || "Officer Name",
                      employeeDesignation: "SDO",
                      witnesses: ["Witness 1", "Witness 2"]
                    }
                  })}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <template.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">{template.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-600/20 relative overflow-hidden group">
            <div className="absolute top-[-20%] right-[-20%] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500" />
            <h3 className="text-base sm:text-lg font-bold mb-2">Need Help?</h3>
            <p className="text-indigo-100 text-sm mb-4 leading-relaxed">
              If you encounter any issues with bill fetching or template generation, contact the IT support team or use the official portal.
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors">
                Contact Support
              </button>
              <a 
                href="https://www.lesco.gov.pk:36269/Modules/CustomerBillN/CheckBill.asp" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                LESCO Portal
              </a>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Preview/Edit Modal */}
      <AnimatePresence>
        {caseToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Delete Case?</h3>
                <p className="text-neutral-500 mt-2">Are you sure you want to delete this case? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setCaseToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors"
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
        {previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "bg-white w-full rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col transition-all duration-500",
                previewDoc.isEditing ? "max-w-6xl" : "max-w-4xl"
              )}
            >
            <div className="p-4 md:p-6 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between bg-white z-10 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-lg md:text-xl font-bold text-neutral-900 truncate max-w-[250px] sm:max-w-none">
                  {previewDoc.isEditing ? 'Edit' : 'Preview'}: {previewDoc.type}
                </h2>
                <button 
                  onClick={() => setPreviewDoc({ ...previewDoc, isEditing: !previewDoc.isEditing })}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 w-fit",
                    previewDoc.isEditing ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  {previewDoc.isEditing ? <Save className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                  {previewDoc.isEditing ? 'Finish Editing' : 'Edit Data'}
                </button>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button 
                  onClick={printTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 text-sm"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button 
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-neutral-400" />
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-4 md:mx-6 mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2 text-xs text-indigo-600 font-medium">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

              <div className="flex-1 overflow-y-auto flex flex-col md:flex-row bg-neutral-100">
                {/* Editor Sidebar */}
                {previewDoc.isEditing && (
                  <div className="w-full md:w-80 lg:w-96 bg-white border-b md:border-b-0 md:border-r border-neutral-200 p-4 md:p-6 space-y-8 shrink-0">
                    {/* Bill Fetcher Section */}
                    <div className="space-y-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Fetch Consumer Bill
                      </h3>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={refNumber}
                          onChange={(e) => setRefNumber(e.target.value)}
                          placeholder="14-digit Ref No."
                          className="flex-1 bg-white border border-indigo-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleFetchBill()}
                          disabled={isFetching}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-200 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                        >
                          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                        </button>
                      </div>
                      {fetchError && <p className="text-[10px] text-indigo-600 font-medium">{fetchError}</p>}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400">Issue?</span>
                        <a 
                          href="https://www.lesco.gov.pk:36269/Modules/CustomerBillN/CheckBill.asp" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Official Portal (Fallback)
                        </a>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-xs font-bold text-black uppercase tracking-widest">Consumer & Detection Details</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {/* Consumer Info */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-black uppercase">Consumer Info</p>
                          {[
                            { key: 'name', label: 'Consumer Name' },
                            { key: 'address', label: 'Address' },
                            { key: 'referenceNumber', label: 'Ref Number' },
                            { key: 'billingMonth', label: 'Bill Month' },
                            { key: 'customerId', label: 'Customer ID' },
                            { key: 'tariff', label: 'Tariff' },
                            { key: 'sanctionLoad', label: 'Sanction Load' },
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-[10px] font-bold text-black uppercase mb-1">{field.label}</label>
                              <input
                                type="text"
                                value={previewDoc.data[field.key] || ''}
                                onChange={(e) => setPreviewDoc({
                                  ...previewDoc,
                                  data: { ...previewDoc.data, [field.key]: e.target.value }
                                })}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-black transition-all font-bold text-black"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Employee Info */}
                        <div className="space-y-3 pt-4 border-t border-neutral-100">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase">Employee Info</p>
                          {[
                            { key: 'employeeName', label: 'Employee Name' },
                            { key: 'employeeDesignation', label: 'Designation' },
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-[10px] font-bold text-black uppercase mb-1">{field.label}</label>
                              <input
                                type="text"
                                value={previewDoc.data[field.key] || ''}
                                onChange={(e) => setPreviewDoc({
                                  ...previewDoc,
                                  data: { ...previewDoc.data, [field.key]: e.target.value }
                                })}
                                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-black transition-all font-bold text-black"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Detection Info */}
                        <div className="space-y-3 pt-4 border-t border-neutral-100">
                          <p className="text-[10px] font-bold text-black uppercase">Detection Info</p>
                          {[
                            { key: 'dateOfChecking', label: 'Date of Checking', type: 'date' },
                            { key: 'meterStatus', label: 'Meter Status' },
                            { key: 'checkedBy', label: 'Checked By' },
                            { key: 'meterType', label: 'Meter Type' },
                            { key: 'capacity', label: 'Capacity' },
                            { key: 'meterMake', label: 'Meter Make' },
                            { key: 'meterNumber', label: 'Meter Number' },
                            { key: 'previousReading', label: 'Previous Reading' },
                            { key: 'presentReading', label: 'Present Reading' },
                            { key: 'presentReadingAtSite', label: 'Present Reading at Site' },
                            { 
                              key: 'difference', 
                              label: 'Difference', 
                              readOnly: true,
                              getValue: (data: any) => {
                                const present = parseInt(data.presentReading?.toString().replace(/,/g, '') || '0');
                                const previous = parseInt(data.previousReading?.toString().replace(/,/g, '') || '0');
                                const diff = present - previous;
                                return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
                              }
                            },
                            { key: 'connectedLoad', label: 'Connected Load' },
                            { key: 'loadFactor', label: 'Load Factor' },
                            { key: 'noOfAC', label: 'No of AC' },
                            { key: 'acType', label: 'AC Type' },
                            { key: 'othersAcType', label: 'Specified AC Type' },
                            { key: 'acPeriodFrom', label: 'AC Period From', type: 'month' },
                            { key: 'acPeriodTo', label: 'AC Period To', type: 'month' },
                            { key: 'acPeriodMonths', label: 'AC Period Months', readOnly: true },
                            { key: 'unitsOfAcPeriod', label: 'Units of AC Period' },
                            { key: 'registeredFirNo', label: 'Registered FIR No.' },
                            { 
                              key: 'policeStation', 
                              label: 'Police Station',
                              type: 'select',
                              options: ['Kot Radha Kishan', 'Raiwind', 'Changa Manga', 'Manga Mandi']
                            },
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-[10px] font-bold text-black uppercase mb-1">{field.label}</label>
                              {field.type === 'select' ? (
                                <select
                                  value={previewDoc.data[field.key] || ''}
                                  onChange={(e) => setPreviewDoc({
                                    ...previewDoc,
                                    data: { ...previewDoc.data, [field.key]: e.target.value }
                                  })}
                                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-black transition-all font-bold text-black"
                                >
                                  <option value="">Select...</option>
                                  {field.options?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={field.type || 'text'}
                                  value={field.getValue ? field.getValue(previewDoc.data) : (Array.isArray(previewDoc.data[field.key]) ? previewDoc.data[field.key].join(', ') : (previewDoc.data[field.key] || ''))}
                                  readOnly={field.readOnly}
                                  min={field.key === 'acPeriodFrom' || field.key === 'acPeriodTo' ? acMin : undefined}
                                  max={field.key === 'acPeriodTo' ? acMaxEffective : (field.key === 'acPeriodFrom' ? acMax : (field.type === 'date' ? today : field.type === 'month' ? thisMonth : undefined))}
                                  onChange={(e) => {
                                    if (field.readOnly) return;
                                    const val = e.target.value;
                                    if (field.key === 'acPeriodTo' && val > thisMonth) {
                                      toast.error('AC Period To cannot be later than the current month');
                                      return;
                                    }
                                    
                                    const isCheckedBy = field.key === 'checkedBy';
                                    const processedValue = isCheckedBy 
                                      ? val.split(',').map(s => s.trim()).filter(Boolean)
                                      : val;
                                    
                                    const newData = { 
                                      ...previewDoc.data, 
                                      [field.key]: processedValue 
                                    };

                                    if (field.key === 'noOfAC' && val === '') {
                                      newData.acType = '';
                                      newData.othersAcType = '';
                                    }

                                    if (field.key === 'acPeriodFrom' || field.key === 'acPeriodTo') {
                                      if (val) {
                                        const month = parseInt(val.split('-')[1]);
                                        if (month < 4 || month > 9) {
                                          toast.error('AC Period must be between April and September');
                                          return;
                                        }
                                      }
                                      
                                      if (newData.acPeriodFrom && newData.acPeriodTo) {
                                        const [y1, m1] = newData.acPeriodFrom.split('-').map(Number);
                                        const [y2, m2] = newData.acPeriodTo.split('-').map(Number);
                                        const months = (y2 * 12 + m2) - (y1 * 12 + m1) + 1;
                                        newData.acPeriodMonths = months > 0 ? months.toString() : '0';
                                      } else {
                                        newData.acPeriodMonths = '';
                                      }
                                    }

                                    setPreviewDoc({
                                      ...previewDoc,
                                      data: newData
                                    });
                                  }}
                                  className={cn(
                                    "w-full border border-neutral-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-black transition-all font-bold text-black",
                                    field.readOnly ? "bg-neutral-100 cursor-not-allowed" : "bg-neutral-50",
                                    field.key === 'meterStatus' && previewDoc.data.meterStatus?.toUpperCase()?.includes('REPLACED') && "text-red-600"
                                  )}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Discrepancy */}
                        <div className="pt-4 border-t border-neutral-100">
                          <label className="block text-[10px] font-bold text-black uppercase mb-1">Discrepancy (Comma Separated)</label>
                          <textarea
                            value={(Array.isArray(previewDoc.data.discrepancy) ? previewDoc.data.discrepancy : []).join(', ')}
                            onChange={(e) => setPreviewDoc({
                              ...previewDoc,
                              data: { ...previewDoc.data, discrepancy: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                            })}
                            className="w-full bg-white border border-neutral-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-black transition-all h-20 font-bold text-black"
                          />
                        </div>

                        {/* Witnesses */}
                        <div className="pt-4 border-t border-neutral-100">
                          <label className="block text-[10px] font-bold text-black uppercase mb-1">Witnesses (Comma Separated)</label>
                          <input
                            type="text"
                            value={(Array.isArray(previewDoc.data.witnesses) ? previewDoc.data.witnesses : []).join(', ')}
                            onChange={(e) => setPreviewDoc({
                              ...previewDoc,
                              data: { ...previewDoc.data, witnesses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                            })}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-black transition-all font-bold text-black"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Area */}
                <div className="flex-1 min-w-0 overflow-auto p-4 md:p-8 bg-neutral-100">
                  <div className="bg-white shadow-xl mx-auto w-max">
                    <div ref={printRef}>
                      <ProformaTemplates 
                        type={previewDoc.type as any}
                        data={previewDoc.data}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
