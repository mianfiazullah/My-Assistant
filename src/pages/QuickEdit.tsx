import { safeStringify } from "../lib/safeStringify";
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Save, FileText, Activity, ShieldAlert, Eye, Loader2, CheckCircle, AlertCircle, Hash, User, MapPin, Zap, Home, PlusCircle, X, ZoomIn, ZoomOut, RotateCcw, Scan, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { DetectionCase, BillData } from '../types';
import { ProformaTemplates } from '../components/ProformaTemplates';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { extractBillData } from '../lib/gemini';

export default function QuickEdit() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Load initial state from localStorage if location.state is missing
  const getInitialState = (key: string, defaultValue: any) => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved || saved === 'undefined' || saved === 'null') return defaultValue;
      const trimmed = saved.trim();
      if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '') return defaultValue;
      try {
        return JSON.parse(trimmed);
      } catch (err) {
        console.warn(`QuickEdit parse error for key "${key}":`, err);
        return defaultValue;
      }
    } catch (e) {
      return defaultValue;
    }
  };

  const existingCase = location.state?.case as DetectionCase | undefined;
  
  // Persistence for QuickEdit data
  useEffect(() => {
    if (existingCase) {
      localStorage.setItem('lesco_quick_edit_case', safeStringify(existingCase));
    }
  }, [existingCase]);

  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<'DETECTION BILL PROFORMA' | 'NOTICE' | 'FIR Request' | 'FIR Urdu'>(() => 
    getInitialState('lesco_quick_edit_template', 'DETECTION BILL PROFORMA')
  );
  const [zoom, setZoom] = useState(0.8);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [data, setData] = useState<Partial<DetectionCase & { referenceNumber: string }>>(() => {
    const savedData = getInitialState('lesco_quick_edit_data', null);
    
    // Clear and ignore cached data if we specifically routed to a different case
    if (existingCase) {
      if (!savedData || savedData.id !== existingCase.id) {
        localStorage.removeItem('lesco_quick_edit_data');
        localStorage.setItem('lesco_quick_edit_case', safeStringify(existingCase));
      } else {
        return savedData;
      }
    } else if (savedData) {
      return savedData;
    }

    const baseCase = existingCase || getInitialState('lesco_quick_edit_case', null);
    
    return {
      id: baseCase?.id || '',
      name: baseCase?.name || '',
      address: baseCase?.address || '',
      referenceNumber: baseCase?.billData?.referenceNumber || '',
      customerId: baseCase?.customerId || '',
      tariff: baseCase?.tariff || '',
      sanctionLoad: baseCase?.sanctionLoad || '',
      billingMonth: baseCase?.billData?.billingMonth || '',
      connectedLoad: baseCase?.connectedLoad || '',
      loadFactor: baseCase?.loadFactor || '',
      dateOfChecking: baseCase?.dateOfChecking || '',
      checkedBy: baseCase?.checkedBy || [],
      presentReading: baseCase?.presentReading || '',
      previousReading: baseCase?.previousReading || '',
      meterNumber: baseCase?.meterNumber || '',
      meterMake: baseCase?.meterMake || '',
      meterType: baseCase?.meterType || '',
      capacity: baseCase?.capacity || '',
      meterStatus: baseCase?.meterStatus || baseCase?.billData?.meterStatus || '',
      noticeNo: baseCase?.noticeNo || '',
      noticeDated: baseCase?.noticeDated || '',
      firNo: baseCase?.firNo || '',
      firDated: baseCase?.firDated || '',
      registeredFirNo: baseCase?.registeredFirNo || '',
      registeredFirDated: baseCase?.registeredFirDated || '',
      policeStation: baseCase?.policeStation || '',
      discrepancy: baseCase?.discrepancy || [],
      noOfAC: baseCase?.noOfAC || '',
      splitAcCount: baseCase?.splitAcCount || '',
      windowAcCount: baseCase?.windowAcCount || '',
      acType: baseCase?.acType || '',
      detectionPeriodFrom: baseCase?.detectionPeriodFrom || '',
      detectionPeriodTo: baseCase?.detectionPeriodTo || '',
      detectionPeriodMonths: baseCase?.detectionPeriodMonths || '',
      acPeriodFrom: baseCase?.acPeriodFrom || '',
      acPeriodTo: baseCase?.acPeriodTo || '',
      acPeriodMonths: baseCase?.acPeriodMonths || '',
      unitsOfAcPeriod: baseCase?.unitsOfAcPeriod || '',
      unitsAssessed: baseCase?.unitsAssessed || '',
      unitsAlreadyCharged: baseCase?.unitsAlreadyCharged || '',
      netUnitsToBeCharged: baseCase?.netUnitsToBeCharged || '',
      meterSlowBy: baseCase?.meterSlowBy || '',
      remarks: baseCase?.remarks || '',
      employeeName: baseCase?.employeeName || user?.name || '',
      employeeDesignation: baseCase?.employeeDesignation || 'Line Superintendent',
      witnesses: baseCase?.witnesses || ['', ''],
      photoUrl: baseCase?.photoUrl || '',
      presentOccupier: baseCase?.presentOccupier || '',
      presentOccupierUrdu: baseCase?.presentOccupierUrdu || '',
      billData: baseCase?.billData,
    };
  });

  useEffect(() => {
    localStorage.setItem('lesco_quick_edit_data', safeStringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('lesco_quick_edit_template', safeStringify(activeTemplate));
  }, [activeTemplate]);

  const printRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const acMin = `${currentYear}-04`;
  const acMax = `${currentYear}-09`;
  const acMaxEffective = thisMonth < acMax ? thisMonth : acMax;

  const handleInputChange = (field: keyof (DetectionCase & { referenceNumber: string }), value: any) => {
    const newData = { ...data, [field]: value };
    
    const isSlownessActive = newData.discrepancy?.includes('Meter Slow By');
    const isAcField = ['noOfAC', 'splitAcCount', 'windowAcCount', 'acType', 'othersAcType', 'acPeriodFrom', 'acPeriodTo', 'acPeriodMonths', 'unitsOfAcPeriod'].includes(field);

    if (isSlownessActive && isAcField) return;

    if (field === 'acPeriodFrom' || field === 'acPeriodTo') {
      if (value) {
        const month = parseInt(value.split('-')[1]);
        if (month < 4 || month > 9) {
          toast.error('AC Period must be between April and September');
          return;
        }
        if (field === 'acPeriodTo' && value > thisMonth) {
          toast.error('AC Period To cannot be later than the current month');
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

    if (field === 'unitsAssessed' || field === 'unitsAlreadyCharged' || field === 'meterSlowBy' || field === 'discrepancy') {
      let assessed = parseInt(newData.unitsAssessed?.toString() || '0') || 0;
      const charged = parseInt(newData.unitsAlreadyCharged?.toString() || '0') || 0;
      let remark = newData.remarks || '';

      if (newData.discrepancy?.includes('Meter Slow By') && newData.meterSlowBy) {
        const slownessVal = parseInt(newData.meterSlowBy.replace('%', '')) || 0;
        if (slownessVal > 0 && slownessVal < 100 && charged > 0) {
          assessed = Math.round((charged * 100) / (100 - slownessVal));
          newData.unitsAssessed = assessed.toString();
        }

        // Simplified remark as requested: Detection Bill charged As per Slowness....%
        remark = `Detection Bill charged As per Slowness ${newData.meterSlowBy}`;
      } else if (!newData.discrepancy?.includes('Meter Slow By')) {
        const loadRemark = 'Detection Bill charged as Per Connected Load';
        let lines = remark.split('\n').map(l => l.replace(/^\d+-\s*/, '').trim()).filter(Boolean);
        const hasLoad = lines.some(l => l.toLowerCase().includes('detection bill charged as per connected load'));
        
        if (assessed > 0 && !hasLoad) {
          lines.unshift(loadRemark);
        } else if (hasLoad) {
          const loadIdx = lines.findIndex(l => l.toLowerCase().includes('detection bill charged as per connected load'));
          if (loadIdx > 0) {
            const loadLine = lines.splice(loadIdx, 1)[0];
            lines.unshift(loadLine);
          }
        }
        
        remark = lines.length > 1 ? lines.map((l, i) => {
          let line = l;
          if (line.toLowerCase().includes('detection bill charged as per connected load') && !line.endsWith('.')) line += '.';
           return `${i + 1}-${line}`;
        }).join('\n') : lines[0] || '';
      }

      newData.remarks = remark;
      const net = assessed - charged;
      newData.netUnitsToBeCharged = net < 0 ? 'D.BILL IS NOT JUSTIFIED AS PER CONNECTED LOAD' : net.toString();
    }

    setData(newData);
    setIsSaved(false);
  };

  const isMonthAvailableInBill = (monthStr: string) => {
    if (!monthStr || !data.billData) return true;
    const date = new Date(monthStr);
    if (isNaN(date.getTime())) return true;
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[date.getMonth()].toUpperCase();
    const year = date.getFullYear();
    const shortYear = (year % 100).toString().padStart(2, '0');

    // Check billing month
    if (data.billData.billingMonth) {
      const parts = data.billData.billingMonth.toUpperCase().split(/[- ]+/).filter(Boolean);
      if (parts[0]?.startsWith(monthName) && (parts[1] === year.toString() || parts[1] === shortYear)) {
        return true;
      }
    }

    // Check monthWiseUnits
    if (data.billData.monthWiseUnits) {
      return data.billData.monthWiseUnits.some(u => {
        const parts = u.month.toUpperCase().split(/[- ]+/).filter(Boolean);
        return parts[0]?.startsWith(monthName) && (parts[1] === year.toString() || parts[1] === shortYear);
      });
    }

    return false;
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setError('');
    
    const userEmail = user?.email?.toLowerCase() || "";
    const isAdmin = userEmail === 'mianfiazullah@gmail.com' || user?.role === 'admin';
    const isMasterFile = user?.subDivision?.toLowerCase() === 'master file';
    const hasBypass = isAdmin || isMasterFile;
    if (!hasBypass) {
      const subDiv = user?.subDivision || "";
      if (subDiv) {
        const refNo = data.referenceNumber || "";
        const cleanRef = refNo.replace(/[^0-9]/g, '');
        const cleanSub = subDiv.replace(/[^0-9]/g, '');
        const isMatch = cleanSub ? cleanRef.includes(cleanSub) : refNo.toLowerCase().includes(subDiv.toLowerCase());
        
        if (!isMatch) {
          setError(`Saving restricted! This reference number (${refNo || 'None'}) does not belong to your subdivision (${subDiv}).`);
          toast.error(`Saving restricted! This reference number (${refNo || 'None'}) does not belong to your subdivision (${subDiv}).`);
          setIsSaving(false);
          return;
        }
      }
    }
    
    if (data.noOfAC && parseInt(data.noOfAC.toString()) > 0) {
      const split = parseInt(data.splitAcCount?.toString() || '0');
      const window = parseInt(data.windowAcCount?.toString() || '0');
      const total = parseInt(data.noOfAC.toString());
      if (split + window !== total) {
        setError(`The sum of Split AC (${split}) and Window AC (${window}) must equal the total No. of AC (${total}).`);
        setIsSaving(false);
        return;
      }
    }
    
    try {
      const caseData = {
        ...data,
        acType: (() => {
          const split = parseInt(data.splitAcCount?.toString() || '0');
          const window = parseInt(data.windowAcCount?.toString() || '0');
          if (split > 0 && window > 0) return 'Mixed (Split & Window)';
          if (split > 0) return 'Split';
          if (window > 0) return 'Window';
          return data.acType || '';
        })(),
        userId: user.uid,
        firNumber: data.registeredFirNo || '',
        updatedAt: new Date().toISOString(),
        billData: {
          ...existingCase?.billData,
          referenceNumber: data.referenceNumber,
          consumerName: data.name,
          address: data.address,
        }
      };

      const baseCase = existingCase || getInitialState('lesco_quick_edit_case', null);
      const caseId = baseCase?.id;

      if (caseId) {
        await updateDoc(doc(db, 'cases', caseId), caseData);
      } else {
        await addDoc(collection(db, 'cases'), {
          ...caseData,
          createdAt: new Date().toISOString(),
          firNumber: data.registeredFirNo || '',
        });
      }

      // 3. Save to Google Sheets (Parallel/Async)
      try {
        fetch("/api/save-to-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: safeStringify({
            data: {
              referenceNumber: data.referenceNumber,
              consumerName: data.name,
              address: data.address,
              billingMonth: data.billingMonth,
              consumedUnits: data.netUnitsToBeCharged,
              currentBill: data.billData?.currentBill,
              sanctionedLoad: data.sanctionLoad,
              meterStatus: data.meterStatus
            }
          })
        }).then(res => res.json()).then(result => {
          if (result.success) console.log("Saved to Google Sheets (QuickEdit)");
        }).catch(e => console.error("Sheets Background Error (QuickEdit):", e));
      } catch (sheetsErr) {
        console.error("Failed to initiate Sheets save (QuickEdit):", sheetsErr);
      }
      
      setIsSaved(true);
      localStorage.removeItem('lesco_quick_edit_data');
      localStorage.setItem('lesco_quick_edit_case', safeStringify({ id: caseId, ...caseData }));
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'cases');
      setError('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const triggerPrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`<html><head><title>Print ${activeTemplate}</title>`);
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach(style => printWindow.document.write(style.outerHTML));
    printWindow.document.write(`<style>
      @media print { 
        body { -webkit-print-color-adjust: exact; } 
        @page { size: portrait; margin: 10mm; }
      }
    </style>`);
    printWindow.document.write(`</head><body>${content.innerHTML}</body></html>`);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleScanBill = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    const loadingToast = toast.loading('Reading bill with AI...');

    const reader = new FileReader();
    reader.onerror = () => {
      toast.dismiss(loadingToast);
      toast.error('Failed to read file');
      setIsExtracting(false);
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        toast.dismiss(loadingToast);
        toast.error('Failed to load image');
        setIsExtracting(false);
      };
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Could not initialize canvas");
          ctx.drawImage(img, 0, 0, width, height);
          const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);

          const extractedData = await extractBillData(resizedBase64);
          
          const scannedRef = extractedData.referenceNumber || "";
          const subDiv = user?.subDivision || "";
          const userEmail = user?.email?.toLowerCase() || "";
          const isAdmin = userEmail === 'mianfiazullah@gmail.com' || user?.role === 'admin';
          const isMasterFile = subDiv?.toLowerCase() === 'master file';
          const hasBypass = isAdmin || isMasterFile;
          
          if (subDiv && !hasBypass) {
            const cleanRef = scannedRef.replace(/[^0-9]/g, '');
            const cleanSub = subDiv.replace(/[^0-9]/g, '');
            const isMatch = cleanSub ? cleanRef.includes(cleanSub) : scannedRef.toLowerCase().includes(subDiv.toLowerCase());
            
            if (!isMatch) {
              toast.dismiss(loadingToast);
              toast.error(`Scanning restricted! This bill (Reference: ${scannedRef || 'None'}) does not belong to your subdivision (${subDiv}).`);
              setIsExtracting(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
              return;
            }
          }
          
          setData(prev => ({
            ...prev,
            name: extractedData.consumerName && extractedData.consumerName !== 'N/A' ? extractedData.consumerName : prev.name,
            address: extractedData.address && extractedData.address !== 'N/A' ? extractedData.address : prev.address,
            referenceNumber: extractedData.referenceNumber && extractedData.referenceNumber !== 'N/A' ? extractedData.referenceNumber : prev.referenceNumber,
            customerId: extractedData.customerId && extractedData.customerId !== 'N/A' ? extractedData.customerId : prev.customerId,
            tariff: extractedData.tariff && extractedData.tariff !== 'N/A' ? extractedData.tariff : prev.tariff,
            sanctionLoad: extractedData.sanctionedLoad && extractedData.sanctionedLoad !== 'N/A' ? extractedData.sanctionedLoad : prev.sanctionLoad,
            billingMonth: extractedData.billingMonth && extractedData.billingMonth !== 'N/A' ? extractedData.billingMonth : prev.billingMonth,
            presentReading: extractedData.presentReading && extractedData.presentReading !== 'N/A' ? extractedData.presentReading : prev.presentReading,
            previousReading: extractedData.previousReading && extractedData.previousReading !== 'N/A' ? extractedData.previousReading : prev.previousReading,
            meterNumber: extractedData.meterNoOnBill && extractedData.meterNoOnBill !== 'N/A' ? extractedData.meterNoOnBill : prev.meterNumber,
            billData: {
              ...prev.billData,
              ...extractedData
            }
          }));
          toast.dismiss(loadingToast);
          toast.success('Bill data extracted successfully!');
        } catch (err: any) {
          console.error(err);
          toast.dismiss(loadingToast);
          toast.error(err.message || 'Failed to extract data');
        } finally {
          setIsExtracting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      toast.dismiss(loadingToast);
      toast.error('Failed to read file');
      setIsExtracting(false);
    };
    reader.readAsDataURL(file);
  };

  const isSlownessActive = data.discrepancy?.includes('Meter Slow By');

  return (
    <div className="h-full md:h-[calc(100vh-120px)] flex flex-col gap-4 md:gap-6 px-2 sm:px-4">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-500" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 truncate">
              {existingCase ? 'Edit Case' : 'Quick Template Editor'}
            </h1>
            <p className="text-[10px] sm:text-xs text-neutral-500 truncate">Edit all fields and see real-time preview</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex bg-neutral-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(['DETECTION BILL PROFORMA', 'NOTICE', 'FIR Request', 'FIR Urdu'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTemplate(t)}
                className={cn(
                  "px-2 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex-1 sm:flex-none",
                  activeTemplate === t ? "bg-white text-indigo-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                )}
              >
                {t.split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*" 
              className="hidden" 
            />
            <button 
              onClick={handleScanBill}
              disabled={isExtracting}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-amber-600/10",
                "bg-amber-500 text-white hover:bg-amber-400"
              )}
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
              AI Scan
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all",
                isSaved ? "bg-green-100 text-green-700" : "bg-neutral-900 text-white hover:bg-neutral-800"
              )}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button 
              onClick={triggerPrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Editor Panel */}
        <div className="w-full lg:w-1/3 bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-y-auto p-4 sm:p-6 space-y-8">
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-widest border-b border-neutral-100 pb-2">Consumer Info</h3>
            <div className="grid gap-4">
              <InputField label="Consumer Name : -" value={data.name} onChange={(v) => handleInputChange('name', v)} />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Present Occupier : -" value={data.presentOccupier} onChange={(v) => handleInputChange('presentOccupier', v)} />
                <InputField label="P/O Urdu : -" value={data.presentOccupierUrdu} onChange={(v) => handleInputChange('presentOccupierUrdu', v)} />
              </div>
              <InputField label="Address : -" value={data.address} onChange={(v) => handleInputChange('address', v)} />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Reference No : -" value={data.referenceNumber} onChange={(v) => handleInputChange('referenceNumber', v)} />
                <InputField label="Customer ID : -" value={data.customerId} onChange={(v) => handleInputChange('customerId', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Tariff : -" value={data.tariff} onChange={(v) => handleInputChange('tariff', v)} />
                <InputField label="Sanction Load : -" value={data.sanctionLoad} onChange={(v) => handleInputChange('sanctionLoad', v)} />
              </div>
              <InputField label="Bill Month : -" value={data.billingMonth} onChange={(v) => handleInputChange('billingMonth', v)} />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-widest border-b border-neutral-100 pb-2">Detection Details</h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Date of Checking : -" type="date" value={data.dateOfChecking} onChange={(v) => handleInputChange('dateOfChecking', v)} />
                <InputField label="Load Factor : -" value={data.loadFactor} onChange={(v) => handleInputChange('loadFactor', v)} />
              </div>
              <InputField label="Checked By : -" value={Array.isArray(data.checkedBy) ? data.checkedBy.join(', ') : data.checkedBy} onChange={(v) => handleInputChange('checkedBy', v.split(',').map((s: string) => s.trim()))} />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Meter No : -" value={data.meterNumber} onChange={(v) => handleInputChange('meterNumber', v)} />
                <InputField label="Meter Make : -" value={data.meterMake} onChange={(v) => handleInputChange('meterMake', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Meter Type : -" value={data.meterType} onChange={(v) => handleInputChange('meterType', v)} />
                <InputField label="Capacity : -" value={data.capacity} onChange={(v) => handleInputChange('capacity', v)} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <InputField 
                  label="Meter Status : -" 
                  value={data.meterStatus} 
                  onChange={(v) => handleInputChange('meterStatus', v)}
                  className={cn(data.meterStatus?.toUpperCase()?.includes('REPLACED') && "text-red-600 font-bold")}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <InputField label="Present Reading : -" value={data.presentReading} onChange={(v) => handleInputChange('presentReading', v)} />
              </div>
              <InputField 
                label="Difference : -" 
                value={(() => {
                  const presVal = data.presentReading?.toString().toUpperCase() || '';
                  const prevVal = data.previousReading?.toString().toUpperCase() || '';
                  if (presVal.includes('DF') || prevVal.includes('DF')) return 'DF';

                  const present = parseInt(presVal.replace(/,/g, '') || '0');
                  const previous = parseInt(prevVal.replace(/,/g, '') || '0');
                  const diff = present - previous;
                  return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
                })()} 
                onChange={() => {}}
                readOnly 
                className="font-bold text-black"
              />
              <InputField label="Discrepancy : -" value={data.discrepancy?.join(', ')} onChange={(v) => handleInputChange('discrepancy', v.split(',').map((s: string) => s.trim()))} />
              {data.discrepancy?.includes('Meter Slow By') && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-black uppercase tracking-wider ml-1">Meter Slow By Percentage : -</label>
                  <select
                    value={data.meterSlowBy || ''}
                    onChange={(e) => handleInputChange('meterSlowBy', e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black font-bold text-black transition-all"
                  >
                    <option value="">Select Percentage...</option>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={`${num}%`}>{num}%</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <InputField label="AC Period From : -" type="month" value={data.acPeriodFrom} onChange={(v) => handleInputChange('acPeriodFrom', v)} min={acMin} max={acMax} readOnly={isSlownessActive} />
                <InputField label="AC Period To : -" type="month" value={data.acPeriodTo} onChange={(v) => handleInputChange('acPeriodTo', v)} min={acMin} max={acMaxEffective} readOnly={isSlownessActive} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="AC Period Months : -" value={data.acPeriodMonths} onChange={(v) => handleInputChange('acPeriodMonths', v)} readOnly />
                <InputField label="Units of AC Period : -" value={data.unitsOfAcPeriod} onChange={(v) => handleInputChange('unitsOfAcPeriod', v)} readOnly={isSlownessActive} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-widest border-b border-neutral-100 pb-2">Billing & Notices</h3>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Notice No : -" value={data.noticeNo} onChange={(v) => handleInputChange('noticeNo', v)} />
                <InputField label="Notice Dated : -" type="date" value={data.noticeDated} onChange={(v) => handleInputChange('noticeDated', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="FIR Request Vide T/O No : -" value={data.firNo} onChange={(v) => handleInputChange('firNo', v)} />
                <InputField label="FIR Request T/O Dated : -" type="date" value={data.firDated} onChange={(v) => handleInputChange('firDated', v)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Registered FIR No : -" value={data.registeredFirNo} onChange={(v) => handleInputChange('registeredFirNo', v)} />
                <InputField label="Registered FIR Dated : -" type="date" value={data.registeredFirDated} onChange={(v) => handleInputChange('registeredFirDated', v)} />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-black uppercase tracking-wider ml-1">Name Of Police Station : -</label>
                  <select 
                    value={data.policeStation} 
                    onChange={(e) => handleInputChange('policeStation', e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 font-bold text-black transition-all"
                  >
                    <option value="">Select Police Station...</option>
                    <option value="Kot Radha Kishan">Kot Radha Kishan</option>
                    <option value="Raiwind">Raiwind</option>
                    <option value="Changa Manga">Changa Manga</option>
                    <option value="Manga Mandi">Manga Mandi</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <InputField label="NO of AC : -" value={data.noOfAC} onChange={(v) => handleInputChange('noOfAC', v)} readOnly={isSlownessActive} />
                {(parseInt(data.noOfAC?.toString() || '0') > 0) && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                    <InputField label="Split ACs : -" type="number" value={data.splitAcCount} onChange={(v) => handleInputChange('splitAcCount', v)} readOnly={isSlownessActive} />
                    <InputField label="Window ACs : -" type="number" value={data.windowAcCount} onChange={(v) => handleInputChange('windowAcCount', v)} readOnly={isSlownessActive} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField 
                  label="Period From : -" 
                  type="date" 
                  value={data.detectionPeriodFrom} 
                  onChange={(v) => handleInputChange('detectionPeriodFrom', v)} 
                />
                <div className="space-y-1">
                  <InputField 
                    label="Period To : -" 
                    type="date" 
                    value={data.detectionPeriodTo} 
                    onChange={(v) => handleInputChange('detectionPeriodTo', v)} 
                    className={cn(
                      data.detectionPeriodTo && !isMonthAvailableInBill(data.detectionPeriodTo) && "text-indigo-600 border-indigo-300 bg-indigo-50 font-bold"
                    )}
                  />
                  {data.detectionPeriodTo && !isMonthAvailableInBill(data.detectionPeriodTo) && (
                    <p className="text-[9px] text-red-600 font-bold ml-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Month data missing in bill
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {(() => {
                  const slownessStr = data.meterSlowBy || '';
                  const slowness = parseInt(slownessStr.replace('%', '')) || 0;
                  const charged = data.unitsAlreadyCharged || '0';
                  const isSlowness = data.discrepancy?.includes('Meter Slow By');
                  
                  const displayValue = (isSlowness && slowness > 0 && slowness < 100)
                    ? `(${charged} * 100) / (100 - ${slowness}%) = ${data.unitsAssessed}`
                    : data.unitsAssessed || '';

                  return (
                    <InputField 
                      label="Units Assessed : -" 
                      value={displayValue} 
                      onChange={(v) => handleInputChange('unitsAssessed', v)} 
                      readOnly={isSlowness}
                    />
                  );
                })()}
                <InputField label="Units Already Charged : -" value={data.unitsAlreadyCharged} onChange={(v) => handleInputChange('unitsAlreadyCharged', v)} />
                <InputField 
                  label={data.discrepancy?.includes('Meter Slow By') ? `UNITS TO BE CHARGED AS PER SLOWNESS ${data.meterSlowBy || ''} : -` : "UNITS TO BE CHARGED AS PER CONNECTED LOAD : -"} 
                  value={data.netUnitsToBeCharged} 
                  onChange={(v) => handleInputChange('netUnitsToBeCharged', v)} 
                  className={cn(
                    data.netUnitsToBeCharged === 'D.BILL IS NOT JUSTIFIED AS PER CONNECTED LOAD' ? "text-red-600 font-bold" : "text-black"
                  )} 
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-widest border-b border-neutral-100 pb-2">Consumption History</h3>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-[10px]">
                <thead className="bg-neutral-50 border-b border-neutral-200 uppercase font-bold text-neutral-500">
                  <tr>
                    <th className="px-2 py-1 border-r border-neutral-200 w-auto">Month</th>
                    <th className="px-2 py-1 border-r border-neutral-200 w-auto text-indigo-600">Reading</th>
                    <th className="px-2 py-1 border-r border-neutral-200 w-auto">Units</th>
                    <th className="px-2 py-1 border-r border-neutral-200 w-auto">Bill</th>
                    <th className="px-2 py-1 border-r border-neutral-200 w-1 whitespace-nowrap text-red-600">Adj</th>
                    <th className="px-2 py-1 border-r border-neutral-200 w-auto">Payment</th>
                    <th className="px-2 py-1 text-center w-1 whitespace-nowrap">
                      <Plus className="w-3 h-3 cursor-pointer hover:text-indigo-600" onClick={() => {
                        const units = [...(data.billData?.monthWiseUnits || [])];
                        units.unshift({ month: '', reading: '', units: '', bill: '', adj: '', payment: '' });
                        handleInputChange('billData', { ...data.billData, monthWiseUnits: units });
                      }} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {(data.billData?.monthWiseUnits || []).map((item, index) => (
                    <tr key={index}>
                      <td className="px-2 py-1 border-r border-neutral-200">
                        <input 
                          type="text" 
                          value={item.month || ''} 
                          onChange={(e) => {
                            const newUnits = [...(data.billData?.monthWiseUnits || [])];
                            newUnits[index].month = e.target.value;
                            handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                          }}
                          className="w-full bg-transparent focus:outline-none min-w-[50px] font-bold text-neutral-700"
                          placeholder="Month"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-neutral-200 text-indigo-600 font-bold">
                        <input 
                          type="text" 
                          value={item.reading || ''} 
                          onChange={(e) => {
                            const newUnits = [...(data.billData?.monthWiseUnits || [])];
                            newUnits[index].reading = e.target.value;
                            handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                          }}
                          className="w-full bg-transparent focus:outline-none min-w-[50px] text-indigo-600 font-bold"
                          placeholder="Reading"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-neutral-200">
                        <input 
                          type="text" 
                          value={item.units || ''} 
                          onChange={(e) => {
                            const newUnits = [...(data.billData?.monthWiseUnits || [])];
                            newUnits[index].units = e.target.value;
                            handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                          }}
                          className="w-full bg-transparent focus:outline-none min-w-[40px] font-bold text-neutral-900"
                          placeholder="Units"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-neutral-200">
                        <input 
                          type="text" 
                          value={item.bill || ''} 
                          onChange={(e) => {
                            const newUnits = [...(data.billData?.monthWiseUnits || [])];
                            newUnits[index].bill = e.target.value;
                            handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                          }}
                          className="w-full bg-transparent focus:outline-none min-w-[50px] font-bold text-neutral-900"
                          placeholder="Bill"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-neutral-200 text-red-600 font-bold">
                        <input 
                          type="text" 
                          value={item.adj || ''} 
                          onChange={(e) => {
                            const newUnits = [...(data.billData?.monthWiseUnits || [])];
                            newUnits[index].adj = e.target.value;
                            handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                          }}
                          className="w-full bg-transparent focus:outline-none min-w-[40px] text-red-600 font-bold text-center"
                          placeholder="Adj"
                        />
                      </td>
                      <td className="px-2 py-1 border-r border-neutral-200">
                        <input 
                          type="text" 
                          value={item.payment || ''} 
                          onChange={(e) => {
                            const newUnits = [...(data.billData?.monthWiseUnits || [])];
                            newUnits[index].payment = e.target.value;
                            handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                          }}
                          className="w-full bg-transparent focus:outline-none min-w-[50px] font-bold text-neutral-900"
                          placeholder="Payment"
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <Trash2 className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600" onClick={() => {
                          const newUnits = (data.billData?.monthWiseUnits || []).filter((_, i) => i !== index);
                          handleInputChange('billData', { ...data.billData, monthWiseUnits: newUnits });
                        }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-black uppercase tracking-widest border-b border-neutral-100 pb-2">Remarks</h3>
            <textarea
              value={data.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm focus:outline-none focus:border-black min-h-[100px] font-bold text-black"
              placeholder="Enter additional remarks..."
            />
          </section>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 min-w-0 bg-neutral-100 rounded-3xl border border-neutral-200 shadow-inner overflow-hidden flex flex-col relative">
          {/* Zoom Controls */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-white/80 backdrop-blur-md px-4 py-2 rounded-full border border-neutral-200 shadow-xl">
            <button 
              onClick={() => setZoom(prev => Math.max(0.3, prev - 0.1))}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            
            <input 
              type="range" 
              min="0.3" 
              max="2" 
              step="0.05" 
              value={zoom} 
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 sm:w-32 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            
            <button 
              onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            
            <div className="w-12 text-[10px] font-bold text-neutral-500 text-center border-l border-neutral-200 pl-2">
              {Math.round(zoom * 100)}%
            </div>
            
            <button 
              onClick={() => setZoom(0.8)}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-indigo-600"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 sm:p-8 lg:p-12 pt-16">
            <motion.div 
              animate={{ scale: zoom }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white shadow-2xl mx-auto w-max origin-top"
            >
              <ProformaTemplates
                ref={printRef}
                type={activeTemplate}
                data={{
                  ...data,
                  monthWiseUnits: data.billData?.monthWiseUnits || [],
                  billingMonth: data.billData?.billingMonth || '',
                  difference: data.billData?.unitsConsumed?.toString() || data.billData?.difference || data.difference,
                  presentReading: data.presentReading || data.billData?.presentReading || '',
                  previousReading: data.previousReading || data.billData?.previousReading || '',
                } as any}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", readOnly = false, min, max, className }: { label: string, value: any, onChange: (v: string) => void, type?: string, readOnly?: boolean, min?: string, max?: string, className?: string }) {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const defaultMax = type === 'date' ? today : type === 'month' ? thisMonth : undefined;

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-black uppercase tracking-wider ml-1">{label}</label>
      {type === 'date' ? (
        <CustomDatePicker
          selected={value}
          onChange={onChange}
          maxDate={max ? new Date(max) : new Date()}
          disabled={readOnly}
          className={cn("font-bold text-black", className)}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => !readOnly && onChange(e.target.value)}
          readOnly={readOnly}
          min={min}
          max={max || defaultMax}
          className={cn(
            "w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black transition-all font-bold text-black",
            readOnly ? "bg-neutral-100 cursor-not-allowed" : "bg-neutral-50",
            className
          )}
        />
      )}
    </div>
  );
}
