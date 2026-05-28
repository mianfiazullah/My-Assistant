import { safeStringify } from "../lib/safeStringify";
import { safeFetchJson } from "../lib/safeFetch";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Camera, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Download, 
  Printer, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  User, 
  MapPin, 
  Hash, 
  Zap, 
  ShieldAlert, 
  ExternalLink, 
  Check, 
  Plus,
  PlusCircle, 
  X, 
  Save, 
  Eye, 
  Home, 
  RefreshCw,
  GripVertical,
  Activity,
  Trash2,
  Calendar,
  Languages,
  ChevronDown,
  Cloud
} from 'lucide-react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  TouchSensor,
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import * as Dropzone from 'react-dropzone';
import { domToJpeg } from 'modern-screenshot';
import { cn } from '../lib/utils';
import { BillData, DetectionCase, LoadItem } from '../types';
import { jsPDF } from 'jspdf';
import { ProformaTemplates } from '../components/ProformaTemplates';
import { collection, addDoc, getDocs, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

import { extractBillData, translateToUrduAI } from '../lib/gemini';
import { translateToUrdu } from '../lib/urduUtils';
import { toast } from 'sonner';

function SortableItem(props: { 
  id: string; 
  children: React.ReactNode; 
  className?: string; 
  key?: string | number;
  serialNo?: string;
  onSerialNoChange?: (val: string) => void;
  label?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group flex flex-col bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md", 
        isDragging && "shadow-2xl border-indigo-500",
        props.className
      )}
    >
      <div className="flex items-center bg-neutral-50 dark:bg-slate-800 border-b border-neutral-100 dark:border-slate-700 px-3 py-2 gap-3">
        <div 
          className="cursor-grab active:cursor-grabbing hover:text-indigo-500 transition-colors shrink-0" 
          style={{ touchAction: 'none' }}
          {...attributes} 
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-neutral-400 dark:text-slate-500" />
        </div>
        
        {props.serialNo !== undefined && (
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-lg px-2 py-1 shadow-sm shrink-0">
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">No.</span>
            <input 
              value={props.serialNo}
              onChange={(e) => props.onSerialNoChange?.(e.target.value)}
              className="w-6 text-center bg-transparent font-bold text-neutral-800 dark:text-slate-100 focus:outline-none text-xs"
              placeholder="#"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {props.label}
        </div>
      </div>
      <div className="p-4 min-w-0">
        {props.children}
      </div>
    </div>
  );
}

export default function NewCase() {
  const { user } = useAuth();
  const userEmail = user?.email?.toLowerCase() || "";
  const isAdmin = userEmail === 'mianfiazullah@gmail.com' || user?.role === 'admin';
  const [allPoliceStations, setAllPoliceStations] = useState<{ en: string; ur: string }[]>(() => [
    { en: "Kot Radha Kishan", ur: "کوٹ رادھا کشن" },
    { en: "Raiwind", ur: "رائے ونڈ" },
    { en: "Changa Manga", ur: "چھانگا مانگا" },
    { en: "Manga Mandi", ur: "مانگا منڈی" }
  ]);
  const isUploadingRef = useRef(false);
  
  const resetCase = () => {
    localStorage.removeItem('lesco_new_case_step');
    localStorage.removeItem('lesco_new_case_photo');
    localStorage.removeItem('lesco_new_case_ref');
    localStorage.removeItem('lesco_detection_data');
    localStorage.removeItem('lesco_bill_data');
    localStorage.removeItem('lesco_new_case_is_saved');
    localStorage.removeItem('lesco_new_case_show_meter_mismatch');
    localStorage.removeItem('lesco_new_case_is_meter_verified');
    localStorage.removeItem('lesco_new_case_show_reading_mismatch');
    localStorage.removeItem('lesco_new_case_reading_mismatch_type');
    localStorage.removeItem('lesco_new_case_is_reading_verified');
    localStorage.removeItem('lesco_new_case_show_ac_mismatch');
    localStorage.removeItem('lesco_new_case_is_ac_verified');
    localStorage.removeItem('lesco_new_case_has_generated');
    
    setStep(1);
    setPhoto(null);
    setReferenceNumber('');
    setBillData(null);
    setDetectionData(defaultDetectionData);
    setIsSaved(false);
    setHasGenerated(false);
    setValidationErrors([]);
    setIsMeterVerified(false);
    setIsReadingVerified(false);
    setIsAcVerified(true);
    setShowMeterMismatch(false);
    setShowReadingMismatch(false);
    setShowAcMismatch(false);
    setError('');
  };

  // Load initial state from localStorage
  const getInitialState = <T,>(key: string, defaultValue: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved || saved === 'undefined' || saved === 'null') return defaultValue;
      const trimmed = saved.trim();
      if (trimmed === 'undefined' || trimmed === 'null' || trimmed === '') return defaultValue;
      try {
        return JSON.parse(trimmed) as T;
      } catch (err) {
        console.warn(`JSON parse error for key "${key}":`, err);
        return defaultValue;
      }
    } catch (e) {
      return defaultValue;
    }
  };

  const [step, setStep] = useState(() => getInitialState('lesco_new_case_step', 1));

  useEffect(() => {
    localStorage.setItem('lesco_new_case_step', safeStringify(step));
  }, [step]);

  const [photo, setPhoto] = useState<string | null>(() => {
    const saved = localStorage.getItem('lesco_new_case_photo');
    return (saved && saved !== 'undefined' && saved !== 'null') ? saved : null;
  });

  const [referenceNumber, setReferenceNumber] = useState(() => {
    const saved = localStorage.getItem('lesco_new_case_ref');
    return (saved && saved !== 'undefined' && saved !== 'null') ? saved : '';
  });

  const [billData, setBillData] = useState<BillData | null>(() => getInitialState('lesco_bill_data', null));
  const [error, setError] = useState('');
  const defaultDetectionData = {
    dateOfChecking: '',
    employeeName: user?.sdoName || user?.name || '',
    employeeDesignation: user?.designation || 'Assistant Manager (Operation)',
    employeeCnic: user?.sdoCnic || '35102-0565965-3',
    employeeMobile: user?.sdoMobile || '0370-4991751',
    discrepancy: [] as string[],
    othersDiscrepancy: '',
    checkedBy: [] as string[],
    othersCheckedBy: '',
    meterType: '',
    capacity: '',
    presentReading: '',
    presentReadingAtSite: '',
    previousReading: '',
    difference: '',
    email: '',
    mobileNo: '+92',
    meterMake: '',
    name: 'Inayat Ullah',
    address: '',
    sanctionLoad: '',
    connectedLoad: '',
    loadFactor: '',
    feederName: '',
    grandTotalUnits: '',
    customerId: '',
    tariff: '',
    meterNumber: '',
    witnesses: ['', ''],
    remarks: '',
    noticeNo: '',
    noticeDated: '',
    firNo: '',
    firDated: '',
    registeredFirNo: '',
    registeredFirDated: '',
    policeStation: '',
    policeStationUrdu: '',
    noOfAC: '',
    photoUrl: '',
    splitAcCount: '',
    windowAcCount: '',
    acType: '' as any,
    othersAcType: '',
    detectionPeriodFrom: '',
    detectionPeriodTo: '',
    detectionPeriodMonths: '',
    acPeriodFrom: '',
    acPeriodTo: '',
    acPeriodMonths: '',
    unitsOfAcPeriod: '',
    unitsAssessed: '',
    unitsAlreadyCharged: '',
    netUnitsToBeCharged: '',
    meterSlowBy: '',
    lossAmount: '',
    seizureCableSize: '',
    seizureCableColor: '',
    seizureCableLength: '',
    nameUrdu: '',
    addressUrdu: '',
    employeeNameUrdu: user?.sdoNameUrdu || '',
    presentOccupier: '',
    presentOccupierUrdu: '',
    loadItems: [
      { name: 'E/Saver', qty: '', watts: 18, total: 0 },
      { name: 'Tube Light', qty: '', watts: 40, total: 0 },
      { name: 'Fan', qty: '', watts: 80, total: 0 },
      { name: 'TV', qty: '', watts: 150, total: 0 },
      { name: 'Computer', qty: '', watts: 200, total: 0 },
      { name: 'Refrigerator', qty: '', watts: 250, total: 0 },
      { name: 'Freezer', qty: '', watts: 350, total: 0 },
      { name: 'W/Machine', qty: '', watts: 373, total: 0 },
      { name: 'Water Pump', qty: '', watts: 746, total: 0 },
      { name: 'Iron', qty: '', watts: 1000, total: 0 },
      { name: 'UPS', qty: '', watts: 1000, total: 0 },
      { name: 'Toka/Heat', qty: '', watts: '', total: 0 },
    ] as LoadItem[],
    billingMonth: '',
    id: '',
    userId: user?.uid || '',
    firNumber: '',
    detectionDate: '',
    createdAt: '',
    billData: {} as BillData,
    referenceNumber: '',
    meterStatus: '',
    dBillingMemoNo: '',
    dBillingMemoDated: '',
  };

  const [detectionData, setDetectionData] = useState<DetectionCase>(() => {
    const saved = getInitialState<Partial<DetectionCase>>('lesco_detection_data', defaultDetectionData as any);
    return { ...defaultDetectionData, ...saved } as DetectionCase;
  });
  const [isFetching, setIsFetching] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(() => getInitialState('lesco_new_case_is_saved', false));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showMeterMismatch, setShowMeterMismatch] = useState(() => getInitialState('lesco_new_case_show_meter_mismatch', false));
  const [isMeterVerified, setIsMeterVerified] = useState(() => getInitialState('lesco_new_case_is_meter_verified', false));
  const [showReadingMismatch, setShowReadingMismatch] = useState(() => getInitialState('lesco_new_case_show_reading_mismatch', false));
  const [readingMismatchType, setReadingMismatchType] = useState<'REVERSED' | 'PENDING' | null>(() => getInitialState('lesco_new_case_reading_mismatch_type', null));
  const [isReadingVerified, setIsReadingVerified] = useState(() => getInitialState('lesco_new_case_is_reading_verified', false));
  const [showAcMismatch, setShowAcMismatch] = useState(() => getInitialState('lesco_new_case_show_ac_mismatch', false));
  const [isAcVerified, setIsAcVerified] = useState(() => getInitialState('lesco_new_case_is_ac_verified', true));

  useEffect(() => {
    if (user) {
      setDetectionData(prev => {
        const nextEmployeeName = user.sdoName || user.name || '';
        const nextEmployeeDesignation = user.designation || 'Assistant Manager (Operation)';
        const nextEmployeeCnic = user.sdoCnic || '35102-0565965-3';
        const nextEmployeeMobile = user.sdoMobile || '0370-4991751';
        const nextEmployeeNameUrdu = user.sdoNameUrdu || '';
        const nextPoliceStation = user.policeStation || '';
        const nextPoliceStationUrdu = user.policeStationUrdu || '';

        // Force fill instantly and automatically when step 3 is entered, or if any details differ
        if (
          step === 3 ||
          prev.employeeName !== nextEmployeeName ||
          prev.employeeDesignation !== nextEmployeeDesignation ||
          prev.employeeCnic !== nextEmployeeCnic ||
          prev.employeeMobile !== nextEmployeeMobile ||
          prev.employeeNameUrdu !== nextEmployeeNameUrdu ||
          prev.policeStation !== nextPoliceStation ||
          prev.policeStationUrdu !== nextPoliceStationUrdu ||
          prev.userId !== user.uid
        ) {
          return {
            ...prev,
            employeeName: nextEmployeeName,
            employeeDesignation: nextEmployeeDesignation,
            employeeCnic: nextEmployeeCnic,
            employeeMobile: nextEmployeeMobile,
            employeeNameUrdu: nextEmployeeNameUrdu,
            policeStation: prev.policeStation || nextPoliceStation,
            policeStationUrdu: prev.policeStationUrdu || nextPoliceStationUrdu,
            userId: user.uid
          };
        }
        return prev;
      });
    }
  }, [user, step]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchAllPS = async () => {
      try {
        const q = query(collection(db, 'users'));
        const qs = await getDocs(q);
        const unique = new Map<string, string>();
        
        // Add defaults first so they are present
        const defaults = [
          { en: "Kot Radha Kishan", ur: "کوٹ رادھا کشن" },
          { en: "Raiwind", ur: "رائے ونڈ" },
          { en: "Changa Manga", ur: "چھانگا مانگا" },
          { en: "Manga Mandi", ur: "مانگا منڈی" }
        ];
        defaults.forEach(item => {
          unique.set(item.en, item.ur);
        });

        qs.forEach(docSnap => {
          const uData = docSnap.data();
          if (uData.policeStation) {
            const en = String(uData.policeStation).trim();
            const ur = String(uData.policeStationUrdu || translateToUrdu(en)).trim();
            if (en) {
              unique.set(en, ur);
            }
          }
          if (Array.isArray(uData.policeStations)) {
            uData.policeStations.forEach((psEn: any, idx: number) => {
              const en = String(psEn || '').trim();
              if (en) {
                const psUr = uData.policeStationsUrdu?.[idx];
                const ur = String(psUr || translateToUrdu(en)).trim();
                unique.set(en, ur);
              }
            });
          }
        });

        const list: { en: string; ur: string }[] = [];
        unique.forEach((ur, en) => {
          list.push({ en, ur });
        });
        list.sort((a, b) => a.en.localeCompare(b.en));
        setAllPoliceStations(list);
      } catch (err) {
        console.error("Error fetching admin police stations:", err);
      }
    };
    fetchAllPS();
  }, [isAdmin]);

  useEffect(() => {
    if (photo) localStorage.setItem('lesco_new_case_photo', photo);
    else localStorage.removeItem('lesco_new_case_photo');
  }, [photo]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_ref', referenceNumber);
  }, [referenceNumber]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_is_saved', safeStringify(isSaved));
  }, [isSaved]);

  useEffect(() => {
    if (step < 4 && isSaved) {
      setIsSaved(false);
    }
  }, [step, isSaved]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_show_meter_mismatch', safeStringify(showMeterMismatch));
  }, [showMeterMismatch]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_is_meter_verified', safeStringify(isMeterVerified));
  }, [isMeterVerified]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_show_reading_mismatch', safeStringify(showReadingMismatch));
  }, [showReadingMismatch]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_reading_mismatch_type', safeStringify(readingMismatchType));
  }, [readingMismatchType]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_is_reading_verified', safeStringify(isReadingVerified));
  }, [isReadingVerified]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_show_ac_mismatch', safeStringify(showAcMismatch));
  }, [showAcMismatch]);

  useEffect(() => {
    localStorage.setItem('lesco_new_case_is_ac_verified', safeStringify(isAcVerified));
  }, [isAcVerified]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const playWarningSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // High pitch
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2); // 200ms
  };

  const validateAcCounts = () => {
    const total = parseInt(detectionData.noOfAC || '0') || 0;
    const split = parseInt(detectionData.splitAcCount || '0') || 0;
    const window = parseInt(detectionData.windowAcCount || '0') || 0;
    
    if (total > 0) {
      if (split + window === total) {
        setIsAcVerified(true);
        setShowAcMismatch(false);
        toast.success('AC Counts verified successfully');
      } else {
        setIsAcVerified(false);
        setShowAcMismatch(true);
        playWarningSound();
        toast.error(`AC Counts mismatch: ${split} + ${window} = ${split + window}, but Total is ${total}`);
      }
    } else {
      setIsAcVerified(true);
      setShowAcMismatch(false);
    }
  };

  const [aiUrduTranslations, setAiUrduTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState<string | null>(null);

  const handleTranslateField = async (fieldName: string, text: string) => {
    if (!text) return;
    setIsTranslating(fieldName);
    try {
      const translated = await translateToUrduAI(text);
      if (translated) {
        setAiUrduTranslations(prev => ({ ...prev, [fieldName]: translated }));
        // Also update persistent detectionData if the field corresponds
        const urduField = `${fieldName}Urdu`;
        if (urduField in detectionData) {
          setDetectionData(prev => ({ ...prev, [urduField]: translated }));
        }
        toast.success(`Translated to: ${translated}`);
      } else {
        toast.error('Failed to translate');
      }
    } catch (err) {
      toast.error('Translation error');
    } finally {
      setIsTranslating(null);
    }
  };

  const defaultFieldOrder = [
    'dateOfChecking', 'noticeNo', 'noticeDated', 'firNo', 'firDated', 'registeredFirNo', 'registeredFirDated', 'policeStation',
    'noOfAC', 'feederName', 'grandTotalUnits', 'meterStatus', 'detectionPeriodFrom', 'detectionPeriodTo', 'detectionPeriodMonths',
    'unitsAssessed', 'unitsAlreadyCharged', 'netUnitsToBeCharged', 'dBillingMemoNo', 'dBillingMemoDated', 'lossAmount', 'seizureCableSize', 'seizureCableColor', 'seizureCableLength', 'checkedBy', 'referenceNo',
    'consumerName', 'nameUrdu', 'presentOccupier', 'presentOccupierUrdu', 'address', 'addressUrdu', 'customerId', 'tariff', 'sanctionLoad', 'meterNo', 'meterMake',
    'meterType', 'capacity', 'discrepancy', 'acPeriodFrom', 'acPeriodTo', 'acPeriodMonths', 'unitsOfAcPeriod',
    'presentReadingAtSite', 'email', 'mobileNo', 'witnesses', 'loadFactor', 'loadItems', 'remarks',
    'employeeName', 'employeeNameUrdu', 'employeeDesignation', 'employeeCnic', 'employeeMobile'
  ];

  const defaultFieldSerials = {
    dateOfChecking: '1', noticeNo: '2', noticeDated: '3', firNo: '4', firDated: '5', registeredFirNo: '6', registeredFirDated: '7', policeStation: '8',
    noOfAC: '9', detectionPeriodFrom: '10', detectionPeriodTo: '11', detectionPeriodMonths: '12',
    dBillingMemoNo: '34a', dBillingMemoDated: '34b',
    unitsAssessed: '34', unitsAlreadyCharged: '33', netUnitsToBeCharged: '35', checkedBy: '16', referenceNo: '17',
    consumerName: '18', nameUrdu: '18U', presentOccupier: '18A', presentOccupierUrdu: '18B', address: '19', addressUrdu: '19U', customerId: '20', tariff: '21', sanctionLoad: '22', meterNo: '23', meterMake: '24',
    meterType: '25', capacity: '26', discrepancy: '27', acPeriodFrom: '28', acPeriodTo: '29', acPeriodMonths: '30', unitsOfAcPeriod: '31',
    presentReadingAtSite: '32', email: '13', mobileNo: '14', witnesses: '15', loadFactor: '39', loadItems: '37', remarks: '38', feederName: '36', grandTotalUnits: '36a', meterStatus: '26a',
    employeeName: '40', employeeNameUrdu: '40U', employeeDesignation: '41', employeeCnic: '42', employeeMobile: '43'
  };

  const [fieldOrder, setFieldOrder] = useState(() => {
    const saved = getInitialState('lesco_field_order', defaultFieldOrder);
    const missing = defaultFieldOrder.filter(f => !saved.includes(f));
    if (missing.length > 0) {
      // Find where to insert them (after discrepancy)
      const discIdx = saved.indexOf('discrepancy');
      if (discIdx !== -1) {
        const newOrder = [...saved];
        newOrder.splice(discIdx + 1, 0, ...missing);
        return newOrder;
      }
      return [...saved, ...missing];
    }
    return saved;
  });

  const [fieldSerials, setFieldSerials] = useState(() => {
    const saved = getInitialState('lesco_field_serials', defaultFieldSerials);
    const merged = { ...defaultFieldSerials, ...saved };
    return merged;
  });

  useEffect(() => {
    localStorage.setItem('lesco_field_order', safeStringify(fieldOrder));
  }, [fieldOrder]);

  useEffect(() => {
    localStorage.setItem('lesco_field_serials', safeStringify(fieldSerials));
  }, [fieldSerials]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFieldOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update serial numbers based on new order
        const newSerials = { ...fieldSerials };
        newOrder.forEach((id: any, index: number) => {
          newSerials[id as string] = (index + 1).toString();
        });
        setFieldSerials(newSerials);
        
        return newOrder;
      });
    }
  };

  // Effect to sort fieldOrder by fieldSerials
  useEffect(() => {
    const sorted = [...fieldOrder].sort((a, b) => {
      const serialA = parseInt(fieldSerials[a] || '999');
      const serialB = parseInt(fieldSerials[b] || '999');
      return serialA - serialB;
    });
    
    if (safeStringify(sorted) !== safeStringify(fieldOrder)) {
      setFieldOrder(sorted);
    }
  }, [fieldSerials, fieldOrder]);
  const [templateOrder, setTemplateOrder] = useState(() => {
    const saved = getInitialState<string[]>('lesco_template_order', [
      'DETECTION BILL PROFORMA',
      'NOTICE',
      'FIR Request',
      'FIR Urdu',
      'Detection Register'
    ]);
    // Migration: Ensure 'FIR Urdu' is present if missing from saved state
    if (!saved.includes('FIR Urdu')) {
      const newOrder = [...saved];
      const firRequestIndex = newOrder.indexOf('FIR Request');
      if (firRequestIndex !== -1) {
        newOrder.splice(firRequestIndex + 1, 0, 'FIR Urdu');
      } else {
        newOrder.push('FIR Urdu');
      }
      return newOrder;
    }
    return saved;
  });

  useEffect(() => {
    localStorage.setItem('lesco_template_order', safeStringify(templateOrder));
  }, [templateOrder]);

  const handleTemplateDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTemplateOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const [step2ButtonOrder, setStep2ButtonOrder] = useState(() => getInitialState('lesco_step2_button_order', [
    'fetch',
    'scan',
    'skip'
  ]));
  const [step2ButtonSerials, setStep2ButtonSerials] = useState(() => getInitialState('lesco_step2_button_serials', { fetch: '1', scan: '2', skip: '3' }));

  useEffect(() => {
    localStorage.setItem('lesco_step2_button_order', safeStringify(step2ButtonOrder));
  }, [step2ButtonOrder]);

  useEffect(() => {
    localStorage.setItem('lesco_step2_button_serials', safeStringify(step2ButtonSerials));
  }, [step2ButtonSerials]);

  const handleStep2ButtonDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStep2ButtonOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        
        // Update serial numbers based on new order
        const newSerials = { ...step2ButtonSerials };
        newOrder.forEach((id: any, index: number) => {
          newSerials[id as string] = (index + 1).toString();
        });
        setStep2ButtonSerials(newSerials);
        
        return newOrder;
      });
    }
  };

  // Effect to sort step2ButtonOrder by step2ButtonSerials
  useEffect(() => {
    const sorted = [...step2ButtonOrder].sort((a, b) => {
      const serialA = parseInt(step2ButtonSerials[a as keyof typeof step2ButtonSerials] || '999');
      const serialB = parseInt(step2ButtonSerials[b as keyof typeof step2ButtonSerials] || '999');
      return serialA - serialB;
    });
    
    if (safeStringify(sorted) !== safeStringify(step2ButtonOrder)) {
      setStep2ButtonOrder(sorted);
    }
  }, [step2ButtonSerials, step2ButtonOrder]);

  const [hasGenerated, setHasGenerated] = useState(() => getInitialState('lesco_new_case_has_generated', false));

  useEffect(() => {
    localStorage.setItem('lesco_new_case_has_generated', safeStringify(hasGenerated));
  }, [hasGenerated]);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear();
  const acMin = `${currentYear}-04`;
  const acMax = `${currentYear}-09`;
  const acMaxEffective = thisMonth < acMax ? thisMonth : acMax;

  const handleSerialNoChange = useCallback((id: string, val: string) => {
    setFieldSerials(prev => ({ ...prev, [id]: val }));
  }, []);

  const renderField = useCallback((id: string, serialNo: string = '') => {
    const onSerialNoChange = (val: string) => handleSerialNoChange(id, val);
    // Freeze fields only if there is an active AC mismatch
    const isAcField = ['noOfAC', 'splitAcCount', 'windowAcCount', 'acPeriodFrom', 'acPeriodTo', 'acPeriodMonths', 'unitsOfAcPeriod'].includes(id);
    const isNetPositive = detectionData.netUnitsToBeCharged && !isNaN(Number(detectionData.netUnitsToBeCharged)) && Number(detectionData.netUnitsToBeCharged) >= 0;
    // Relaxed freezing: Detection Details should be editable as per user request
    const isDisabled = false; 

    switch (id) {
      case 'dateOfChecking':
        return (
          <SortableItem 
            id="dateOfChecking" 
            key="dateOfChecking" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<p className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Date Of Checking</p>}
          >
            <div className={cn("relative", isDisabled && "opacity-50 pointer-events-none")} id="field-dateOfChecking">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-900 dark:text-slate-100 pointer-events-none" />
              <input 
                type="date"
                value={detectionData.dateOfChecking || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const datesToCheck = [
                    { key: 'noticeDated', label: 'Notice Dated' },
                    { key: 'firDated', label: 'FIR Request Dated' },
                    { key: 'registeredFirDated', label: 'Registered FIR Dated' },
                    { key: 'dBillingMemoDated', label: 'D.BILL MEMO DATED' }
                  ];
                  
                  const invalidSet = datesToCheck.filter(d => (detectionData as any)[d.key] && val && (detectionData as any)[d.key] < val);
                  
                  if (invalidSet.length > 0) {
                    toast.warning(`Note: Date of Checking is now later than existing ${invalidSet.map(d => d.label).join(', ')}`);
                  }
                  setDetectionData({...detectionData, dateOfChecking: val});
                }}
                max={today}
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 pl-10 pr-3 focus:outline-none focus:border-indigo-500 transition-all hover:border-indigo-300 dark:text-slate-100"
              />
            </div>
          </SortableItem>
        );
      case 'noticeNo':
        return (
          <SortableItem 
            id="noticeNo" 
            key="noticeNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Notice No.</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.noticeNo || ''} onChange={(e) => setDetectionData({...detectionData, noticeNo: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'noticeDated':
        return (
          <SortableItem 
            id="noticeDated" 
            key="noticeDated" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Notice Dated</label>}
          >
            <div className={cn("relative", isDisabled && "opacity-50 pointer-events-none")}>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-900 dark:text-slate-100 pointer-events-none" />
              <input 
                type="date" 
                value={detectionData.noticeDated || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && detectionData.dateOfChecking && val < detectionData.dateOfChecking) {
                    toast.error("Notice Dated cannot be earlier than Date of Checking");
                    return;
                  }
                  setDetectionData({...detectionData, noticeDated: val});
                }} 
                min={detectionData.dateOfChecking}                max={today} 
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-3 focus:outline-none focus:border-indigo-500 transition-all hover:border-indigo-300 font-bold text-neutral-900 dark:text-slate-100" 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'firNo':
        return (
          <SortableItem 
            id="firNo" 
            key="firNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">FIR Request Vide T/O No.</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.firNo || ''} onChange={(e) => setDetectionData({...detectionData, firNo: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'firDated':
        return (
          <SortableItem 
            id="firDated" 
            key="firDated" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">FIR Request T/O Dated</label>}
          >
            <div className={cn("relative", isDisabled && "opacity-50 pointer-events-none")}>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-900 dark:text-slate-100 pointer-events-none" />
              <input 
                type="date" 
                value={detectionData.firDated || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && detectionData.dateOfChecking && val < detectionData.dateOfChecking) {
                    toast.error("FIR Request Dated cannot be earlier than Date of Checking");
                    return;
                  }
                  setDetectionData({...detectionData, firDated: val});
                }} 
                min={detectionData.dateOfChecking}                max={today} 
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-3 focus:outline-none focus:border-indigo-500 transition-all hover:border-indigo-300 font-bold text-neutral-900 dark:text-slate-100" 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'registeredFirNo':
        return (
          <SortableItem 
            id="registeredFirNo" 
            key="registeredFirNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Registered FIR No.</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.registeredFirNo || ''} onChange={(e) => setDetectionData({...detectionData, registeredFirNo: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'lossAmount':
        return (
          <SortableItem 
            id="lossAmount" 
            key="lossAmount" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Loss Amount</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.lossAmount || ''} onChange={(e) => setDetectionData({...detectionData, lossAmount: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'seizureCableSize':
        return (
          <SortableItem 
            id="seizureCableSize" 
            key="seizureCableSize" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Seizure Cable Size</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.seizureCableSize || ''} onChange={(e) => setDetectionData({...detectionData, seizureCableSize: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'seizureCableColor':
        return (
          <SortableItem 
            id="seizureCableColor" 
            key="seizureCableColor" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Seizure Cable Color</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.seizureCableColor || ''} onChange={(e) => setDetectionData({...detectionData, seizureCableColor: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'seizureCableLength':
        return (
          <SortableItem 
            id="seizureCableLength" 
            key="seizureCableLength" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Seizure Cable Length</label>}
          >
            <div className={cn("flex gap-2", isDisabled && "opacity-50 pointer-events-none")}>
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={detectionData.seizureCableLength?.replace(/(Foot|Meter)/g, '').trim() || ''} 
                  onChange={(e) => {
                    const unit = detectionData.seizureCableLength?.includes('Meter') ? 'Meter' : 'Foot';
                    setDetectionData({...detectionData, seizureCableLength: `${e.target.value} ${unit}`.trim()});
                  }} 
                  placeholder="Enter length"
                  className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500" 
                  disabled={isDisabled} 
                />
              </div>
              <div className="relative min-w-[120px]">
                <select 
                  value={detectionData.seizureCableLength?.includes('Meter') ? 'Meter' : 'Foot'} 
                  onChange={(e) => {
                    const val = detectionData.seizureCableLength?.replace(/(Foot|Meter)/g, '').trim() || '';
                    setDetectionData({...detectionData, seizureCableLength: `${val} ${e.target.value}`.trim()});
                  }}
                  className="w-full appearance-none bg-indigo-50 border border-indigo-200 rounded-xl p-3 pr-10 font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  disabled={isDisabled}
                >
                  <option value="Foot">Foot</option>
                  <option value="Meter">Meter</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
              </div>
            </div>
          </SortableItem>
        );
      case 'registeredFirDated':
        return (
          <SortableItem 
            id="registeredFirDated" 
            key="registeredFirDated" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Registered FIR Dated</label>}
          >
            <div className={cn("relative", isDisabled && "opacity-50 pointer-events-none")}>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-900 dark:text-slate-100 pointer-events-none" />
              <input 
                type="date" 
                value={detectionData.registeredFirDated || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && detectionData.dateOfChecking && val < detectionData.dateOfChecking) {
                    toast.error("Registered FIR Dated cannot be earlier than Date of Checking");
                    return;
                  }
                  setDetectionData({...detectionData, registeredFirDated: val});
                }} 
                min={detectionData.dateOfChecking}                max={today} 
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-3 focus:outline-none focus:border-indigo-500 transition-all hover:border-indigo-300 font-bold text-neutral-900 dark:text-slate-100" 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'policeStation':
        return (
          <SortableItem 
            id="policeStation" 
            key="policeStation" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center gap-1.5 justify-between w-full">
                <label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Name Of Police Station</label>
                {(user?.policeStation || (user?.policeStations && user.policeStations.length > 0)) && (
                  <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase dark:bg-teal-950/40 dark:border-teal-800">Synced Roster</span>
                )}
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <select 
                value={detectionData.policeStation || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  let urduVal = '';
                  if (val === 'Kot Radha Kishan') urduVal = 'کوٹ رادھا کشن';
                  else if (val === 'Raiwind') urduVal = 'رائے ونڈ';
                  else if (val === 'Changa Manga') urduVal = 'چھانگا مانگا';
                  else if (val === 'Manga Mandi') urduVal = 'مانگا منڈی';
                  else if (user?.policeStations && user.policeStations.includes(val)) {
                    const idx = user.policeStations.indexOf(val);
                    urduVal = user.policeStationsUrdu?.[idx] || '';
                  } else if (val === user?.policeStation) {
                    urduVal = user?.policeStationUrdu || '';
                  } else {
                    const matchedStation = allPoliceStations.find(item => item.en === val);
                    if (matchedStation) {
                      urduVal = matchedStation.ur;
                    }
                  }

                  if (!urduVal && val) {
                    const low = val.toLowerCase().trim();
                    if (low === 'kot radha kishan' || low.includes('radha kishan')) urduVal = 'کوٹ رادھا کشن';
                    else if (low === 'raiwind' || low.includes('raiwind')) urduVal = 'رائے ونڈ';
                    else if (low === 'changa manga' || low.includes('changa manga')) urduVal = 'چھانگا مانگا';
                    else if (low === 'manga mandi' || low.includes('manga mandi')) urduVal = 'مانگا منڈی';
                    else if (low === 'raiwind city') urduVal = 'رائے ونڈ سٹی';
                    else if (low === 'kasur') urduVal = 'قصور';
                    else if (low === 'lahore') urduVal = 'لاہور';
                    else if (low === 'pattoki') urduVal = 'پتونکی';
                    else if (low === 'chunian') urduVal = 'چونیاں';
                    else if (low === 'phool nagar') urduVal = 'پھول نگر';
                    else if (low === 'habibabad') urduVal = 'حبیب آباد';
                    else if (low === 'mustafabad') urduVal = 'مصطفی آباد';
                    else if (low === 'ellahabad') urduVal = 'الہٰ آباد';
                    else if (low === 'kanganpur') urduVal = 'کنگن پور';
                    else if (low === 'khudian') urduVal = 'کھڈیاں';
                    else if (low === 'bhai pheru') urduVal = 'بھائی پھیرو';
                    else if (low === 'lalyani') urduVal = 'للیانی';
                  }

                  if (!urduVal && val) {
                    urduVal = translateToUrdu(val);
                  }

                  setDetectionData({
                    ...detectionData, 
                    policeStation: val, 
                    policeStationUrdu: urduVal
                  });
                }} 
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-indigo-500 font-bold text-neutral-900 dark:text-slate-100"
              >
                <option value="">Select Police Station...</option>
                {!isAdmin ? (
                  user?.policeStations && user.policeStations.length > 0 ? (
                    user.policeStations.map((ps, idx) => {
                      const urdu = user.policeStationsUrdu?.[idx] || translateToUrdu(ps);
                      return (
                        <option key={idx} value={ps}>
                          {ps} {urdu ? `(${urdu})` : ''}
                        </option>
                      );
                    })
                  ) : (
                    user?.policeStation ? (
                      (() => {
                        const urdu = user?.policeStationUrdu || translateToUrdu(user.policeStation);
                        return (
                          <option value={user.policeStation}>
                            {user.policeStation} {urdu ? `(${urdu})` : ''}
                          </option>
                        );
                      })()
                    ) : (
                      <option disabled value="">No Police Station connected. Sync with Google Sheets first</option>
                    )
                  )
                ) : (
                  allPoliceStations.map((item, idx) => (
                    <option key={idx} value={item.en}>
                      {item.en} {item.ur ? `(${item.ur})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </SortableItem>
        );
      case 'meterStatus':
        return (
          <SortableItem 
            id="meterStatus" 
            key="meterStatus" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs uppercase tracking-widest text-neutral-900 dark:text-slate-100 font-bold">Meter Status</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="text" 
                value={detectionData.meterStatus || ''} 
                onChange={(e) => setDetectionData({...detectionData, meterStatus: e.target.value})}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100"
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'noOfAC':
        const acCount = parseInt(detectionData.noOfAC) || 0;
        return (
          <SortableItem 
            id="noOfAC" 
            key="noOfAC" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">No. of AC</label>
                {acCount > 0 && (
                  <button
                    type="button"
                    onClick={validateAcCounts}
                    disabled={isDisabled}
                    className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex items-center gap-1",
                      isDisabled ? "bg-neutral-100 text-neutral-400" : (
                        isAcVerified 
                          ? "bg-green-100 text-green-700" 
                          : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
                      )
                    )}
                  >
                    {isAcVerified ? <CheckCircle className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                    {isAcVerified ? 'Verified' : 'Calculate & Verify'}
                  </button>
                )}
              </div>
            }
          >
            <div className="space-y-3">
              <input 
                type="number" 
                value={detectionData.noOfAC || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  const numVal = parseInt(val) || 0;
                  setDetectionData(prev => ({
                    ...prev,
                    noOfAC: val,
                    acType: val === '' ? '' : (prev.acType || 'Split'),
                    othersAcType: val === '' ? '' : prev.othersAcType,
                    splitAcCount: val === '' ? '' : prev.splitAcCount,
                    windowAcCount: val === '' ? '' : prev.windowAcCount
                  }));
                  setIsAcVerified(numVal === 0);
                  if (showAcMismatch) setShowAcMismatch(false);
                }} 
                onBlur={() => {
                  if (detectionData.noOfAC && !isAcVerified) {
                    validateAcCounts();
                  }
                }}
                disabled={isDisabled}
                className={cn("w-full border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100", isDisabled ? "bg-neutral-100 dark:bg-slate-800 cursor-not-allowed" : "bg-white dark:bg-slate-800")} 
              />

              {acCount > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    "grid grid-cols-2 gap-4 p-4 rounded-xl border transition-all",
                    showAcMismatch ? "bg-indigo-50 border-indigo-200" : "bg-neutral-50 border-neutral-200"
                  )}
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-wider">Split ACs</label>
                    <input 
                      type="number"
                      min="0"
                      max={acCount}
                      value={detectionData.splitAcCount || ''}
                      onChange={(e) => {
                        setDetectionData({...detectionData, splitAcCount: e.target.value});
                        setIsAcVerified(false);
                        if (showAcMismatch) setShowAcMismatch(false);
                      }}
                      onBlur={() => {
                        if (detectionData.splitAcCount && !isAcVerified) {
                          validateAcCounts();
                        }
                      }}
                      placeholder="Qty"
                      disabled={isDisabled}
                      className={cn("w-full border border-neutral-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 font-bold text-neutral-900 dark:text-slate-100", isDisabled ? "bg-neutral-100 dark:bg-slate-800 cursor-not-allowed" : "bg-white dark:bg-slate-800")}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-wider">Window ACs</label>
                    <input 
                      type="number"
                      min="0"
                      max={acCount}
                      value={detectionData.windowAcCount || ''}
                      onChange={(e) => {
                        setDetectionData({...detectionData, windowAcCount: e.target.value});
                        setIsAcVerified(false);
                        if (showAcMismatch) setShowAcMismatch(false);
                      }}
                      onBlur={() => {
                        if (detectionData.windowAcCount && !isAcVerified) {
                          validateAcCounts();
                        }
                      }}
                      placeholder="Qty"
                      disabled={isDisabled}
                      className={cn("w-full border border-neutral-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500 font-bold text-neutral-900 dark:text-slate-100", isDisabled ? "bg-neutral-100 dark:bg-slate-800 cursor-not-allowed" : "bg-white dark:bg-slate-800")}
                    />
                  </div>
                  {showAcMismatch && (
                    <div className="col-span-2 flex items-center gap-2 text-indigo-600 text-[10px] font-bold mt-1">
                      <AlertCircle className="w-3 h-3" />
                      Sum must equal {acCount}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </SortableItem>
        );
      case 'grandTotalUnits':
        return (
          <SortableItem 
            id="grandTotalUnits" 
            key="grandTotalUnits" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs uppercase tracking-widest text-neutral-900 dark:text-slate-100 font-bold">G. Total Units TO BE CHARGED</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="text" 
                value={detectionData.grandTotalUnits || ''} 
                readOnly
                className={cn(
                  "w-full bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold",
                  detectionData.grandTotalUnits?.includes('D.BILL IS NOT JUSTIFIED') ? "text-indigo-600 animate-blink" : "text-neutral-900 dark:text-slate-100"
                )} 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'feederName':
        return (
          <SortableItem 
            id="feederName" 
            key="feederName" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs uppercase tracking-widest text-neutral-900 dark:text-slate-100 font-bold">Feeder Name</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="text" 
                value={detectionData.feederName || ''} 
                onChange={(e) => setDetectionData({...detectionData, feederName: e.target.value})}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100"
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'acType':
        return null;
      case 'detectionPeriodFrom':
        return (
          <SortableItem 
            id="detectionPeriodFrom" 
            key="detectionPeriodFrom" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Detection Period From</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="month" value={detectionData.detectionPeriodFrom || ''} onChange={(e) => setDetectionData({...detectionData, detectionPeriodFrom: e.target.value})} max={thisMonth} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'detectionPeriodTo':
        const isToMonthMissing = detectionData.detectionPeriodTo && !isMonthAvailableInBill(detectionData.detectionPeriodTo);
        return (
          <SortableItem 
            id="detectionPeriodTo" 
            key="detectionPeriodTo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Detection Period To</label>
                {isToMonthMissing && (
                  <p className="text-[10px] text-red-600 font-medium ml-1 flex items-center gap-1 animate-blink">
                    <AlertCircle className="w-3 h-3" /> Data for this month not found in scanned bill
                  </p>
                )}
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="month" 
                value={detectionData.detectionPeriodTo || ''} 
                onChange={(e) => setDetectionData({...detectionData, detectionPeriodTo: e.target.value})} 
                max={thisMonth} 
                className={cn(
                  "w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 transition-colors",
                  isToMonthMissing ? "text-red-600 border-red-300 bg-red-50 font-bold" : "text-neutral-900 dark:text-slate-100 font-bold"
                )} 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'detectionPeriodMonths':
        return (
          <SortableItem 
            id="detectionPeriodMonths" 
            key="detectionPeriodMonths" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Detection Period Months</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.detectionPeriodMonths || ''} onChange={(e) => setDetectionData({...detectionData, detectionPeriodMonths: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'acPeriodFrom':
        if (!detectionData.noOfAC || parseInt(detectionData.noOfAC) === 0) return null;
        return (
          <SortableItem 
            id="acPeriodFrom" 
            key="acPeriodFrom" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">AC Period From</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="month" 
                value={detectionData.acPeriodFrom || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const month = parseInt(val.split('-')[1]);
                    if (month < 4 || month > 9) {
                      toast.error('AC Period must be between April and September');
                      return;
                    }
                  }
                  
                  const newData = { ...detectionData, acPeriodFrom: val };
                  if (newData.acPeriodFrom && newData.acPeriodTo) {
                    const [y1, m1] = newData.acPeriodFrom.split('-').map(Number);
                    const [y2, m2] = newData.acPeriodTo.split('-').map(Number);
                    const months = (y2 * 12 + m2) - (y1 * 12 + m1) + 1;
                    newData.acPeriodMonths = months > 0 ? months.toString() : '0';
                  } else {
                    newData.acPeriodMonths = '';
                  }
                  setDetectionData(newData);
                }} 
                min={acMin}
                max={acMax} 
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" 
              />
            </div>
          </SortableItem>
        );
      case 'acPeriodTo':
        if (!detectionData.noOfAC || parseInt(detectionData.noOfAC) === 0) return null;
        return (
          <SortableItem 
            id="acPeriodTo" 
            key="acPeriodTo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">AC Period To</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="month" 
                value={detectionData.acPeriodTo || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const month = parseInt(val.split('-')[1]);
                    if (month < 4 || month > 9) {
                      toast.error('AC Period must be between April and September');
                      return;
                    }
                    if (val > thisMonth) {
                      toast.error('AC Period To cannot be later than the current month');
                      return;
                    }
                  }
                  
                  const newData = { ...detectionData, acPeriodTo: val };
                  if (newData.acPeriodFrom && newData.acPeriodTo) {
                    const [y1, m1] = newData.acPeriodFrom.split('-').map(Number);
                    const [y2, m2] = newData.acPeriodTo.split('-').map(Number);
                    const months = (y2 * 12 + m2) - (y1 * 12 + m1) + 1;
                    newData.acPeriodMonths = months > 0 ? months.toString() : '0';
                  } else {
                    newData.acPeriodMonths = '';
                  }
                  setDetectionData(newData);
                }} 
                min={acMin}
                max={acMaxEffective} 
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" 
              />
            </div>
          </SortableItem>
        );
      case 'acPeriodMonths':
        if (!detectionData.noOfAC || parseInt(detectionData.noOfAC) === 0) return null;
        return (
          <SortableItem 
            id="acPeriodMonths" 
            key="acPeriodMonths" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">AC Period Months</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="text" 
                value={detectionData.acPeriodMonths || ''} 
                readOnly
                disabled={isDisabled}
                className="w-full bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 cursor-not-allowed font-bold text-neutral-900 dark:text-slate-100" 
              />
            </div>
          </SortableItem>
        );
      case 'unitsOfAcPeriod':
        if (!detectionData.noOfAC || parseInt(detectionData.noOfAC) === 0) return null;
        return (
          <SortableItem 
            id="unitsOfAcPeriod" 
            key="unitsOfAcPeriod" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Units of AC Period</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.unitsOfAcPeriod || ''} onChange={(e) => setDetectionData({...detectionData, unitsOfAcPeriod: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'unitsAssessed':
        const isSlowness = detectionData.discrepancy.includes('Meter Slow By');
        const charged = detectionData.unitsAlreadyCharged || '0';
        const slownessPerc = parseInt(detectionData.meterSlowBy?.replace('%', '') || '0');
        const displayAssessed = (isSlowness && slownessPerc > 0 && slownessPerc < 100)
          ? `(${charged} * 100) / (100 - ${slownessPerc}%) = ${detectionData.unitsAssessed}`
          : (detectionData.unitsAssessed || '');

        return (
          <SortableItem 
            id="unitsAssessed" 
            key="unitsAssessed" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Units Assessed</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="text" 
                value={displayAssessed} 
                onChange={(e) => setDetectionData({...detectionData, unitsAssessed: e.target.value})} 
                className={cn("w-full border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100", isDisabled ? "bg-neutral-100 dark:bg-slate-800" : "bg-white dark:bg-slate-800")} 
                disabled={isDisabled} 
                readOnly={isSlowness}
              />
            </div>
          </SortableItem>
        );
      case 'unitsAlreadyCharged':
        return (
          <SortableItem 
            id="unitsAlreadyCharged" 
            key="unitsAlreadyCharged" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Units Already Charged</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.unitsAlreadyCharged || ''} onChange={(e) => setDetectionData({...detectionData, unitsAlreadyCharged: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'netUnitsToBeCharged':
        const isSlownessActiveForLabel = detectionData.discrepancy.includes('Meter Slow By');
        return (
          <SortableItem 
            id="netUnitsToBeCharged" 
            key="netUnitsToBeCharged" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs uppercase tracking-widest text-neutral-900 dark:text-slate-100 font-bold">{isSlownessActiveForLabel ? `UNITS TO BE CHARGED AS PER SLOWNESS ${detectionData.meterSlowBy || ''}` : 'UNITS TO BE CHARGED AS PER CONNECTED LOAD'}</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input 
                type="text" 
                value={detectionData.netUnitsToBeCharged || ''} 
                onChange={(e) => setDetectionData({...detectionData, netUnitsToBeCharged: e.target.value})} 
                className={cn(
                  "w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold",
                  detectionData.netUnitsToBeCharged?.includes('D.BILL IS NOT JUSTIFIED') ? "text-red-600 animate-blink" : "text-neutral-900 dark:text-slate-100"
                )} 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'dBillingMemoNo':
        return (
          <SortableItem 
            id="dBillingMemoNo" 
            key="dBillingMemoNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">D.BILL MEMO NO.</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input type="text" value={detectionData.dBillingMemoNo || ''} onChange={(e) => setDetectionData({...detectionData, dBillingMemoNo: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-3 font-bold text-neutral-900 dark:text-slate-100" disabled={isDisabled} />
            </div>
          </SortableItem>
        );
      case 'dBillingMemoDated':
        return (
          <SortableItem 
            id="dBillingMemoDated" 
            key="dBillingMemoDated" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">D.BILL MEMO DATED</label>}
          >
            <div className={cn("relative", isDisabled && "opacity-50 pointer-events-none")}>
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-900 dark:text-slate-100 pointer-events-none" />
              <input 
                type="date" 
                value={detectionData.dBillingMemoDated || ''} 
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && detectionData.dateOfChecking && val < detectionData.dateOfChecking) {
                    toast.error("D.BILL MEMO DATED cannot be earlier than Date of Checking");
                    return;
                  }
                  setDetectionData({...detectionData, dBillingMemoDated: val});
                }} 
                min={detectionData.dateOfChecking}                max={today} 
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-3 pl-10 pr-3 focus:outline-none focus:border-indigo-500 transition-all hover:border-indigo-300 font-bold text-neutral-900 dark:text-slate-100" 
                disabled={isDisabled} 
              />
            </div>
          </SortableItem>
        );
      case 'checkedBy':
        return (
          <SortableItem 
            id="checkedBy" 
            key="checkedBy" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Checked By (Multiple)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-checkedBy">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Sub Divisional Checking Team",
                  "M&T Representative",
                  "M&S Team",
                  "Along With"
                ].map((option) => (
                  <div key={option} className="space-y-2">
                    <label className="flex items-center gap-2 p-2 border border-neutral-200 dark:border-slate-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors">
                      <input
                        type="checkbox"
                        checked={detectionData.checkedBy.includes(option)}
                        disabled={isDisabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDetectionData(prev => ({
                            ...prev,
                            checkedBy: checked 
                              ? [...prev.checkedBy, option]
                              : prev.checkedBy.filter(item => item !== option)
                          }));
                        }}
                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm font-bold text-neutral-900 dark:text-slate-100">{option}</span>
                    </label>
                    {option === "Along With" && detectionData.checkedBy.includes("Along With") && (
                      <input
                        type="text"
                        value={detectionData.othersCheckedBy || ''}
                        onChange={(e) => setDetectionData({...detectionData, othersCheckedBy: e.target.value})}
                        placeholder="Enter manual checking team..."
                        disabled={isDisabled}
                        className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-2 text-sm focus:outline-none focus:border-indigo-500 font-bold text-neutral-900 dark:text-slate-100"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </SortableItem>
        );
      case 'referenceNo':
        return (
          <SortableItem 
            id="referenceNo" 
            key="referenceNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 dark:text-slate-400 uppercase font-bold tracking-widest">Reference Number</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={billData?.referenceNumber || ''}
                readOnly
                disabled={isDisabled}
                className="w-full bg-neutral-100 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-base sm:text-lg font-bold text-neutral-900 dark:text-slate-100 font-mono focus:outline-none"
              />
            </div>
          </SortableItem>
        );
      case 'consumerName':
        return (
          <SortableItem 
            id="consumerName" 
            key="consumerName" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 dark:text-slate-400 uppercase font-bold tracking-widest">Consumer Name (As per Bill)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-name">
              <div className="relative group/field">
                <input
                  type="text"
                  value={detectionData.name || ''}
                  onChange={(e) => {
                    setDetectionData({...detectionData, name: e.target.value});
                    if (aiUrduTranslations['name']) {
                      setAiUrduTranslations(prev => {
                        const next = { ...prev };
                        delete next['name'];
                        return next;
                      });
                    }
                  }}
                  placeholder="Enter Consumer Name"
                  disabled={isDisabled}
                  className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-10 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleTranslateField('name', detectionData.name)}
                  disabled={isDisabled || !detectionData.name || isTranslating === 'name'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30"
                  title="Translate to Urdu"
                >
                  {isTranslating === 'name' ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Languages className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {(detectionData.name || aiUrduTranslations['name'] || isTranslating === 'name') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1 flex justify-end items-center gap-2 pb-1" 
                    dir="rtl"
                  >
                    <span className={cn(
                      "text-sm font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 urdu-font transition-colors",
                      isTranslating === 'name' ? "text-neutral-400 animate-pulse" : "text-indigo-600"
                    )}>
                      {isTranslating === 'name' ? 'ترجمہ ہو رہا ہے...' : (detectionData.nameUrdu || aiUrduTranslations['name'] || translateToUrdu(detectionData.name))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableItem>
        );
      case 'presentOccupier':
        return (
          <SortableItem 
            id="presentOccupier" 
            key="presentOccupier" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 dark:text-slate-400 uppercase font-bold tracking-widest">Present Occupier (P/O)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <div className="relative group/field">
                <input
                  type="text"
                  value={detectionData.presentOccupier || ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (newValue.trim().toLowerCase() === 'muhammad afzal') {
                      toast.error('This name "Muhammad Afzal" is restricted for this field.', { id: 'restricted-name' });
                      return;
                    }
                    setDetectionData({...detectionData, presentOccupier: newValue});
                    if (aiUrduTranslations['presentOccupier']) {
                      setAiUrduTranslations(prev => {
                        const next = { ...prev };
                        delete next['presentOccupier'];
                        return next;
                      });
                    }
                  }}
                  placeholder="Enter Present Occupier Name"
                  disabled={isDisabled}
                  className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-10 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleTranslateField('presentOccupier', detectionData.presentOccupier || '')}
                  disabled={isDisabled || !detectionData.presentOccupier || isTranslating === 'presentOccupier'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30"
                  title="Translate to Urdu"
                >
                  {isTranslating === 'presentOccupier' ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Languages className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {(detectionData.presentOccupier || aiUrduTranslations['presentOccupier'] || isTranslating === 'presentOccupier') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1 flex justify-end items-center gap-2 pb-1" 
                    dir="rtl"
                  >
                    <span className={cn(
                      "text-sm font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 urdu-font transition-colors",
                      isTranslating === 'presentOccupier' ? "text-neutral-400 animate-pulse" : "text-indigo-600"
                    )}>
                      {isTranslating === 'presentOccupier' ? 'ترجمہ ہو رہا ہے...' : (detectionData.presentOccupierUrdu || aiUrduTranslations['presentOccupier'] || translateToUrdu(detectionData.presentOccupier || ''))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableItem>
        );
      case 'presentOccupierUrdu':
        return (
          <SortableItem 
            id="presentOccupierUrdu" 
            key="presentOccupierUrdu" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 uppercase font-bold tracking-widest text-indigo-600">Present Occupier (Urdu)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.presentOccupierUrdu || ''}
                onChange={(e) => setDetectionData({...detectionData, presentOccupierUrdu: e.target.value})}
                placeholder="حال قابض کا نام درج کریں"
                disabled={isDisabled}
                dir="rtl"
                className="w-full bg-indigo-50/30 border border-indigo-100 rounded-xl py-2 px-3 text-neutral-900 font-bold urdu-font focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'nameUrdu':
        return (
          <SortableItem 
            id="nameUrdu" 
            key="nameUrdu" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 uppercase font-bold tracking-widest text-indigo-600">Consumer Name (Urdu)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.nameUrdu || ''}
                onChange={(e) => setDetectionData({...detectionData, nameUrdu: e.target.value})}
                placeholder="نام منتخب کریں"
                disabled={isDisabled}
                dir="rtl"
                className="w-full bg-indigo-50/30 border border-indigo-100 rounded-xl py-2 px-3 text-neutral-900 font-bold urdu-font focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'address':
        return (
          <SortableItem 
            id="address" 
            key="address" 
            className="md:col-span-2" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 dark:text-slate-400 uppercase font-bold tracking-widest">Address</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-address">
              <div className="relative group/field">
                <input
                  type="text"
                  value={detectionData.address || ''}
                  onChange={(e) => {
                    setDetectionData({...detectionData, address: e.target.value});
                    if (aiUrduTranslations['address']) {
                      setAiUrduTranslations(prev => {
                        const next = { ...prev };
                        delete next['address'];
                        return next;
                      });
                    }
                  }}
                  placeholder="Enter Address"
                  disabled={isDisabled}
                  className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-10 text-neutral-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleTranslateField('address', detectionData.address)}
                  disabled={isDisabled || !detectionData.address || isTranslating === 'address'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-30"
                  title="Translate to Urdu"
                >
                  {isTranslating === 'address' ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Languages className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {(detectionData.address || aiUrduTranslations['address'] || isTranslating === 'address') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1 flex justify-end items-center gap-2 pb-1" 
                    dir="rtl"
                  >
                    <span className={cn(
                      "text-sm font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 urdu-font transition-colors",
                      isTranslating === 'address' ? "text-neutral-400 animate-pulse" : "text-indigo-600"
                    )}>
                      {isTranslating === 'address' ? 'ترجمہ ہو رہا ہے...' : (detectionData.addressUrdu || aiUrduTranslations['address'] || translateToUrdu(detectionData.address))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableItem>
        );
      case 'addressUrdu':
        return (
          <SortableItem 
            id="addressUrdu" 
            key="addressUrdu" 
            className="md:col-span-2"
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 uppercase font-bold tracking-widest text-indigo-600">Address (Urdu)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.addressUrdu || ''}
                onChange={(e) => setDetectionData({...detectionData, addressUrdu: e.target.value})}
                placeholder="پتہ درج کریں"
                disabled={isDisabled}
                dir="rtl"
                className="w-full bg-indigo-50/30 border border-indigo-100 rounded-xl py-2 px-3 text-neutral-900 font-bold urdu-font focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'customerId':
        return (
          <SortableItem 
            id="customerId" 
            key="customerId" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">CUSTOMER ID</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-customerId">
              <input
                type="text"
                value={detectionData.customerId || ''}
                onChange={(e) => setDetectionData({...detectionData, customerId: e.target.value})}
                placeholder="Enter Customer ID"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'tariff':
        return (
          <SortableItem 
            id="tariff" 
            key="tariff" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Tariff</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-tariff">
              <input
                type="text"
                value={detectionData.tariff || ''}
                onChange={(e) => {
                  const newTariff = e.target.value;
                  let newLoadFactor = detectionData.loadFactor;
                  if (newTariff.includes('(01)') || newTariff === '01') newLoadFactor = '20%';
                  else if (newTariff.includes('(04)') || newTariff === '04') newLoadFactor = '30%';
                  setDetectionData({...detectionData, tariff: newTariff, loadFactor: newLoadFactor});
                }}
                placeholder="Enter Tariff"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'sanctionLoad':
        return (
          <SortableItem 
            id="sanctionLoad" 
            key="sanctionLoad" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Sanction Load</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.sanctionLoad || ''}
                onChange={(e) => setDetectionData({...detectionData, sanctionLoad: e.target.value})}
                placeholder="Enter Sanction Load"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'meterNo':
        return (
          <SortableItem 
            id="meterNo" 
            key="meterNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Meter No.</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-meterNumber">
              <input
                type="text"
                value={detectionData.meterNumber || ''}
                onChange={(e) => {
                  setDetectionData({...detectionData, meterNumber: e.target.value});
                  setIsMeterVerified(false);
                  if (showMeterMismatch) setShowMeterMismatch(false);
                }}
                onBlur={() => {
                  if (
                    billData?.meterNoOnBill && 
                    detectionData.meterNumber && 
                    billData.meterNoOnBill !== detectionData.meterNumber &&
                    !isMeterVerified
                  ) {
                    playWarningSound();
                    setShowMeterMismatch(true);
                  } else {
                    setShowMeterMismatch(false);
                  }
                }}
                placeholder="Enter Meter Number"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'meterMake':
        return (
          <SortableItem 
            id="meterMake" 
            key="meterMake" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Make</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-meterMake">
              <select 
                value={detectionData.meterMake || ''}
                onChange={(e) => setDetectionData({...detectionData, meterMake: e.target.value})}
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 font-bold text-neutral-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select...</option>
                <option>Creative</option>
                <option>Transfopower</option>
                <option>PEL</option>
                <option>KBK</option>
                <option>MicroTech.</option>
                <option>S.B</option>
                <option>Sbeec</option>
                <option>IMS</option>
                <option>ACE INDIGO</option>
                <option>VERTEX</option>
                <option>Meter Totally Burnt.</option>
              </select>
            </div>
          </SortableItem>
        );
      case 'meterType':
        return (
          <SortableItem 
            id="meterType" 
            key="meterType" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Type</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-meterType">
              <select 
                value={detectionData.meterType || ''}
                onChange={(e) => {
                  const newType = e.target.value;
                  let newCapacity = detectionData.capacity;
                  if (newType.startsWith('S-Phase')) newCapacity = '10-40 Amp';
                  if (newType.startsWith('3-Phase')) newCapacity = '15-90 Amp';
                  setDetectionData({...detectionData, meterType: newType, capacity: newCapacity});
                }}
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 font-bold text-neutral-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select...</option>
                <option>S-Phase Static</option>
                <option>S-Phase PC</option>
                <option>S-Phase AMI</option>
                <option>3-Phase Static</option>
                <option>3-Phase PC</option>
                <option>3-Phase AMI</option>
              </select>
            </div>
          </SortableItem>
        );
      case 'capacity':
        return (
          <SortableItem 
            id="capacity" 
            key="capacity" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Capacity</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-capacity">
              <select 
                value={detectionData.capacity || ''}
                onChange={(e) => setDetectionData({...detectionData, capacity: e.target.value})}
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 font-bold text-neutral-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select...</option>
                <option>10-40 Amp</option>
                <option>15-90 Amp</option>
              </select>
            </div>
          </SortableItem>
        );
      case 'discrepancy':
        return (
          <SortableItem 
            id="discrepancy" 
            key="discrepancy" 
            className="md:col-span-2" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Discrepancy (Multiple)</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-discrepancy">
              <div className="bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl p-4 max-h-60 overflow-y-auto space-y-2">
                {[
                  'Direct Supply From LESCO main Cable',
                  'Direct Supply From L.T line',
                  'Direct Supply From Meter terminal.',
                  'Meter Body Tempered.',
                  'Hole In Meter Body. Meter Reversed.',
                  'Hole in Meter Terminal Block.',
                  'Scratches on Figures. Meter Reversed.',
                  'Shunt In Terminal Block.',
                  'One Phase Dead Stop. Meter 33% Slow.',
                  'Two Phase Dead Stop. Meter 66% Slow.',
                  'Meter Dead Stop.',
                  'Meter Intensionally Display Wash.',
                  'Meter Intensionally Burnt.',
                  'Meter Slow By',
                  'Others'
                ].map((option) => (
                  <div key={option} className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox"
                          checked={detectionData.discrepancy.includes(option)}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newDiscrepancy = e.target.checked 
                              ? [...detectionData.discrepancy, option]
                              : detectionData.discrepancy.filter(d => d !== option);
                            setDetectionData({...detectionData, discrepancy: newDiscrepancy});
                          }}
                          className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-neutral-300 bg-white transition-all checked:border-indigo-600 checked:bg-indigo-600"
                        />
                        <Check className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" />
                      </div>
                      <span className="text-sm text-neutral-700 dark:text-slate-300 group-hover:text-neutral-900 dark:group-hover:text-slate-100 transition-colors">{option}</span>
                    </label>
                    {option === 'Meter Slow By' && detectionData.discrepancy.includes('Meter Slow By') && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mt-2"
                      >
                        <select
                          value={detectionData.meterSlowBy || ''}
                          disabled={isDisabled}
                          onChange={(e) => setDetectionData({...detectionData, meterSlowBy: e.target.value})}
                          className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="">Select Percentage...</option>
                          {Array.from({ length: 100 }, (_, i) => i + 1).map(num => (
                            <option key={num} value={`${num}%`}>{num}%</option>
                          ))}
                        </select>
                      </motion.div>
                    )}
                    {option === 'Others' && detectionData.discrepancy.includes('Others') && (
                      <motion.input
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        type="text"
                        placeholder="Specify Other Discrepancy"
                        value={detectionData.othersDiscrepancy || ''}
                        disabled={isDisabled}
                        onChange={(e) => setDetectionData({...detectionData, othersDiscrepancy: e.target.value})}
                        className="w-full mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm focus:outline-none focus:border-indigo-500 transition-all"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </SortableItem>
        );
      case 'presentReadingAtSite':
        return (
          <SortableItem 
            id="presentReadingAtSite" 
            key="presentReadingAtSite" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Present Reading at Site</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.presentReadingAtSite || ''}
                onChange={(e) => {
                  setDetectionData({...detectionData, presentReadingAtSite: e.target.value});
                  setIsReadingVerified(false);
                  if (showReadingMismatch) setShowReadingMismatch(false);
                }}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val.trim() === '') return;
                  
                  if (billData?.presentReading && !isReadingVerified) {
                    const presentReadingAtSiteNum = parseInt(val.replace(/,/g, '') || '0');
                    const presReadingOnBillNum = parseInt(billData.presentReading.toString().replace(/,/g, '') || '0');
                    
                    if (!isNaN(presentReadingAtSiteNum) && !isNaN(presReadingOnBillNum)) {
                      if (presentReadingAtSiteNum < presReadingOnBillNum) {
                        playWarningSound();
                        setReadingMismatchType('REVERSED');
                        setShowReadingMismatch(true);
                      } else {
                        let maxAllowedUnits = 300;
                        if (billData.monthWiseUnits && billData.monthWiseUnits.length > 0) {
                          const unitsArr = billData.monthWiseUnits
                            .map(m => parseInt(m.units?.toString().replace(/,/g, '') || '0'))
                            .filter(u => !isNaN(u));
                          
                          if (unitsArr.length > 0) {
                            const sum = unitsArr.reduce((a, b) => a + b, 0);
                            const avg = sum / 12;
                            const highest = Math.max(...unitsArr);
                            maxAllowedUnits = Math.max(avg, highest);
                          }
                        }

                        if (presentReadingAtSiteNum > presReadingOnBillNum + maxAllowedUnits) {
                          playWarningSound();
                          setReadingMismatchType('PENDING');
                          setShowReadingMismatch(true);
                        } else {
                          setShowReadingMismatch(false);
                          setReadingMismatchType(null);
                        }
                      }
                    }
                  } else {
                    setShowReadingMismatch(false);
                    setReadingMismatchType(null);
                  }
                }}
                placeholder="Enter Present Reading at Site"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'email':
        return (
          <SortableItem 
            id="email" 
            key="email" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">E Mail Address</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-email">
              <input
                type="email"
                value={detectionData.email || ''}
                onChange={(e) => setDetectionData({...detectionData, email: e.target.value})}
                placeholder="Enter E Mail"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'mobileNo':
        return (
          <SortableItem 
            id="mobileNo" 
            key="mobileNo" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Mobile Number</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-mobileNo">
              <input
                type="tel"
                value={detectionData.mobileNo || ''}
                onChange={(e) => {
                  let val = e.target.value;
                  val = val.replace(/(?!^\+)[^\d]/g, '');
                  if (val.startsWith('+920')) {
                    val = '+92' + val.slice(4);
                  } else if (!val.startsWith('+92')) {
                    val = val.replace(/^(?:\+92|\+9|\+|92|0)/, '');
                    val = '+92' + val;
                  }
                  setDetectionData({...detectionData, mobileNo: val});
                }}
                placeholder="Enter Mobile No."
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'witnesses':
        return (
          <SortableItem 
            id="witnesses" 
            key="witnesses" 
            className="md:col-span-2" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Witnesses</label>
                <button 
                  type="button"
                  onClick={() => setDetectionData({...detectionData, witnesses: [...detectionData.witnesses, '']})}
                  disabled={isDisabled}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  <PlusCircle className="w-3 h-3" /> Add Witness
                </button>
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")} id="field-witnesses">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-transparent">
                {detectionData.witnesses.map((witness, index) => (
                  <div key={index} className="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-slate-800/50 rounded-xl border border-neutral-100 dark:border-slate-700">
                    <div className="relative group">
                      <input
                        type="text"
                        value={witness}
                        onChange={(e) => {
                          const newWitnesses = [...detectionData.witnesses];
                          newWitnesses[index] = e.target.value;
                          setDetectionData({...detectionData, witnesses: newWitnesses});
                        }}
                        placeholder={`Witness ${index + 1} Name & Designation`}
                        disabled={isDisabled}
                        className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 pr-10 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500 shadow-sm"
                      />
                      {detectionData.witnesses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newWitnesses = detectionData.witnesses.filter((_, i) => i !== index);
                            setDetectionData({...detectionData, witnesses: newWitnesses});
                          }}
                          disabled={isDisabled}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['Acting Meter Inspector', 'LS-I', 'LS-II', 'LM-I', 'LM-II', 'MS-I', 'MS-II', 'Lorry Driver', 'LS', 'LM', 'ALM', 'BD', 'MS', 'M/R', 'JE', 'SDO'].map(desig => (
                        <button
                          key={desig}
                          type="button"
                          onClick={() => {
                            const newWitnesses = [...detectionData.witnesses];
                            const current = newWitnesses[index].trim();
                            if (!current.toUpperCase().includes(desig.toUpperCase())) {
                              newWitnesses[index] = current ? `${current} ${desig}` : desig;
                              setDetectionData({...detectionData, witnesses: newWitnesses});
                            }
                          }}
                          className="text-[10px] px-2 py-1 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md text-neutral-500 dark:text-slate-400 transition-all font-bold shadow-sm"
                        >
                          + {desig}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SortableItem>
        );
      case 'loadFactor':
        return (
          <SortableItem 
            id="loadFactor" 
            key="loadFactor" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-900 dark:text-slate-100 uppercase font-bold tracking-widest">Load Factor</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.loadFactor || ''}
                onChange={(e) => setDetectionData({...detectionData, loadFactor: e.target.value})}
                placeholder="Enter Load Factor"
                disabled={isDisabled}
                className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl py-2 px-3 text-neutral-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'loadItems':
        return (
          <SortableItem 
            id="loadItems" 
            key="loadItems" 
            className="md:col-span-2" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 uppercase font-bold tracking-widest">Detail of Connected Load</label>}
          >
            <div className={cn("space-y-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200", (isDisabled || isSlownessActive) && "opacity-50 pointer-events-none")}>
              <div className="flex items-center justify-end mb-2">
                <button
                  type="button"
                  disabled={isDisabled || isSlownessActive}
                  onClick={() => {
                    const newItems = [...(detectionData.loadItems || []), { name: '', qty: '', watts: '', total: 0 }];
                    setDetectionData({ ...detectionData, loadItems: newItems });
                  }}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <PlusCircle className="w-3 h-3" /> Add Item
                </button>
              </div>
              
              <div className="overflow-x-auto rounded-xl border border-neutral-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-100 text-neutral-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 w-20">Qty</th>
                      <th className="px-3 py-2 w-24">Watts</th>
                      <th className="px-3 py-2 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {(detectionData.loadItems || []).map((item, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 font-medium text-neutral-900">
                          <input
                            type="text"
                            value={item.name || ''}
                            disabled={isDisabled || isSlownessActive}
                            onChange={(e) => {
                              const newItems = [...(detectionData.loadItems || [])];
                              newItems[index].name = e.target.value;
                              setDetectionData({ ...detectionData, loadItems: newItems });
                            }}
                            placeholder="Description"
                            className="w-full bg-transparent focus:outline-none text-neutral-900 font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.qty || ''}
                            disabled={isDisabled || isSlownessActive}
                            onChange={(e) => {
                              const newItems = [...(detectionData.loadItems || [])];
                              const qty = parseFloat(e.target.value) || 0;
                              const watts = parseFloat(newItems[index].watts.toString()) || 0;
                              newItems[index].qty = e.target.value;
                              newItems[index].total = (qty * watts).toString();
                              setDetectionData({ ...detectionData, loadItems: newItems });
                            }}
                            placeholder="0"
                            className="w-full bg-transparent focus:outline-none text-neutral-900 font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.watts || ''}
                            disabled={isDisabled || isSlownessActive}
                            onChange={(e) => {
                              const newItems = [...(detectionData.loadItems || [])];
                              const watts = parseFloat(e.target.value) || 0;
                              const qty = parseFloat(newItems[index].qty.toString()) || 0;
                              newItems[index].watts = e.target.value;
                              newItems[index].total = (qty * watts).toString();
                              setDetectionData({ ...detectionData, loadItems: newItems });
                            }}
                            placeholder="0"
                            className="w-full bg-transparent focus:outline-none text-neutral-900 font-medium"
                          />
                        </td>
                        <td className="px-3 py-2 font-bold text-neutral-900">
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {(detectionData.loadItems || []).length > 0 && (
                    <tfoot className="bg-neutral-50 font-bold">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right text-neutral-500 uppercase text-[10px]">Total Connected Load (kW)</td>
                        <td className={cn(
                          "px-3 py-2",
                          ((detectionData.loadItems || []).reduce((sum, item) => sum + (parseFloat(item.total.toString()) || 0), 0) / 1000) > 6 
                            ? "text-indigo-600 font-bold animate-blink" 
                            : "text-neutral-900"
                        )}>
                          {((detectionData.loadItems || []).reduce((sum, item) => sum + (parseFloat(item.total.toString()) || 0), 0) / 1000).toFixed(3)} kW
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </SortableItem>
        );
      case 'remarks':
        return (
          <SortableItem 
            id="remarks" 
            key="remarks" 
            className="md:col-span-2" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={<label className="text-xs text-neutral-500 uppercase font-bold tracking-widest">Remarks</label>}
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <textarea
                rows={3}
                value={detectionData.remarks || ''}
                disabled={isDisabled}
                onChange={(e) => setDetectionData({...detectionData, remarks: e.target.value})}
                className={cn(
                  "w-full bg-white border border-neutral-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500",
                  (detectionData.remarks?.includes('Additional') && detectionData.remarks?.includes('Units charged')) && "text-indigo-600 font-bold"
                )}
                placeholder="Enter any additional observations..."
              />
            </div>
          </SortableItem>
        );
      case 'employeeName':
        return (
          <SortableItem 
            id="employeeName" 
            key="employeeName" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center gap-1.5 justify-between w-full">
                <label className="text-xs text-neutral-500 uppercase font-bold tracking-widest">SDO NAME</label>
                <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase dark:bg-teal-950/40 dark:border-teal-800">Synced Roster</span>
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <div className="relative group/field">
                <input
                  type="text"
                  value={detectionData.employeeName || ''}
                  onChange={(e) => {
                    setDetectionData({...detectionData, employeeName: e.target.value});
                    if (aiUrduTranslations['employeeName']) {
                      setAiUrduTranslations(prev => {
                        const next = { ...prev };
                        delete next['employeeName'];
                        return next;
                      });
                    }
                  }}
                  placeholder="Enter SDO NAME"
                  disabled={isDisabled}
                  className="w-full bg-white border border-neutral-200 rounded-xl py-2 pl-3 pr-10 text-neutral-900 font-medium focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleTranslateField('employeeName', detectionData.employeeName)}
                  disabled={isDisabled || !detectionData.employeeName || isTranslating === 'employeeName'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-30"
                  title="Translate to Urdu"
                >
                  {isTranslating === 'employeeName' ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Languages className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence mode="wait">
                {(detectionData.employeeName || aiUrduTranslations['employeeName'] || isTranslating === 'employeeName') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="mt-1 flex justify-end items-center gap-2 pb-1" 
                    dir="rtl"
                  >
                    <span className={cn(
                      "text-sm font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 urdu-font transition-colors",
                      isTranslating === 'employeeName' ? "text-neutral-400 animate-pulse" : "text-indigo-600"
                    )}>
                      {isTranslating === 'employeeName' ? 'ترجمہ ہو رہا ہے...' : (detectionData.employeeNameUrdu || aiUrduTranslations['employeeName'] || translateToUrdu(detectionData.employeeName))}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </SortableItem>
        );
      case 'employeeNameUrdu':
        return (
          <SortableItem 
            id="employeeNameUrdu" 
            key="employeeNameUrdu" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center gap-1.5 justify-between w-full">
                <label className="text-xs text-neutral-500 uppercase font-bold tracking-widest text-indigo-600">SDO NAME (Urdu)</label>
                <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase dark:bg-teal-950/40 dark:border-teal-800">Synced Roster</span>
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.employeeNameUrdu || ''}
                onChange={(e) => setDetectionData({...detectionData, employeeNameUrdu: e.target.value})}
                placeholder="ملازم کا نام"
                disabled={isDisabled}
                dir="rtl"
                className="w-full bg-indigo-50/30 border border-indigo-100 rounded-xl py-2 px-3 text-neutral-900 font-bold urdu-font focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'employeeDesignation':
        return (
          <SortableItem 
            id="employeeDesignation" 
            key="employeeDesignation" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center gap-1.5 justify-between w-full">
                <label className="text-xs text-neutral-500 uppercase font-bold tracking-widest">Designation</label>
                <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase dark:bg-teal-950/40 dark:border-teal-800">Synced Roster</span>
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.employeeDesignation || ''}
                onChange={(e) => setDetectionData({...detectionData, employeeDesignation: e.target.value})}
                placeholder="Enter Designation"
                disabled={isDisabled}
                className="w-full bg-white border border-neutral-200 rounded-xl py-2 px-3 text-neutral-900 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'employeeCnic':
        return (
          <SortableItem 
            id="employeeCnic" 
            key="employeeCnic" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center gap-1.5 justify-between w-full">
                <label className="text-xs text-neutral-500 uppercase font-bold tracking-widest">SDO CNIC</label>
                <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase dark:bg-teal-950/40 dark:border-teal-800">Synced Roster</span>
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.employeeCnic || ''}
                onChange={(e) => setDetectionData({...detectionData, employeeCnic: e.target.value})}
                placeholder="Enter SDO CNIC (e.g. 35404-1234567-1)"
                disabled={isDisabled}
                className="w-full bg-white border border-neutral-200 rounded-xl py-2 px-3 text-neutral-900 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      case 'employeeMobile':
        return (
          <SortableItem 
            id="employeeMobile" 
            key="employeeMobile" 
            serialNo={serialNo} 
            onSerialNoChange={onSerialNoChange}
            label={
              <div className="flex items-center gap-1.5 justify-between w-full">
                <label className="text-xs text-neutral-500 uppercase font-bold tracking-widest">SDO Mobile</label>
                <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100 uppercase dark:bg-teal-950/40 dark:border-teal-800">Synced Roster</span>
              </div>
            }
          >
            <div className={cn(isDisabled && "opacity-50 pointer-events-none")}>
              <input
                type="text"
                value={detectionData.employeeMobile || ''}
                onChange={(e) => setDetectionData({...detectionData, employeeMobile: e.target.value})}
                placeholder="Enter SDO Mobile (e.g. 0321-1234567)"
                disabled={isDisabled}
                className="w-full bg-white border border-neutral-200 rounded-xl py-2 px-3 text-neutral-900 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>
          </SortableItem>
        );
      default:
        return null;
    }
  }, [detectionData, handleSerialNoChange, billData, acMaxEffective, acMin, isSaving, isFetching, showMeterMismatch, showReadingMismatch, isMeterVerified, isReadingVerified, acMin, acMaxEffective]);
  const isMonthAvailableInBill = (monthStr: string) => {
    if (!monthStr || !billData) return true;
    const date = new Date(monthStr);
    if (isNaN(date.getTime())) return true;
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthName = monthNames[date.getMonth()].toUpperCase();
    const year = date.getFullYear();
    const shortYear = (year % 100).toString().padStart(2, '0');

    // Check billing month
    if (billData.billingMonth) {
      const parts = billData.billingMonth.toUpperCase().split(/[- ]+/).filter(Boolean);
      if (parts[0]?.startsWith(monthName) && (parts[1] === year.toString() || parts[1] === shortYear)) {
        return true;
      }
    }

    // Check monthWiseUnits
    if (billData.monthWiseUnits) {
      return billData.monthWiseUnits.some(u => {
        const parts = u.month.toUpperCase().split(/[- ]+/).filter(Boolean);
        return parts[0]?.startsWith(monthName) && (parts[1] === year.toString() || parts[1] === shortYear);
      });
    }

    return false;
  };


  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('lesco_bill_data', safeStringify(billData));
    }, 1000);
    return () => clearTimeout(timer);
  }, [billData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('lesco_detection_data', safeStringify(detectionData));
    }, 1000);
    return () => clearTimeout(timer);
  }, [detectionData]);

  const isSlownessActive = detectionData.discrepancy.includes('Meter Slow By');

  useEffect(() => {
    const totalWatts = (detectionData.loadItems || []).reduce((sum, item) => sum + (parseFloat(item.total.toString()) || 0), 0);
    const totalKW = (totalWatts / 1000).toFixed(3) + ' kW';
    if (detectionData.connectedLoad !== totalKW) {
      setDetectionData(prev => ({ ...prev, connectedLoad: totalKW }));
    }
  }, [detectionData.loadItems]);

  useEffect(() => {
    // Skip load-based calculation if "Meter Slow By" is active
    if (detectionData.discrepancy.includes('Meter Slow By')) return;

    const loadKW = parseFloat(detectionData.connectedLoad.replace(/[^0-9.]/g, '')) || 0;
    let loadFactor = 0;
    if (detectionData.loadFactor.includes('%')) {
      loadFactor = parseFloat(detectionData.loadFactor.replace('%', '')) / 100;
    } else {
      loadFactor = parseFloat(detectionData.loadFactor) || 0;
    }
    const months = parseFloat(detectionData.detectionPeriodMonths) || 0;
    
    const assessed = Math.round(loadKW * loadFactor * 730 * months);
    if (detectionData.unitsAssessed !== assessed.toString() && (loadKW > 0 || loadFactor > 0 || months > 0 || assessed === 0)) {
      setDetectionData(prev => {
        const loadRemark = 'Detection Bill charged as Per Connected Load';
        
        let lines = prev.remarks ? prev.remarks.split('\n').map(l => l.replace(/^\d+-\s*/, '').trim()).filter(Boolean) : [];
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
        
        const finalRemarks = lines.length > 1 ? lines.map((l, i) => {
          let line = l;
          if (line.toLowerCase().includes('detection bill charged as per connected load') && !line.endsWith('.')) line += '.';
           return `${i + 1}-${line}`;
        }).join('\n') : lines[0] || '';
        
        return { 
          ...prev, 
          unitsAssessed: assessed > 0 ? assessed.toString() : '',
          remarks: finalRemarks
        };
      });
    }
  }, [detectionData.connectedLoad, detectionData.loadFactor, detectionData.detectionPeriodMonths, detectionData.discrepancy]);

  useEffect(() => {
    if (showMeterMismatch && billData?.meterNoOnBill === detectionData.meterNumber) {
      setShowMeterMismatch(false);
    }
  }, [billData?.meterNoOnBill, detectionData.meterNumber, showMeterMismatch]);

  React.useEffect(() => {
    if (detectionData.detectionPeriodFrom && detectionData.detectionPeriodTo) {
      const from = new Date(detectionData.detectionPeriodFrom);
      const to = new Date(detectionData.detectionPeriodTo);
      
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
        if (diffMonths > 0) {
          setDetectionData(prev => ({ ...prev, detectionPeriodMonths: diffMonths.toString() }));
        }
      }
    }
  }, [detectionData.detectionPeriodFrom, detectionData.detectionPeriodTo]);

  React.useEffect(() => {
    if (isSlownessActive) {
      setDetectionData(prev => {
        const slowness = prev.meterSlowBy || '';
        const slownessRemark = `Detection Bill charged As per Slowness ${slowness}`;
        if (prev.unitsOfAcPeriod === '' && prev.remarks === slownessRemark) return prev;
        return { ...prev, unitsOfAcPeriod: '', remarks: slownessRemark };
      });
      return;
    }

    const split = parseInt(detectionData.splitAcCount?.toString() || '0');
    const window = parseInt(detectionData.windowAcCount?.toString() || '0');
    const months = parseInt(detectionData.acPeriodMonths?.toString() || '0');
    
    if (months > 0 && (split > 0 || window > 0)) {
      const units = ((split * 600) + (window * 900)) * months;
      
      const from = detectionData.acPeriodFrom ? new Date(detectionData.acPeriodFrom) : null;
      const to = detectionData.acPeriodTo ? new Date(detectionData.acPeriodTo) : null;
      
      const fromStr = from ? `${(from.getMonth() + 1).toString().padStart(2, '0')}-${from.getFullYear()}` : '';
      const toStr = to ? `${(to.getMonth() + 1).toString().padStart(2, '0')}-${to.getFullYear()}` : '';
      
      const acParts = [];
      if (split > 0) acParts.push(`${split} Split`);
      if (window > 0) acParts.push(`${window} Window`);
      const acDescription = acParts.join(' & ');
      const totalACs = split + window;
      const acWord = totalACs === 1 ? 'AC' : 'ACs';
      const monthWord = months === 1 ? 'Month' : 'Months';
      
      const equation = `Additional ${units} Units charged of ${totalACs} No. ${acWord} (${acDescription}) for the month ${fromStr} To ${toStr} (${months} ${monthWord})`;
      
      setDetectionData(prev => {
        // Remove both old formats if present
        let cleanRemarks = prev.remarks ? prev.remarks.replace(/Units =.*/g, '').replace(/.*Units charged.*/g, '').replace(/.*Additional Units charged.*/g, '').trim() : '';
        
        let lines = cleanRemarks.split('\n').map(l => l.replace(/^\d+-\s*/, '').trim()).filter(Boolean);
        lines.push(equation);
        
        const loadIdx = lines.findIndex(l => l.toLowerCase().includes('detection bill charged as per connected load'));
        if (loadIdx > 0) {
          const loadLine = lines.splice(loadIdx, 1)[0];
          lines.unshift(loadLine);
        }
        
        const newRemarks = lines.length > 1 ? lines.map((l, i) => {
          let line = l;
          if (line.toLowerCase().includes('detection bill charged as per connected load') && !line.endsWith('.')) line += '.';
          return `${i + 1}-${line}`;
        }).join('\n') : lines[0] || '';
        
        if (prev.unitsOfAcPeriod === units.toString() && prev.remarks === newRemarks) return prev;
        return { ...prev, unitsOfAcPeriod: units.toString(), remarks: newRemarks };
      });
    } else if (detectionData.unitsOfAcPeriod !== '' || (detectionData.remarks && (detectionData.remarks.includes('Units charged') || detectionData.remarks.includes('Units =') || detectionData.remarks.includes('Additional Units charged')))) {
      setDetectionData(prev => {
        let cleanRemarks = prev.remarks ? prev.remarks.replace(/Units =.*/g, '').replace(/.*Units charged.*/g, '').replace(/.*Additional Units charged.*/g, '').trim() : '';
        let lines = cleanRemarks.split('\n').map(l => l.replace(/^\d+-\s*/, '').trim()).filter(Boolean);
        
        const loadIdx = lines.findIndex(l => l.toLowerCase().includes('detection bill charged as per connected load'));
        if (loadIdx > 0) {
          const loadLine = lines.splice(loadIdx, 1)[0];
          lines.unshift(loadLine);
        }
        
        const newRemarks = lines.length > 1 ? lines.map((l, i) => {
          let line = l;
          if (line.toLowerCase().includes('detection bill charged as per connected load') && !line.endsWith('.')) line += '.';
          return `${i + 1}-${line}`;
        }).join('\n') : lines[0] || '';
        if (prev.unitsOfAcPeriod === '' && prev.remarks === newRemarks) return prev;
        return { ...prev, unitsOfAcPeriod: '', remarks: newRemarks };
      });
    }
  }, [detectionData.splitAcCount, detectionData.windowAcCount, detectionData.acPeriodMonths, detectionData.acPeriodFrom, detectionData.acPeriodTo, isSlownessActive]);

  React.useEffect(() => {
    if (detectionData.detectionPeriodFrom && detectionData.detectionPeriodTo && billData?.monthWiseUnits) {
      const from = new Date(detectionData.detectionPeriodFrom);
      const to = new Date(detectionData.detectionPeriodTo);
      
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        let totalUnits = 0;
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        let currentDate = new Date(from.getFullYear(), from.getMonth(), 1);
        const toDate = new Date(to.getFullYear(), to.getMonth(), 1);
        
        while (currentDate <= toDate) {
          const monthIdx = currentDate.getMonth();
          const monthName = monthNames[monthIdx];
          const year = currentDate.getFullYear();
          
          const isMonthMatch = (mStr: string, yStr: string) => {
            if (!mStr || !yStr) return false;
            const yearMatch = yStr === year.toString() || yStr === (year % 100).toString();
            if (!yearMatch) return false;
            
            if (isNaN(parseInt(mStr))) {
              return mStr.toUpperCase().substring(0, 3) === monthName.toUpperCase();
            }
            return parseInt(mStr) === monthIdx + 1;
          };

          let isBillingMonth = false;
          if (billData.billingMonth) {
            const parts = billData.billingMonth.split(/[- ]+/).filter(Boolean);
            if (parts.length >= 2) {
              if (isMonthMatch(parts[0], parts[1]) || isMonthMatch(parts[1], parts[0])) {
                isBillingMonth = true;
              }
            }
          }

          if (isBillingMonth) {
            const diffVal = parseInt(billData.difference?.toString().replace(/,/g, '') || '0') || 0;
            totalUnits += diffVal;
          } else {
            const unitsForMonth = billData.monthWiseUnits.filter(u => {
              if (!u.month) return false;
              const parts = u.month.split(/[- ]+/).filter(Boolean);
              if (parts.length < 2) return false;
              return isMonthMatch(parts[0], parts[1]) || isMonthMatch(parts[1], parts[0]);
            });
            
            unitsForMonth.forEach(unitData => {
              const units = parseInt(unitData.units?.toString().replace(/,/g, '') || '0') || 0;
              totalUnits += units;
            });
          }
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        let assessed = parseInt(detectionData.unitsAssessed) || 0;
        
        // Meter Slow By Calculation: (Adv units * 100) / (100 - slowness%)
        if (detectionData.discrepancy.includes('Meter Slow By') && detectionData.meterSlowBy) {
          const slowness = parseInt(detectionData.meterSlowBy.replace('%', '')) || 0;
          if (slowness > 0 && slowness < 100) {
            assessed = Math.round((totalUnits * 100) / (100 - slowness));
          }
        }

        const net = assessed - totalUnits;
        const finalNetDisplay = net < 0 ? 'D.BILL IS NOT JUSTIFIED AS PER CONNECTED LOAD' : net.toString();
        
        const updates: Partial<typeof detectionData> = {};
        if (detectionData.unitsAlreadyCharged !== totalUnits.toString()) {
          updates.unitsAlreadyCharged = totalUnits.toString();
        }
        if (detectionData.netUnitsToBeCharged !== finalNetDisplay) {
          updates.netUnitsToBeCharged = finalNetDisplay;
        }
        if (detectionData.discrepancy.includes('Meter Slow By') && detectionData.unitsAssessed !== assessed.toString()) {
          updates.unitsAssessed = assessed.toString();
        }

        if (Object.keys(updates).length > 0) {
          setDetectionData(prev => {
            let finalRemarks = prev.remarks;
            
            if (detectionData.discrepancy.includes('Meter Slow By') && updates.unitsAssessed) {
              const slowness = detectionData.meterSlowBy;
              // Simplified remark as requested: Detection Bill charged As per Slowness....%
              finalRemarks = `Detection Bill charged As per Slowness ${slowness}`;
            }

            return { 
              ...prev, 
              ...updates,
              remarks: finalRemarks
            };
          });
        }
      }
    }
  }, [detectionData.detectionPeriodFrom, detectionData.detectionPeriodTo, billData, detectionData.unitsAssessed, detectionData.discrepancy, detectionData.meterSlowBy]);

  React.useEffect(() => {
    const netUnitsStr = detectionData.netUnitsToBeCharged || '0';
    const acUnits = parseInt(detectionData.unitsOfAcPeriod) || 0;
    
    let grandTotalStr = '';
    let totalUnitsForLoss = 0;
    if (netUnitsStr === 'D.BILL IS NOT JUSTIFIED AS PER CONNECTED LOAD') {
      grandTotalStr = acUnits > 0 ? `0 + ${acUnits} = ${acUnits.toLocaleString()}` : '0';
      totalUnitsForLoss = acUnits;
    } else {
      const netUnits = parseInt(netUnitsStr) || 0;
      grandTotalStr = (netUnits + acUnits).toLocaleString();
      totalUnitsForLoss = netUnits + acUnits;
    }

    const calculatedLossAmount = (totalUnitsForLoss * 60).toString();

    if (detectionData.grandTotalUnits !== grandTotalStr || detectionData.lossAmount !== calculatedLossAmount) {
      setDetectionData(prev => ({
        ...prev,
        grandTotalUnits: grandTotalStr,
        lossAmount: calculatedLossAmount
      }));
    }
  }, [detectionData.netUnitsToBeCharged, detectionData.unitsOfAcPeriod, detectionData.lossAmount, detectionData.grandTotalUnits]);

  React.useEffect(() => {
    if (billData) {
      const newTariff = billData.tariff || billData.connectionType || '';
      let newLoadFactor = '';
      if (newTariff.includes('(01)') || newTariff === '01') newLoadFactor = '20%';
      else if (newTariff.includes('(04)') || newTariff === '04') newLoadFactor = '30%';

      setDetectionData(prev => ({
        ...prev,
        name: billData.consumerName || prev.name,
        address: billData.address || prev.address,
        sanctionLoad: billData.sanctionedLoad || prev.sanctionLoad,
        customerId: billData.customerId || prev.customerId || '',
        tariff: newTariff || prev.tariff,
        loadFactor: newLoadFactor || prev.loadFactor,
        previousReading: billData.previousReading || prev.previousReading || '',
        difference: (() => {
          const present = parseInt(billData.presentReading?.toString().replace(/,/g, '') || '0');
          const previous = parseInt(billData.previousReading?.toString().replace(/,/g, '') || '0');
          const diff = present - previous;
          return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
        })(),
        billingMonth: billData.billingMonth || prev.billingMonth || '',
        presentReading: billData.presentReading || prev.presentReading || '',
      }));
    }
  }, [billData]);

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isScanningCamera, setIsScanningCamera] = useState(false);

  const startCamera = async (isScanning: boolean = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
      setIsScanningCamera(isScanning);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setIsScanningCamera(false);
  };

  const takePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.videoWidth < 300 || video.videoHeight < 300) {
        toast.error("Camera resolution too low. Please use a better camera or upload a file.");
        stopCamera();
        return;
      }
      
      // Resize logic
      const MAX_DIM = 800;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > height) {
        if (width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        if (isScanningCamera) {
          stopCamera();
          setIsScanning(true);
          setError('');
          try {
            const data = await extractBillData(dataUrl);
            if (data) {
              const scannedRef = data.referenceNumber || "";
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
                  const errMsg = `Scanning restricted! This bill (Reference: ${scannedRef || 'None'}) does not belong to your subdivision (${subDiv}).`;
                  toast.error(errMsg);
                  setError(errMsg);
                  setIsScanning(false);
                  return;
                }
              }

              if (data.referenceNumber) {
                setReferenceNumber(data.referenceNumber.replace(/[^0-9]/g, ''));
              }
              
              setBillData({
                consumerName: data.consumerName || "",
                address: data.address || "",
                referenceNumber: data.referenceNumber?.replace(/[^0-9]/g, '') || "",
                unitsConsumed: 0,
                amountDue: 0,
                billingMonth: data.billingMonth && data.billingMonth !== "N/A" ? data.billingMonth : "",
                sanctionedLoad: data.sanctionedLoad || "",
                connectionType: data.tariff || "",
                meterNoOnBill: data.meterNoOnBill || "",
                subDivisionName: data.subDivisionName || "",
                feederName: data.feederName || "",
                meterStatus: data.meterStatus || "",
                customerId: data.customerId || "",
                tariff: data.tariff || "",
                currentBill: parseFloat(data.currentBill?.toString().replace(/[^0-9.]/g, '')) || 0,
                deferredAmount: parseFloat(data.deferredAmount?.toString().replace(/[^0-9.]/g, '')) || 0,
                presentReading: data.presentReading || "",
                previousReading: data.previousReading || "",
                difference: (() => {
                  if (data.consumedUnits && data.consumedUnits !== "N/A") {
                    return data.consumedUnits.toString().replace(/[^0-9]/g, '');
                  }
                  const present = parseInt(data.presentReading?.toString().replace(/[^0-9]/g, '') || '0');
                  const previous = parseInt(data.previousReading?.toString().replace(/[^0-9]/g, '') || '0');
                  const diff = present - previous;
                  return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
                })(),
                monthWiseUnitsConsumed: "",
                monthWiseUnits: data.monthWiseUnits?.map((item: any) => {
                  const cleanValue = (val: any) => {
                    const str = val?.toString()?.trim() || '';
                    return str.toUpperCase() === 'N/A' ? '' : str;
                  };
                  return {
                    month: cleanValue(item.month),
                    reading: cleanValue(item.reading),
                    units: cleanValue(item.units),
                    bill: cleanValue(item.bill),
                    adj: cleanValue(item.adj),
                    payment: cleanValue(item.payment),
                  };
                }) || [],
              });

              setDetectionData(prev => ({
                ...prev,
                meterStatus: data.meterStatus || "",
                feederName: data.feederName || "",
                meterNumber: data.meterNoOnBill || "",
                consumerName: data.consumerName || "",
                address: data.address || "",
                referenceNumber: data.referenceNumber?.replace(/[^0-9]/g, '') || ""
              }));
              
              toast.success('Bill data extracted successfully');
              setStep(3);
            } else {
              setError('Could not extract data from the image. Please try a clearer photo or manual entry.');
            }
          } catch (err: any) {
            console.error("OCR error:", err);
            setError(err.message || "Failed to scan image.");
          } finally {
            setIsScanning(false);
          }
        } else {
          setPhoto(dataUrl);
          stopCamera();
        }
      }
    }
  };

  const printRefDetectionBill = useRef<HTMLDivElement>(null);
  const printRefNotice = useRef<HTMLDivElement>(null);
  const printRefFIR = useRef<HTMLDivElement>(null);
  const printRefFIRUrdu = useRef<HTMLDivElement>(null);
  const printRefRegister = useRef<HTMLDivElement>(null);

  const printTemplate = (ref: React.RefObject<HTMLDivElement>, shouldPrint: boolean = true, type?: string) => {
    const content = ref.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError("Popup blocked! Please allow popups for this site to view/print templates.");
      return;
    }
    printWindow.document.write(`<html><head><title>${shouldPrint ? 'Print' : 'Preview'}</title>`);
    printWindow.document.write(`<meta name="viewport" content="width=device-width, initial-scale=1.0">`);
    
    // Copy all styles from the current document
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach(style => {
      printWindow.document.write(style.outerHTML);
    });

    let pageCss = '';
    if (type === 'NOTICE') {
      pageCss = `@page { size: A4; margin: 2.54cm; }`;
    }

    printWindow.document.write(`<style>
      @media print { 
        body { -webkit-print-color-adjust: exact; background-color: white !important; } 
        #zoom-controls { display: none !important; }
        .preview-container { padding: 0 !important; }
        ${pageCss}
      }
      body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: sans-serif; }
      .preview-container { 
        padding: ${shouldPrint ? '10px' : '60px 10px 20px'}; 
        display: flex; 
        flex-direction: column;
        align-items: center; 
        min-height: 100vh;
        box-sizing: border-box;
        overflow: auto;
      }
      .preview-container > div { 
        background: white;
        box-shadow: ${shouldPrint ? 'none' : '0 4px 20px rgba(0,0,0,0.1)'};
        transform-origin: top center;
        transition: transform 0.1s ease-out;
        ${shouldPrint ? '' : 'margin-bottom: 20px;'}
      }
      #zoom-controls {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(8px);
        padding: 6px 12px;
        border-radius: 999px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(0,0,0,0.1);
      }
      .zoom-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: none;
        background: #ef4444;
        color: white;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .zoom-btn:hover { background: #dc2626; transform: scale(1.1); }
      .zoom-btn:active { transform: scale(0.95); }
      .zoom-text { font-size: 13px; font-weight: 600; color: #374151; min-width: 40px; text-align: center; }
      .reset-btn {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: white;
        color: #4b5563;
        cursor: pointer;
      }
      .reset-btn:hover { background: #f3f4f6; }

      @media (max-width: 820px) {
        .preview-container { padding: ${shouldPrint ? '0' : '60px 0 20px'}; display: block; overflow-x: auto; }
        .preview-container > div { 
          ${shouldPrint ? 'transform: scale(var(--scale-factor, 1));' : ''}
          transform-origin: top left; 
          width: 800px !important; 
          max-width: 800px !important;
          margin: 0 !important;
        }
      }
    </style>`);
    
    if (!shouldPrint) {
      printWindow.document.write(`
        <script>
          let manualScale = 1;
          function setScale() {
            const container = document.querySelector('.preview-container > div');
            if (!container) return;
            
            let baseScale = 1;
            if (window.innerWidth < 820) {
              baseScale = window.innerWidth / 800;
            }
            
            const finalScale = baseScale * manualScale;
            container.style.transform = "scale(" + finalScale + ")";
            container.style.transformOrigin = window.innerWidth < 820 ? 'top left' : 'top center';
            
            const zoomLevelEl = document.getElementById('zoom-level');
            if (zoomLevelEl) zoomLevelEl.innerText = Math.round(manualScale * 100) + '%';
          }
          
          function zoomIn() { manualScale += 0.1; setScale(); }
          function zoomOut() { if(manualScale > 0.2) manualScale -= 0.1; setScale(); }
          function resetZoom() { manualScale = 1; setScale(); }
          
          window.addEventListener('resize', setScale);
          window.addEventListener('load', setScale);
          setTimeout(setScale, 100);
        </script>
      `);
    } else {
      printWindow.document.write(`
        <script>
          function setScale() {
            if (window.innerWidth < 820) {
              document.documentElement.style.setProperty('--scale-factor', window.innerWidth / 800);
            } else {
              document.documentElement.style.setProperty('--scale-factor', 1);
            }
          }
          window.addEventListener('resize', setScale);
          setScale();
        </script>
      `);
    }

    const zoomControls = shouldPrint ? '' : `
      <div id="zoom-controls">
        <button class="zoom-btn" onclick="zoomOut()">-</button>
        <span class="zoom-text" id="zoom-level">100%</span>
        <button class="zoom-btn" onclick="zoomIn()">+</button>
        <button class="reset-btn" onclick="resetZoom()">Reset</button>
      </div>
    `;

    printWindow.document.write(`</head><body>${zoomControls}<div class="preview-container">${content.innerHTML}</div></body></html>`);
    printWindow.document.close();
    
    if (shouldPrint) {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const triggerPrint = (type: any, shouldPrint: boolean = true) => {
    let ref = null;
    if (type === 'DETECTION BILL PROFORMA') ref = printRefDetectionBill;
    else if (type === 'NOTICE') ref = printRefNotice;
    else if (type === 'FIR Request') ref = printRefFIR;
    else if (type === 'FIR Urdu') ref = printRefFIRUrdu;
    else if (type === 'Detection Register') ref = printRefRegister;
    
    if (ref) {
        printTemplate(ref, shouldPrint, type);
    }
  };

  const downloadAsJpeg = async (type: string) => {
    let ref = null;
    if (type === 'DETECTION BILL PROFORMA') ref = printRefDetectionBill;
    else if (type === 'NOTICE') ref = printRefNotice;
    else if (type === 'FIR Request') ref = printRefFIR;
    else if (type === 'FIR Urdu') ref = printRefFIRUrdu;
    else if (type === 'Detection Register') ref = printRefRegister;

    if (ref && ref.current) {
      try {
        const dataUrl = await domToJpeg(ref.current, {
          scale: 3,
          quality: 0.95,
          backgroundColor: '#ffffff',
        });
        
        const link = document.createElement('a');
        const fileName = type === 'DETECTION BILL PROFORMA' 
          ? `D.Bill_Performa_${billData?.referenceNumber || 'Case'}.jpg`
          : `${type.replace(/\s+/g, '_')}_${billData?.referenceNumber || 'Case'}.jpg`;
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error('Error generating JPEG:', err);
        toast.error('Failed to generate JPEG. Please try again.');
      }
    }
  };

  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [isUploadedToDrive, setIsUploadedToDrive] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(localStorage.getItem('google_drive_token'));

  const connectDriveAndUpload = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_drive_token', credential.accessToken);
        setDriveToken(credential.accessToken);
        toast.success('Drive connected! You can now upload the templates.');
      }
    } catch (err: any) {
      toast.error('Failed to connect: ' + err.message);
    }
  };

  const handleBulkUploadToDrive = async () => {
    if (isUploadingRef.current || isUploadedToDrive) return;
    
    let googleTokens = localStorage.getItem('google_drive_token');
    const webhookUrl = user?.webhookUrl || localStorage.getItem('google_sheets_webhook') || 'https://script.google.com/macros/s/AKfycbzFThMoqFExs2O_Gry9SrcZ_4W-RuFI7jADKEDf0Rq8LKBgxnO-IpK9yzdsRu-CNerp/exec';
    const webhookUrl2 = user?.webhookUrl2 || localStorage.getItem('google_sheets_webhook_2') || '';
    
    if (!googleTokens && !webhookUrl && !webhookUrl2) {
      toast('No Google account or webhook is linked', {
        description: 'Please connect Google Drive or configure sheets in the Admin area.'
      });
      return;
    }

    try {
      isUploadingRef.current = true;
      setIsBulkUploading(true);
      toast.loading('Creating combined PDF of the case...', { id: 'bulkUpload' });
      
      const templates = ['DETECTION BILL PROFORMA', 'NOTICE', 'FIR Urdu'];
      
      // Give time for DOM to ensure refs are attached
      await new Promise(resolve => setTimeout(resolve, 500));

      let folderId = null;
      let existingFiles: any[] = [];
      
      if (googleTokens) {
        try {
          const { createOrGetFolder, listFilesFromGoogleDrive } = await import('../lib/googleDrive');
          folderId = await createOrGetFolder(googleTokens, 'My Assistant');
          existingFiles = await listFilesFromGoogleDrive(googleTokens, folderId);
        } catch (folderErr: any) {
          if (folderErr.message.includes('expired')) {
            localStorage.removeItem('google_drive_token');
            setDriveToken(null);
            toast.error('Personal Drive access expired. Google Sheets Webhooks will still receive sync.', { id: 'bulkUpload' });
            googleTokens = null;
          } else {
            console.error(`Personal Drive error: ${folderErr.message}`);
            googleTokens = null;
          }
        }
      }

      let finalFileName = `Case_${billData?.referenceNumber || 'Templates'}.pdf`;

      // Check if this case PDF already exists in personal Drive
      if (googleTokens && folderId && existingFiles.some(f => f.name === finalFileName)) {
        // If it exists, try to make it unique by adding checking date
        const dateStr = detectionData.dateOfChecking ? `_Checked_${detectionData.dateOfChecking.replace(/[/\\?%*:|"<>]/g, '-')}` : '';
        finalFileName = `Case_${billData?.referenceNumber || 'Templates'}${dateStr}.pdf`;
      }

      const pdf = new jsPDF('p', 'mm', 'a4');
      let pageCount = 0;

      for (const type of templates) {
        let templateRef = null;
        if (type === 'DETECTION BILL PROFORMA') templateRef = printRefDetectionBill;
        else if (type === 'NOTICE') templateRef = printRefNotice;
        else if (type === 'FIR Urdu') templateRef = printRefFIRUrdu;

        if (templateRef && templateRef.current) {
          try {
            toast.loading(`Capturing ${type}...`, { id: 'bulkUpload' });
            // Wait slightly between captures
            await new Promise(resolve => setTimeout(resolve, 400));

            const dataUrl = await domToJpeg(templateRef.current, {
              scale: 2,
              quality: 0.92,
              backgroundColor: '#ffffff',
            });

            if (pageCount > 0) {
              pdf.addPage();
            }

            // A4 dimensions are 210 x 297 mm
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
            pageCount++;
          } catch (itemErr: any) {
            console.error(`Item ${type} failed to capture:`, itemErr);
          }
        }
      }
      
      if (pageCount > 0) {
        toast.loading('Syncing case files with drive folders...', { id: 'bulkUpload' });
        
        const pdfBlob = pdf.output('blob');
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(pdfBlob);
        });

        // 1. Upload to personal drive
        if (googleTokens && folderId) {
          const { uploadToGoogleDrive } = await import('../lib/googleDrive');
          await uploadToGoogleDrive(googleTokens, folderId, dataUrl, finalFileName, 'application/pdf');
        }

        // 2. Sync PDF with both Google Sheets webhooks
        const fileBase64 = dataUrl.split(',')[1];
        const webhookPromises: Promise<any>[] = [];

        if (webhookUrl) {
          webhookPromises.push(
            fetch('/api/webhook-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                webhookUrl,
                payload: {
                  action: "uploadFile",
                  fileName: finalFileName,
                  fileType: "application/pdf",
                  fileData: fileBase64,
                  subDivision: billData?.subDivisionName || ""
                }
              }),
            }).then(async (res) => {
              if (!res.ok) throw new Error("Webhook 1 error");
              console.log('Case PDF automatically saved to Webhook 1');
            }).catch(e => console.error('Failed to sync PDF to Webhook 1:', e))
          );
        }

        if (webhookUrl2) {
          webhookPromises.push(
            fetch('/api/webhook-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                webhookUrl: webhookUrl2,
                payload: {
                  action: "uploadFile",
                  fileName: finalFileName,
                  fileType: "application/pdf",
                  fileData: fileBase64,
                  subDivision: billData?.subDivisionName || ""
                }
              }),
            }).then(async (res) => {
              if (!res.ok) throw new Error("Webhook 2 error");
              console.log('Case PDF automatically saved to Webhook 2');
            }).catch(e => console.error('Failed to sync PDF to Webhook 2:', e))
          );
        }

        // 3. If an evidence photograph is captured, also sync that photo to Google Drive
        let savedPhoto = localStorage.getItem('lesco_new_case_photo') || photo;
        if (savedPhoto) {
          const photoBase64 = savedPhoto.split(',')[1];
          const photoMimeType = savedPhoto.split(';')[0].split(':')[1] || 'image/jpeg';
          const extension = photoMimeType.split('/')[1] || 'jpeg';
          const photoName = `Case_${billData?.referenceNumber || 'Photo'}_Evidence.${extension}`;

          if (googleTokens && folderId) {
            const { uploadToGoogleDrive } = await import('../lib/googleDrive');
            try {
              await uploadToGoogleDrive(googleTokens, folderId, savedPhoto, photoName, photoMimeType);
            } catch (err) {
              console.error('Failed to upload evidence photograph to personal drive:', err);
            }
          }

          if (webhookUrl) {
            webhookPromises.push(
              fetch('/api/webhook-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  webhookUrl,
                  payload: {
                    action: "uploadFile",
                    fileName: photoName,
                    fileType: photoMimeType,
                    fileData: photoBase64,
                    subDivision: billData?.subDivisionName || ""
                  }
                }),
              }).then(res => {
                if (res.ok) console.log('Evidence photograph synced to Webhook 1 Drive');
              }).catch(e => console.error('Photo sync webhook 1 failed:', e))
            );
          }

          if (webhookUrl2) {
            webhookPromises.push(
              fetch('/api/webhook-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  webhookUrl: webhookUrl2,
                  payload: {
                    action: "uploadFile",
                    fileName: photoName,
                    fileType: photoMimeType,
                    fileData: photoBase64,
                    subDivision: billData?.subDivisionName || ""
                  }
                }),
              }).then(res => {
                if (res.ok) console.log('Evidence photograph synced to Webhook 2 Drive');
              }).catch(e => console.error('Photo sync webhook 2 failed:', e))
            );
          }
        }

        if (webhookPromises.length > 0) {
          await Promise.all(webhookPromises);
        }
        
        setIsUploadedToDrive(true);
        toast.success(`Successfully uploaded documents to Google Drive!`, { 
          id: 'bulkUpload',
          description: finalFileName
        });
      } else {
        toast.error('Could not capture templates. Please try again.', { id: 'bulkUpload' });
      }
    } catch (err: any) {
      console.error('Bulk upload error:', err);
      toast.error(`Sync Failed: ${err.message || 'Unknown error'}`, { id: 'bulkUpload' });
    } finally {
      setIsBulkUploading(false);
      isUploadingRef.current = false;
    }
  };

  const processFile = (file: File) => {
    setError('');
    const reader = new FileReader();
    reader.onerror = () => {
      setError('Failed to read the selected file. Please try again.');
    };
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        setError('The selected file is not a valid image. Please try another one.');
      };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
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
          if (!ctx) {
            setError('Failed to process the image. Please try again.');
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          setPhoto(canvas.toDataURL('image/jpeg', 0.6));
          setStep(2);
        } catch (err) {
          console.error("Image processing error:", err);
          setError('An error occurred while processing the image.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (acceptedFiles: File[], fileRejections: any[]) => {
    setError('');
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('The selected file is too large. Maximum size is 10MB.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('The selected file type is not supported. Please use JPG or PNG.');
      } else {
        setError('The selected file could not be uploaded.');
      }
      return;
    }
    if (acceptedFiles[0]) {
      processFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = Dropzone.useDropzone({
    onDrop,
    accept: {'image/*': ['.jpeg', '.jpg', '.png']},
    multiple: false,
    maxSize: 10 * 1024 * 1024 // 10MB
  } as any);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsScanning(true);
      setError('');
      
      try {
        // Resize image to prevent payload too large errors
        const resizedBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Failed to read the file."));
          reader.onload = (event) => {
            const img = new Image();
            img.onerror = () => reject(new Error("Failed to load the image. Please use a standard image format (JPG/PNG)."));
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1200;
              const MAX_HEIGHT = 1200;
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
              if (!ctx) {
                reject(new Error("Could not initialize image processing context."));
                return;
              }
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
        });

        const data = await extractBillData(resizedBase64);
        
        const scannedRef = data.referenceNumber || "";
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
            const errMsg = `Scanning restricted! This bill (Reference: ${scannedRef || 'None'}) does not belong to your subdivision (${subDiv}).`;
            toast.error(errMsg);
            setError(errMsg);
            setIsScanning(false);
            e.target.value = '';
            return;
          }
        }

        if (data.referenceNumber) {
          setReferenceNumber(data.referenceNumber.replace(/[^0-9]/g, ''));
        }
        
        setBillData({
          consumerName: data.consumerName || "",
          address: data.address || "",
          referenceNumber: data.referenceNumber?.replace(/[^0-9]/g, '') || "",
          unitsConsumed: 0,
          amountDue: 0,
          billingMonth: data.billingMonth && data.billingMonth !== "N/A" ? data.billingMonth : "",
          sanctionedLoad: data.sanctionedLoad || "",
          connectionType: data.tariff || "",
          meterNoOnBill: data.meterNoOnBill || "",
          subDivisionName: data.subDivisionName || "",
          feederName: data.feederName || "",
          meterStatus: data.meterStatus || "",
          customerId: data.customerId || "",
          tariff: data.tariff || "",
          currentBill: parseFloat(data.currentBill?.toString().replace(/[^0-9.]/g, '')) || 0,
          deferredAmount: parseFloat(data.deferredAmount?.toString().replace(/[^0-9.]/g, '')) || 0,
          presentReading: data.presentReading || "",
          previousReading: data.previousReading || "",
          difference: (() => {
            if (data.consumedUnits && data.consumedUnits !== "N/A") {
              return data.consumedUnits.toString().replace(/[^0-9]/g, '');
            }
            const present = parseInt(data.presentReading?.toString().replace(/[^0-9]/g, '') || '0');
            const previous = parseInt(data.previousReading?.toString().replace(/[^0-9]/g, '') || '0');
            const diff = present - previous;
            return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
          })(),
          monthWiseUnitsConsumed: "",
          monthWiseUnits: data.monthWiseUnits?.map((item: any) => {
            const cleanValue = (val: any) => {
              let str = val?.toString()?.trim() || '';
              // If it's a JSON-like fragment or contains "N/A" with garbage
              if (str.toUpperCase().includes('N/A') || (str.includes('"') && str.includes(':'))) {
                // If it looks like a JSON string from a hallucinating AI
                if (str.includes('"') && str.includes(':')) {
                   const parts = str.split(',');
                   str = parts[0].replace(/[":{}]/g, '').replace(/Units/i, '').replace(/Bill/i, '').replace(/Adj/i, '').replace(/Payment/i, '').trim();
                }
                if (str.toUpperCase() === 'N/A' || str.toUpperCase().includes('N/A')) return '';
              }
              return str;
            };
            return {
              month: cleanValue(item.month),
              reading: cleanValue(item.reading),
              units: cleanValue(item.units),
              bill: cleanValue(item.bill),
              adj: cleanValue(item.adj),
              payment: cleanValue(item.payment),
            };
          }) || [],
        });

        setDetectionData(prev => ({
          ...prev,
          meterStatus: data.meterStatus || "",
          feederName: data.feederName || "",
          meterNumber: data.meterNoOnBill || "",
          consumerName: data.consumerName || "",
          address: data.address || "",
          referenceNumber: data.referenceNumber?.replace(/[^0-9]/g, '') || ""
        }));
        
        setError('');
        setStep(3);
      } catch (err: any) {
        console.error("Extraction error:", err);
        setError(err.message || "Failed to extract data from screenshot. Please try again or enter manually.");
      } finally {
        setIsScanning(false);
        e.target.value = ''; // Reset input value
      }
    }
  };

  const fetchBill = async () => {
    const cleanRef = referenceNumber.replace(/[^0-9]/g, '');
    if (cleanRef.length !== 14) {
      setError('Reference Number must be exactly 14 digits.');
      return;
    }
    
    const subDiv = user?.subDivision || "";
    const userEmail = user?.email?.toLowerCase() || "";
    const isAdmin = userEmail === 'mianfiazullah@gmail.com' || user?.role === 'admin';
    const isMasterFile = subDiv?.toLowerCase() === 'master file';
    const hasBypass = isAdmin || isMasterFile;
    
    if (subDiv && !hasBypass) {
      const cleanSub = subDiv.replace(/[^0-9]/g, '');
      const isMatch = cleanSub ? cleanRef.includes(cleanSub) : referenceNumber.toLowerCase().includes(subDiv.toLowerCase());
      
      if (!isMatch) {
        setError(`Fetching restricted! This reference number does not belong to your subdivision (${subDiv}).`);
        toast.error(`Fetching restricted! This reference number does not belong to your subdivision (${subDiv}).`);
        return;
      }
    }
    
    setIsFetching(true);
    setError('');
    try {
      const response = await fetch('/api/fetch-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeStringify({ referenceNumber: cleanRef }),
      });
      
      const data = await safeFetchJson(response);
      
      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}\n\nDetails: ${data.details}` : data.error;
        throw new Error(errorMsg || 'Failed to fetch bill data');
      }
      
      const billWithDiff = {
        ...data,
        difference: (() => {
          if (data.unitsConsumed !== undefined && data.unitsConsumed !== null && data.unitsConsumed !== 0) {
            return data.unitsConsumed.toString();
          }
          const present = parseInt(data.presentReading?.toString().replace(/[^0-9]/g, '') || '0');
          const previous = parseInt(data.previousReading?.toString().replace(/[^0-9]/g, '') || '0');
          const diff = present - previous;
          return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
        })()
      };
      setBillData(billWithDiff);
      setDetectionData(prev => ({
        ...prev,
        meterStatus: data.meterStatus || "",
        feederName: data.feederName || "",
        meterNumber: data.meterNoOnBill || "",
        consumerName: data.consumerName || "",
        address: data.address || "",
        referenceNumber: data.referenceNumber?.replace(/[^0-9]/g, '') || ""
      }));
      setError('');
      setStep(3);
    } catch (err: any) {
      console.error("Fetch bill error:", err);
      const message = err.message.includes('Details:') 
        ? err.message 
        : `Could not fetch bill data. LESCO servers might be busy or the reference number is invalid.\n\nError: ${err.message}`;
      setError(message);
    } finally {
      setIsFetching(false);
    }
  };

  const validateForm = () => {
    setError('');
    setValidationErrors([]);
    const errors: string[] = [];
    
    if (!isSlownessActive && detectionData.noOfAC && parseInt(detectionData.noOfAC) > 0) {
      const split = parseInt(detectionData.splitAcCount || '0');
      const window = parseInt(detectionData.windowAcCount || '0');
      const total = parseInt(detectionData.noOfAC);
      if (split + window !== total) {
        if (!isAcVerified) {
          setShowAcMismatch(true);
          playWarningSound();
          return false;
        }
      }
    }

    if (detectionData.presentOccupier?.trim().toLowerCase() === 'muhammad afzal') {
      errors.push('The name "Muhammad Afzal" is not allowed in Present Occupier field.');
    }
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      setError(errors[0]);
      return false;
    }

    return true;
  };

  const saveCase = async () => {
    if (!user) {
      setError('User not authenticated. Please log in again.');
      return;
    }

    const userEmail = user?.email?.toLowerCase() || "";
    const isAdmin = userEmail === 'mianfiazullah@gmail.com' || user?.role === 'admin';
    const isMasterFile = user?.subDivision?.toLowerCase() === 'master file';
    const hasBypass = isAdmin || isMasterFile;
    if (!hasBypass) {
      const subDiv = user?.subDivision || "";
      if (subDiv) {
        const refNo = detectionData.referenceNumber || billData.referenceNumber || "";
        const cleanRef = refNo.replace(/[^0-9]/g, '');
        const cleanSub = subDiv.replace(/[^0-9]/g, '');
        const isMatch = cleanSub ? cleanRef.includes(cleanSub) : refNo.toLowerCase().includes(subDiv.toLowerCase());
        
        if (!isMatch) {
          setError(`Case creation restricted! This reference number (${refNo || 'None'}) does not belong to your subdivision (${subDiv}).`);
          toast.error(`Case creation restricted! This reference number (${refNo || 'None'}) does not belong to your subdivision (${subDiv}).`);
          return;
        }
      }
    }

    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // 1. Use base64 photo directly (resized to avoid 1MB limit)
      const photoUrl = photo;

      // 2. Save Case to Firestore
      // Sanitize billData to remove undefined values
      const sanitizedBillData = { ...billData };
      Object.keys(sanitizedBillData).forEach(key => {
        if (sanitizedBillData[key as keyof typeof sanitizedBillData] === undefined) {
          delete sanitizedBillData[key as keyof typeof sanitizedBillData];
        }
      });

      const finalCheckedBy = (detectionData.checkedBy || []).map(item => {
        if (item === "Along With") {
          const others = (detectionData.othersCheckedBy || "").trim();
          if (!others) return "Along With";
          if (others.toLowerCase().startsWith("along with")) return others;
          return `Along With ${others}`;
        }
        return item;
      });

      const finalDiscrepancy = (detectionData.discrepancy || []).map(item => {
        if (item === "Others") {
          const others = (detectionData.othersDiscrepancy || "").trim();
          return others || "Others";
        }
        return item;
      });

      const newCase: Omit<DetectionCase, 'id'> = {
        userId: user.uid || '',
        employeeName: detectionData.employeeName || '',
        employeeNameUrdu: detectionData.employeeNameUrdu || '',
        employeeDesignation: detectionData.employeeDesignation || '',
        employeeCnic: detectionData.employeeCnic || '',
        employeeMobile: detectionData.employeeMobile || '',
        photoUrl: photoUrl || '',
        billData: sanitizedBillData as BillData,
        dateOfChecking: (detectionData.dateOfChecking || '').split('-').reverse().join('-'), // Convert to DD-MM-YYYY
        detectionDate: new Date().toISOString(),
        discrepancy: finalDiscrepancy,
        othersDiscrepancy: detectionData.othersDiscrepancy || '',
        checkedBy: finalCheckedBy,
        meterType: detectionData.meterType || '',
        capacity: detectionData.capacity || '',
        presentReading: detectionData.presentReading || '',
        presentReadingAtSite: detectionData.presentReadingAtSite || '',
        previousReading: detectionData.previousReading || '',
        difference: detectionData.difference || '0',
        email: detectionData.email || '',
        mobileNo: detectionData.mobileNo || '',
        meterMake: detectionData.meterMake || '',
        name: detectionData.name || '',
        nameUrdu: detectionData.nameUrdu || '',
        presentOccupier: detectionData.presentOccupier || '',
        presentOccupierUrdu: detectionData.presentOccupierUrdu || '',
        address: detectionData.address || '',
        addressUrdu: detectionData.addressUrdu || '',
        sanctionLoad: detectionData.sanctionLoad || '',
        connectedLoad: detectionData.connectedLoad || '',
        loadFactor: detectionData.loadFactor || '',
        loadItems: detectionData.loadItems || [],
        meterNumber: detectionData.meterNumber || '',
        customerId: detectionData.customerId || '',
        tariff: detectionData.tariff || '',
        witnesses: (detectionData.witnesses || []).filter(w => w.trim() !== ''),
        remarks: detectionData.remarks || '',
        createdAt: new Date().toISOString(),
        firNumber: detectionData.registeredFirNo || '',
        referenceNumber: detectionData.referenceNumber || billData.referenceNumber || '',
        billingMonth: billData.billingMonth,
        noticeNo: detectionData.noticeNo,
        noticeDated: detectionData.noticeDated,
        firNo: detectionData.firNo,
        firDated: detectionData.firDated,
        registeredFirNo: detectionData.registeredFirNo,
        registeredFirDated: detectionData.registeredFirDated,
        policeStation: detectionData.policeStation,
        policeStationUrdu: detectionData.policeStationUrdu || '',
        noOfAC: detectionData.noOfAC,
        splitAcCount: detectionData.splitAcCount,
        windowAcCount: detectionData.windowAcCount,
        acType: (() => {
          const split = parseInt(detectionData.splitAcCount || '0');
          const window = parseInt(detectionData.windowAcCount || '0');
          if (split > 0 && window > 0) return 'Mixed (Split & Window)';
          if (split > 0) return 'Split';
          if (window > 0) return 'Window';
          return detectionData.acType || '';
        })(),
        detectionPeriodFrom: detectionData.detectionPeriodFrom,
        detectionPeriodTo: detectionData.detectionPeriodTo,
        detectionPeriodMonths: detectionData.detectionPeriodMonths,
        acPeriodFrom: detectionData.acPeriodFrom,
        acPeriodTo: detectionData.acPeriodTo,
        acPeriodMonths: detectionData.acPeriodMonths,
        unitsOfAcPeriod: detectionData.unitsOfAcPeriod,
        unitsAssessed: detectionData.unitsAssessed,
        unitsAlreadyCharged: detectionData.unitsAlreadyCharged,
        netUnitsToBeCharged: detectionData.netUnitsToBeCharged,
        feederName: detectionData.feederName || billData?.feederName || '',
        grandTotalUnits: detectionData.grandTotalUnits || '',
        meterStatus: detectionData.meterStatus || billData?.meterStatus || '',
        dBillingMemoNo: detectionData.dBillingMemoNo || '',
        dBillingMemoDated: detectionData.dBillingMemoDated || '',
        lossAmount: detectionData.lossAmount || '',
        seizureCableSize: detectionData.seizureCableSize || '',
        seizureCableColor: detectionData.seizureCableColor || '',
        seizureCableLength: detectionData.seizureCableLength || '',
      };

      await addDoc(collection(db, 'cases'), newCase);
      
      // 3. Save to Google Sheets (Client-side Webhook Automation)
      const webhookUrl = user?.webhookUrl || localStorage.getItem('google_sheets_webhook') || 'https://script.google.com/macros/s/AKfycbzFThMoqFExs2O_Gry9SrcZ_4W-RuFI7jADKEDf0Rq8LKBgxnO-IpK9yzdsRu-CNerp/exec';
      const webhookUrl2 = user?.webhookUrl2 || localStorage.getItem('google_sheets_webhook_2') || '';
      
      if (webhookUrl || webhookUrl2) {
        try {
          const payload = {
            "Date of Checking": newCase.dateOfChecking,
            "Reference Number": newCase.referenceNumber,
            "Sub Division": billData?.subDivisionName || '',
            "Billing Month": newCase.billingMonth || '',
            "Consumer Name": newCase.name,
            "Consumer Name (Urdu)": newCase.nameUrdu || '',
            "Present Occupier": newCase.presentOccupier || '',
            "Present Occupier (Urdu)": newCase.presentOccupierUrdu || '',
            "Address": newCase.address,
            "Address (Urdu)": newCase.addressUrdu || '',
            "Customer ID": newCase.customerId,
            "Tariff": newCase.tariff,
            "Sanction Load": newCase.sanctionLoad,
            "Connected Load": newCase.connectedLoad,
            "Feeder Name": newCase.feederName,
            "G. Total Units TO BE CHARGED": newCase.grandTotalUnits,
            "Meter No.": newCase.meterNumber,
            "Meter Make": newCase.meterMake,
            "Meter Type": newCase.meterType,
            "Capacity": newCase.capacity,
            "Meter Status": newCase.meterStatus,
            "Meter Slow By (%)": detectionData.meterSlowBy || '',
            "Discrepancy": (newCase.discrepancy || []).join(', '),
            "Notice No.": newCase.noticeNo || '',
            "Notice Dated": newCase.noticeDated || '',
            "FIR Request No.": newCase.firNo || '',
            "FIR Request Dated": newCase.firDated || '',
            "Registered FIR No.": newCase.registeredFirNo || '',
            "Registered FIR Dated": newCase.registeredFirDated || '',
            "Police Station": newCase.policeStation || '',
            "NAME OF POLICE STATIONS": newCase.policeStation || '',
            "NAME OF POLICE STATIONS (URDU)": newCase.policeStationUrdu || '',
            "No. of AC": newCase.noOfAC || '',
            "Split AC Count": newCase.splitAcCount || '',
            "Window AC Count": newCase.windowAcCount || '',
            "AC Type": newCase.acType || '',
            "AC Period From": newCase.acPeriodFrom || '',
            "AC Period To": newCase.acPeriodTo || '',
            "AC Period Months": newCase.acPeriodMonths || '',
            "Units of AC Period": newCase.unitsOfAcPeriod || '',
            "Detection Period From": newCase.detectionPeriodFrom || '',
            "Detection Period To": newCase.detectionPeriodTo || '',
            "Detection Period Months": newCase.detectionPeriodMonths || '',
            "Units Assessed": newCase.unitsAssessed || '',
            "Units Already Charged": newCase.unitsAlreadyCharged || '',
            "Net Units to be Charged": newCase.netUnitsToBeCharged || '',
            "D.BILL MEMO NO.": newCase.dBillingMemoNo || '',
            "D.BILL MEMO DATED": newCase.dBillingMemoDated || '',
            "Loss Amount": newCase.lossAmount || '',
            "Seizure Cable Size": newCase.seizureCableSize || '',
            "Seizure Cable Color": newCase.seizureCableColor || '',
            "Seizure Cable Length": newCase.seizureCableLength || '',
            "Checked By": (newCase.checkedBy || []).join(', '),
            "Witnesses": (newCase.witnesses || []).join(', '),
            "Present Reading at Site": newCase.presentReadingAtSite,
            "E-Mail Address": newCase.email,
            "Mobile Number": newCase.mobileNo,
            "Load Factor": newCase.loadFactor,
            "Connected Load Details": (newCase.loadItems || []).map(i => `${i.name}(${i.qty}x${i.watts}=${i.total}W)`).join('; '),
            "Remarks": newCase.remarks,
            "SDO NAME": newCase.employeeName,
            "SDO NAME (Urdu)": newCase.employeeNameUrdu || '',
            "SDO NAME(Urdu)": newCase.employeeNameUrdu || '',
            "Designation": newCase.employeeDesignation,
            "SDO CNIC": newCase.employeeCnic || '',
            "SDO Mobile": newCase.employeeMobile || '',
            "photoUrl": newCase.photoUrl || '',
          };

          const promises: Promise<any>[] = [];
          if (webhookUrl) {
            promises.push(
              fetch('/api/webhook-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhookUrl, payload }),
              }).then(res => {
                if (!res.ok) throw new Error("Sheet 1 failed");
                console.log('Case sent to Google Sheets 1 via Proxy');
              })
            );
          }
          if (webhookUrl2) {
            promises.push(
              fetch('/api/webhook-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhookUrl: webhookUrl2, payload }),
              }).then(res => {
                if (!res.ok) throw new Error("Sheet 2 failed");
                console.log('Case sent to Google Sheets 2 via Proxy');
              })
            );
          }

          await Promise.all(promises);
          toast.success("Saved to Google Sheets.");
        } catch (sheetsErr) {
          console.error("Failed to sync to Google Sheets:", sheetsErr);
          toast.error("Failed to sync with one or both Google Sheets.");
        }
      }

      // Clear persistence after successful save
      const keysToClear = [
        'lesco_new_case_step',
        'lesco_new_case_photo',
        'lesco_new_case_ref',
        'lesco_bill_data',
        'lesco_detection_data'
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));

      setIsSaved(true);
      setStep(4);
      
      // Auto-upload to drive (ensure DOM is ready)
      setTimeout(async () => {
        handleBulkUploadToDrive();
      }, 1500);

      toast.dismiss();
      toast.success("Case saved successfully!", {
        description: "Cloud backup to Google Drive starting..."
      });

    } catch (err: any) {
      console.error("Save case error:", err);
      setError(err.message || "Failed to save case. Please try again.");
      handleFirestoreError(err, OperationType.WRITE, 'cases');
    } finally {
      setIsSaving(false);
    }
  };

  const generatePDF = (templateName: string) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 20;
    doc.setFont('helvetica');
    doc.setFontSize(20);
    doc.text('LESCO - ' + templateName, margin, 20);
    doc.setFontSize(12);
    doc.text(`Reference No: ${billData?.referenceNumber}`, margin, 30);
    doc.text(`Date of Checking: ${detectionData.dateOfChecking.split('-').reverse().join('-')}`, margin, 38);
    doc.text(`NAME: ${detectionData.name}`, margin, 46);
    doc.text(`Address: ${detectionData.address}`, margin, 54);
    doc.text(`Mobile No: ${detectionData.mobileNo}`, margin, 62);
    doc.text(`E Mail: ${detectionData.email}`, margin, 70);
    doc.text(`CUSTOMER ID: ${detectionData.customerId}`, margin, 78);
    doc.text(`Tariff: ${detectionData.tariff}`, margin, 86);
    doc.text(`Sanction Load: ${detectionData.sanctionLoad}${detectionData.sanctionLoad ? '-KW' : ''}`, margin, 94);
    doc.text(`Connected Load: ${detectionData.connectedLoad}${detectionData.connectedLoad ? '-KW' : ''}`, margin, 102);
    doc.text(`Previous Reading: ${detectionData.previousReading}`, margin, 110);
    doc.text(`Present Reading On Bill: ${detectionData.presentReading}`, margin, 118);
    doc.text(`Difference: ${detectionData.difference || '0'}`, margin, 126);
    doc.text(`Type: ${detectionData.meterType}`, margin, 134);
    doc.text(`Capacity: ${detectionData.capacity}`, margin, 142);
    doc.text(`Meter Make: ${detectionData.meterMake}`, margin, 150);
    const calculatedAcType = (() => {
      const split = parseInt(detectionData.splitAcCount || '0');
      const window = parseInt(detectionData.windowAcCount || '0');
      if (split > 0 && window > 0) return 'Mixed (Split & Window)';
      if (split > 0) return 'Split';
      if (window > 0) return 'Window';
      return detectionData.acType || '';
    })();
    const acInfo = detectionData.noOfAC ? (
      `No of AC: ${detectionData.noOfAC} ${parseInt(detectionData.noOfAC || '0') === 1 ? 'No.' : 'Nos.'}` + 
      (() => {
        const split = parseInt(detectionData.splitAcCount || '0');
        const window = parseInt(detectionData.windowAcCount || '0');
        const parts = [];
        if (split > 0) parts.push(`${split} ${split === 1 ? 'No.' : 'Nos.'} Split`);
        if (window > 0) parts.push(`${window} ${window === 1 ? 'No.' : 'Nos.'} Window`);
        if (parts.length > 0) return ` ( ${parts.join(' + ')} )`;
        return calculatedAcType ? ` (${calculatedAcType})` : '';
      })()
    ) : 'No of AC: 0';
    doc.text(acInfo, margin, 160);
    const finalDiscrepancy = (detectionData.discrepancy || []).map(item => {
      if (item === "Others") {
        const others = (detectionData.othersDiscrepancy || "").trim();
        return others || "Others";
      }
      return item;
    });
    doc.text(`Discrepancy: ${finalDiscrepancy.join(', ')}`, margin, 170);
    const finalCheckedBy = (detectionData.checkedBy || []).map(item => {
      if (item === "Along With") {
        const others = (detectionData.othersCheckedBy || "").trim();
        if (!others) return "Along With";
        if (others.toLowerCase().startsWith("along with")) return others;
        return `Along With ${others}`;
      }
      return item;
    });
    doc.text(`Checked By: ${finalCheckedBy.join(', ')}`, margin, 180);
    doc.text(`Employee: ${detectionData.employeeName} (${detectionData.employeeDesignation})`, margin, 190);
    
    if (photo) {
      doc.text('Photo of Accused Attached', margin, 200);
    }
    
    doc.save(`LESCO_${templateName}_${billData?.referenceNumber}.pdf`);
  };

  const steps = [
    { id: 1, name: 'Evidence', icon: Camera, desc: 'Photo Evidence' },
    { id: 2, name: 'Bill Info', icon: Hash, desc: 'LESCO Data' },
    { id: 3, name: 'Details', icon: FileText, desc: 'Case Details' },
    { id: 4, name: 'Generate', icon: CheckCircle, desc: 'Review & Print' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-8 pb-32 px-2 sm:px-4">
      {/* Top Progress Bar (Sticky) */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-neutral-100/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <motion.div 
          className="h-full bg-indigo-600 dark:bg-indigo-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${(step / steps.length) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Stepper */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 pb-10 sm:pb-12 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
        {/* Progress Bar inside card */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-50 dark:bg-slate-800">
          <motion.div 
            className="h-full bg-indigo-600 dark:bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${(step / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0" 
              title="Go Home"
            >
              <Home className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-500 dark:text-slate-400" />
            </button>
            <div className="hidden sm:block">
              <p className="text-[10px] font-black text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Step</p>
              <p className="text-sm font-bold text-neutral-900 dark:text-slate-100">{step} of {steps.length}</p>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center max-w-2xl mx-auto">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center relative group">
                  <button
                    onClick={() => {
                      if (s.id < step) setStep(s.id);
                      else if (s.id === 3 && step === 2 && billData) setStep(3);
                      else if (s.id === 4 && step === 3 && validateForm()) setStep(4);
                    }}
                    disabled={s.id > step && !(s.id === 3 && step === 2 && billData)}
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all duration-500 relative z-10",
                      step === s.id ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 scale-110" : 
                      step > s.id ? "bg-green-500 dark:bg-green-600 text-white shadow-lg shadow-green-500/20" : 
                      "bg-neutral-100 dark:bg-slate-800 text-neutral-400 dark:text-slate-500"
                    )}
                  >
                    {step > s.id ? <Check className="w-6 h-6" /> : <s.icon className="w-5 h-5 sm:w-6 sm:h-6" />}
                    
                    {/* Active Ring */}
                    {step === s.id && (
                      <span className="absolute inset-0 rounded-full border-4 border-indigo-600/20 dark:border-indigo-400/20 animate-ping" />
                    )}
                  </button>
                  
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-center">
                    <p className={cn(
                      "text-[10px] sm:text-xs font-black uppercase tracking-tighter transition-colors duration-500",
                      step >= s.id ? "text-neutral-900 dark:text-slate-100" : "text-neutral-400 dark:text-slate-500"
                    )}>
                      {s.name}
                    </p>
                  </div>
                </div>
                
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-1 mx-2 sm:mx-4 rounded-full bg-neutral-100 relative overflow-hidden">
                    <motion.div 
                      className="absolute inset-0 bg-indigo-600 origin-left"
                      initial={false}
                      animate={{ scaleX: step > s.id ? 1 : 0 }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <button 
            onClick={resetCase} 
            className="p-2 hover:bg-indigo-50 text-neutral-400 hover:text-indigo-600 rounded-full transition-colors shrink-0" 
            title="Reset Case"
          >
            <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm text-center space-y-6"
          >
            <div className="bg-indigo-50 dark:bg-indigo-900/30 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="text-indigo-600 dark:text-indigo-400 w-10 h-10" />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Step 1: Photo Evidence</h2>
                <p className="text-neutral-500 dark:text-slate-400 mt-2 text-sm sm:text-base">Upload a photo of the accused person or the scene of theft.</p>
              </div>
            </div>

            {error && (
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <p className="text-sm text-indigo-800 font-medium">{error}</p>
              </div>
            )}
            
            {photo ? (
              <div className="relative w-full max-w-md mx-auto">
                <img src={photo} alt="Evidence" className="w-full h-64 object-cover rounded-3xl border border-neutral-200 shadow-sm" />
                <div className="absolute -top-2 -right-2 flex gap-2">
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const response = await fetch(photo!);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `evidence_${referenceNumber || 'case'}.jpeg`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error("Error downloading photo:", err);
                        // Fallback
                        const link = document.createElement('a');
                        link.href = photo!;
                        link.download = `evidence_${referenceNumber || 'case'}.jpeg`;
                        link.target = "_blank";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    className="bg-white text-neutral-900 p-2 rounded-full shadow-lg hover:bg-neutral-100 transition-colors border border-neutral-200"
                    title="Download Photo"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhoto(null);
                    }}
                    className="bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-neutral-500 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Upload New
                  </button>
                  <button 
                    onClick={() => startCamera()}
                    className="text-sm text-neutral-500 hover:text-indigo-600 font-medium transition-colors"
                  >
                    Take New Photo
                  </button>
                </div>
              </div>
            ) : isCameraOpen ? (
              <div className="relative w-full max-w-md mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-64 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                  <button 
                    onClick={takePhoto}
                    className="bg-indigo-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all scale-110 active:scale-95"
                    title="Capture Photo"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={stopCamera}
                    className="bg-white/20 backdrop-blur-md text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-white/30 transition-all"
                    title="Cancel"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div 
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-8 transition-all cursor-pointer group flex flex-col items-center justify-center",
                    isDragActive ? "border-indigo-500 bg-indigo-50" : "border-neutral-200 hover:border-indigo-400 hover:bg-indigo-50"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className={cn("w-10 h-10 mb-4 transition-colors", isDragActive ? "text-indigo-500" : "text-neutral-300 group-hover:text-indigo-500")} />
                  <p className="text-neutral-500 font-bold text-sm">Upload Photo</p>
                  <p className="text-neutral-400 text-[10px] mt-1">Drag & drop or click</p>
                </div>

                <button
                  onClick={() => startCamera()}
                  className="border-2 border-dashed border-neutral-200 rounded-3xl p-8 transition-all hover:border-indigo-400 hover:bg-indigo-50 group flex flex-col items-center justify-center"
                >
                  <Camera className="w-10 h-10 mb-4 text-neutral-300 group-hover:text-indigo-500 transition-colors" />
                  <p className="text-neutral-500 font-bold text-sm">Take Photo</p>
                  <p className="text-neutral-400 text-[10px] mt-1">Use device camera</p>
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm space-y-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-slate-100">Step 2: Bill Information</h2>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 uppercase tracking-wider">
                LESCO Reference Number
              </label>
              
              {isCameraOpen && isScanningCamera && (
                <div className="relative w-full max-w-md mx-auto bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white mb-6">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-64 object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button 
                      onClick={takePhoto}
                      className="bg-indigo-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all scale-110 active:scale-95"
                      title="Capture Photo"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={stopCamera}
                      className="bg-white/20 backdrop-blur-md text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-white/30 transition-all"
                      title="Cancel"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="relative flex-1 group">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 14);
                      setReferenceNumber(val);
                    }}
                    placeholder="e.g. 01112230987654"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 pl-12 pr-12 text-neutral-900 focus:outline-none focus:border-indigo-500 transition-all font-mono tracking-wider"
                  />
                  {referenceNumber && (
                    <button
                      onClick={() => setReferenceNumber('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 rounded-full transition-colors"
                    >
                      <X className="w-4 h-4 text-neutral-400" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragEnd={handleStep2ButtonDragEnd}
                  >
                    <SortableContext 
                      items={step2ButtonOrder}
                      strategy={rectSortingStrategy}
                    >
                      <div className="flex flex-wrap gap-3">
                        {step2ButtonOrder.map((buttonId) => {
                          const serialNo = step2ButtonSerials[buttonId] || '';
                          const onSerialNoChange = (val: string) => setStep2ButtonSerials(prev => ({ ...prev, [buttonId]: val }));

                          if (buttonId === 'fetch') {
                            return (
                              <SortableItem key="fetch" id="fetch" serialNo={serialNo} onSerialNoChange={onSerialNoChange}>
                                <button
                                  onClick={fetchBill}
                                  disabled={isFetching || isScanning || referenceNumber.replace(/[^0-9]/g, '').length !== 14}
                                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-200 text-white px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-2xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 relative overflow-hidden group h-full"
                                >
                                  {isFetching ? (
                                    <>
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                      <span>Fetching...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Search className="w-5 h-5" />
                                      <span>Fetch Bill Data</span>
                                    </>
                                  )}
                                </button>
                              </SortableItem>
                            );
                          }
                          if (buttonId === 'scan') {
                            return (
                              <SortableItem key="scan" id="scan" serialNo={serialNo} onSerialNoChange={onSerialNoChange}>
                                <div className="flex gap-2 h-full">
                                  <button
                                    onClick={() => screenshotInputRef.current?.click()}
                                    disabled={isScanning || isFetching}
                                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-200 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 relative overflow-hidden group h-full"
                                    title="Upload Screenshot"
                                  >
                                    {isScanning ? (
                                      <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                      <Upload className="w-5 h-5" />
                                    )}
                                    <span className="hidden sm:inline">Upload</span>
                                  </button>
                                  <button
                                    onClick={() => startCamera(true)}
                                    disabled={isScanning || isFetching}
                                    className="bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-200 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 relative overflow-hidden group h-full"
                                    title="Take Photo of Bill"
                                  >
                                    <Camera className="w-5 h-5" />
                                    <span className="hidden sm:inline">Scan</span>
                                  </button>
                                </div>
                              </SortableItem>
                            );
                          }
                          if (buttonId === 'skip') {
                            return (
                              <SortableItem key="skip" id="skip" serialNo={serialNo} onSerialNoChange={onSerialNoChange}>
                                <button
                                  onClick={() => {
                                    setBillData({
                                      consumerName: "",
                                      address: "",
                                      referenceNumber: referenceNumber.replace(/[^0-9]/g, ''),
                                      meterNoOnBill: "",
                                      unitsConsumed: 0,
                                      amountDue: 0,
                                      billingMonth: new Date(new Date().getFullYear(), new Date().getMonth() - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase(),
                                      sanctionedLoad: "",
                                      connectionType: "",
                                      customerId: "",
                                      currentBill: 0,
                                      deferredAmount: 0,
                                      monthWiseUnitsConsumed: "",
                                      monthWiseUnits: [
                                        { month: 'FEB 26', reading: '', units: '584', bill: '', adj: '', payment: '' },
                                        { month: 'JAN 26', reading: '', units: '153', bill: '', adj: '', payment: '' },
                                        { month: 'DEC 25', reading: '', units: '0', bill: '', adj: '', payment: '' },
                                        { month: 'NOV 25', reading: '', units: '81', bill: '', adj: '', payment: '' },
                                        { month: 'OCT 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'SEP 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'AUG 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'JUL 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'JUN 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'MAY 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'APR 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                        { month: 'MAR 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                      ],
                                    });
                                    setError('');
                                    setStep(3);
                                  }}
                                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-6 py-4 rounded-2xl font-bold transition-all h-full"
                                >
                                  Skip & Enter Manually
                                </button>
                              </SortableItem>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                  
                  <input 
                    type="file" 
                    ref={screenshotInputRef} 
                    onChange={handleScreenshotUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>
              </div>

              <AnimatePresence>
                {(isFetching || isScanning) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-3"
                  >
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">
                        {isFetching ? 'Fetching LESCO Data...' : 'Analyzing Screenshot...'}
                      </p>
                      <p className="text-xs text-blue-700">
                        {isFetching ? 'Connecting to LESCO servers. This may take up to 45 seconds.' : 'Extracting billing information using AI vision.'}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-xs text-neutral-400 ml-1">Enter the 14-digit LESCO reference number without spaces or hyphens.</p>
              <div className="mt-2 flex items-center gap-2 px-1">
                <span className="text-xs text-neutral-400">Issue with fetching?</span>
                <a 
                  href="https://www.lesco.gov.pk:36269/Modules/CustomerBillN/CheckBill.asp" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Official LESCO Bill Portal (Fallback)
                </a>
              </div>
              {error && (
                <div className="space-y-3">
                  <p className="text-indigo-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </p>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                    <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-3">
                      <p className="text-sm text-amber-800 font-medium">Having trouble fetching live data?</p>
                      <p className="text-xs text-amber-700">LESCO servers can be slow or unresponsive. You can use demo data, enter details manually, or check the official portal.</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a 
                          href="https://www.lesco.gov.pk:36269/Modules/CustomerBillN/CheckBill.asp" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Official LESCO Bill Portal
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            setReferenceNumber('00000000000000');
                            setTimeout(() => fetchBill(), 100);
                          }}
                          className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Use Demo Data
                        </button>
                        <button 
                          onClick={() => {
                            setBillData({
                              consumerName: "",
                              address: "",
                              referenceNumber: referenceNumber.replace(/[^0-9]/g, ''),
                              meterNoOnBill: "",
                              unitsConsumed: 0,
                              amountDue: 0,
                              billingMonth: new Date(new Date().getFullYear(), new Date().getMonth() - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase(),
                              sanctionedLoad: "",
                              connectionType: "",
                              customerId: "",
                              currentBill: 0,
                              deferredAmount: 0,
                              monthWiseUnitsConsumed: "",
                              monthWiseUnits: [
                                { month: 'FEB 26', reading: '', units: '584', bill: '', adj: '', payment: '' },
                                { month: 'JAN 26', reading: '', units: '153', bill: '', adj: '', payment: '' },
                                { month: 'DEC 25', reading: '', units: '0', bill: '', adj: '', payment: '' },
                                { month: 'NOV 25', reading: '', units: '81', bill: '', adj: '', payment: '' },
                                { month: 'OCT 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'SEP 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'AUG 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'JUL 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'JUN 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'MAY 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'APR 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                                { month: 'MAR 25', reading: '', units: '', bill: '', adj: '', payment: '' },
                              ],
                            });
                            setError('');
                            setStep(3);
                          }}
                          className="text-xs bg-neutral-800 hover:bg-neutral-900 text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Enter Manually
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-center py-4">
              <a 
                href="https://bill.pitc.com.pk/lescobill" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-2"
              >
                Open Official LESCO Bill Portal <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </motion.div>
        )}

        {step === 3 && billData && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-slate-100">Step 3: Verify & Details</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-sm font-bold hidden sm:flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Bill Data Fetched
                  </div>
                </div>
              </div>

              {/* Consumer Bill Details */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Consumer Bill Details
                </h3>
                
                {/* Consumer Bill Details Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Reference Number</label>
                    <input
                      type="text"
                      value={billData.referenceNumber || ''}
                      onChange={(e) => setBillData({...billData, referenceNumber: e.target.value.replace(/[^0-9]/g, '')})}
                      className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Reference No."
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-4">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Consumer Name</label>
                    <input
                      type="text"
                      value={billData.consumerName || ''}
                      onChange={(e) => setBillData({...billData, consumerName: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Consumer Name"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Bill Month</label>
                    <input
                      type="text"
                      value={billData.billingMonth || ''}
                      onChange={(e) => setBillData({...billData, billingMonth: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Bill Month"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Payable Within Due Date</label>
                    <div className="flex flex-row items-center gap-2">
                       <span className="text-neutral-500 dark:text-slate-400 font-medium">Rs.</span>
                       <input
                        type="number"
                        value={billData.currentBill === 0 ? '' : billData.currentBill || ''}
                        onChange={(e) => setBillData({...billData, currentBill: parseFloat(e.target.value) || 0})}
                        className="flex-1 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                        placeholder="0"
                        readOnly
                      />
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Deferred Amount</label>
                    <div className="flex flex-row items-center gap-2">
                       <span className="text-neutral-500 dark:text-slate-400 font-medium">Rs.</span>
                       <input
                        type="number"
                        value={billData.deferredAmount === 0 ? '' : billData.deferredAmount || ''}
                        onChange={(e) => setBillData({...billData, deferredAmount: parseFloat(e.target.value) || 0})}
                        className="flex-1 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                        placeholder="0"
                        readOnly
                      />
                    </div>
                  </div>
 
                   <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Meter No. On Bill</label>
                    <input 
                      type="text" 
                      value={billData.meterNoOnBill || ''} 
                      onChange={(e) => setBillData({...billData, meterNoOnBill: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-neutral-900 dark:text-slate-100 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Enter Meter No."
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Sub Division</label>
                    <input 
                      type="text" 
                      value={billData.subDivisionName || ''} 
                      onChange={(e) => setBillData({...billData, subDivisionName: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 px-3 text-neutral-900 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Sub Division"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Feeder Name</label>
                    <input 
                      type="text" 
                      value={billData.feederName || ''} 
                      onChange={(e) => setBillData({...billData, feederName: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 px-3 text-neutral-900 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Feeder Name"
                      readOnly
                    />
                  </div>
 
                   <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 dark:text-slate-400 uppercase">Meter Status</label>
                    <input 
                      type="text" 
                      value={billData.meterStatus || ''} 
                      onChange={(e) => setBillData({...billData, meterStatus: e.target.value})}
                      className={cn(
                        "w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-1.5 px-3 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed",
                        billData.meterStatus?.toUpperCase()?.includes('REPLACED') ? "text-red-600 font-bold" : "text-neutral-900 dark:text-slate-100"
                      )}
                      placeholder="Status"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Previous Reading</label>
                    <input
                      type="text"
                      value={billData.previousReading || ''}
                      onChange={(e) => setBillData({...billData, previousReading: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 px-3 text-neutral-900 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Prev Rdg"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Present Reading</label>
                     <input
                      type="text"
                      value={billData.presentReading || ''}
                      onChange={(e) => setBillData({...billData, presentReading: e.target.value})}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 px-3 text-neutral-900 font-bold focus:outline-none focus:border-indigo-500 cursor-not-allowed"
                      placeholder="Pres Rdg"
                      readOnly
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1 md:col-span-6">
                    <label className="text-xs font-bold text-neutral-500 uppercase">Difference</label>
                    <div className="w-full bg-neutral-100 border border-neutral-200 rounded-lg py-1.5 px-3 text-neutral-900 font-bold flex items-center h-[38px] cursor-not-allowed">
                      {(() => {
                         const presVal = billData.presentReading?.toString().toUpperCase() || '';
                         const prevVal = billData.previousReading?.toString().toUpperCase() || '';
                         if (presVal.includes('DF') || prevVal.includes('DF')) return 'DF';
                         if (presVal.includes('EX') || prevVal.includes('EX')) return 'EX';
                         if (presVal.includes('MC') || prevVal.includes('MC')) return 'MC';
                         
                         const present = parseInt(presVal.replace(/,/g, '') || '0');
                         const previous = parseInt(prevVal.replace(/,/g, '') || '0');
                         const diff = present - previous;
                         return !isNaN(present) && !isNaN(previous) ? (diff <= 0 ? '' : diff.toString()) : '';
                       })()}
                    </div>
                  </div>
                </div>



                {/* Month Wise Detail */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-neutral-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-400 uppercase">Month Wise Detail</span>
                      <button
                        onClick={() => {
                          const newUnits = [...(billData.monthWiseUnits || [])];
                          newUnits.push({ 
                            month: '', 
                            reading: '', 
                            units: '', 
                            bill: '', 
                            adj: '', 
                            payment: '' 
                          });
                          setBillData({...billData, monthWiseUnits: newUnits});
                        }}
                        className="text-[10px] bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 text-neutral-600 dark:text-slate-300 px-2 py-1 rounded font-bold transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Month
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                        {billData.monthWiseUnits && billData.monthWiseUnits.length > 0 ? (
                          <div className="rounded-lg border border-neutral-200 overflow-hidden inline-block min-w-full">
                            <table className="w-full text-[10px] text-left table-auto whitespace-nowrap">
                              <thead className="bg-neutral-50 border-b border-neutral-200 uppercase font-bold text-neutral-500">
                                <tr>
                                  <th className="px-2 py-1 border-r border-neutral-200 w-24">Month</th>
                                  <th className="px-2 py-1 border-r border-neutral-200 w-24">Units</th>
                                  <th className="px-2 py-1 border-r border-neutral-200 w-24">Bill</th>
                                  <th className="px-2 py-1 border-r border-neutral-200 w-44">Adj</th>
                                  <th className="px-2 py-1 border-l border-neutral-200 w-24">Payment</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-neutral-200">
                                {billData.monthWiseUnits.map((item, index) => (
                                  <tr key={index}>
                                    <td className="px-2 py-1 bg-neutral-50 border-r border-neutral-200 font-medium text-neutral-700 w-24">
                                      <input 
                                        type="text" 
                                        value={item.month?.toString().toUpperCase().includes('N/A') ? '' : item.month} 
                                        onChange={(e) => {
                                          const newUnits = [...billData.monthWiseUnits!];
                                          newUnits[index].month = e.target.value;
                                          setBillData({...billData, monthWiseUnits: newUnits});
                                        }}
                                        className="w-full bg-transparent focus:outline-none font-bold uppercase"
                                        placeholder="MMM YY"
                                      />
                                    </td>
                                    <td className="px-2 py-1 border-r border-neutral-200 text-neutral-900 w-24">
                                      <input 
                                        type="text" 
                                        value={item.units?.toString().toUpperCase().includes('N/A') ? '' : item.units} 
                                        onChange={(e) => {
                                          const newUnits = [...billData.monthWiseUnits!];
                                          newUnits[index].units = e.target.value;
                                          setBillData({...billData, monthWiseUnits: newUnits});
                                        }}
                                        className="w-full bg-white border border-neutral-100 rounded focus:border-indigo-500 focus:outline-none min-w-[50px] px-1"
                                        placeholder="Units"
                                      />
                                    </td>
                                    <td className="px-2 py-1 border-r border-neutral-200 text-neutral-900 w-24">
                                      <input 
                                        type="text" 
                                        value={item.bill?.toString().toUpperCase().includes('N/A') ? '' : (item.bill || '')} 
                                        onChange={(e) => {
                                          const newUnits = [...billData.monthWiseUnits!];
                                          newUnits[index].bill = e.target.value;
                                          setBillData({...billData, monthWiseUnits: newUnits});
                                        }}
                                        className="w-full bg-white border border-neutral-100 rounded focus:border-indigo-500 focus:outline-none min-w-[60px] px-1"
                                        placeholder="Bill"
                                      />
                                    </td>
                                    <td className="px-2 py-1 border-r border-neutral-200 text-red-600 font-bold w-44">
                                      <input 
                                        type="text" 
                                        value={item.adj?.toString().toUpperCase().includes('N/A') ? '' : (item.adj || '')} 
                                        onChange={(e) => {
                                          const newUnits = [...billData.monthWiseUnits!];
                                          newUnits[index].adj = e.target.value;
                                          setBillData({...billData, monthWiseUnits: newUnits});
                                        }}
                                        className="w-full bg-white border border-neutral-100 rounded focus:border-indigo-500 focus:outline-none text-center font-bold text-red-600 px-1"
                                        placeholder="Adj"
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-neutral-900 w-24">
                                      <input 
                                        type="text" 
                                        value={item.payment?.toString().toUpperCase().includes('N/A') ? '' : (item.payment || '')} 
                                        onChange={(e) => {
                                          const newUnits = [...billData.monthWiseUnits!];
                                          newUnits[index].payment = e.target.value;
                                          setBillData({...billData, monthWiseUnits: newUnits});
                                        }}
                                        className="w-full bg-white border border-neutral-100 rounded focus:border-indigo-500 focus:outline-none min-w-[60px] px-1"
                                        placeholder="Payment"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span className="text-neutral-500 text-sm">{billData.monthWiseUnitsConsumed || 'No month wise details available'}</span>
                        )}
                      </div>
                    </div>
                  </div>

               {/* Detection Details Section */}
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Detection Details
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    {user && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextEmployeeName = user.sdoName || user.name || '';
                          const nextEmployeeDesignation = user.designation || 'Assistant Manager (Operation)';
                          const nextEmployeeCnic = user.sdoCnic || '35102-0565965-3';
                          const nextEmployeeMobile = user.sdoMobile || '0370-4991751';
                          const nextEmployeeNameUrdu = user.sdoNameUrdu || '';
                          const nextEmail = user.email || '';
                          const nextUserMobile = user.userMobile || '';
                          
                          setDetectionData(prev => ({
                            ...prev,
                            employeeName: nextEmployeeName,
                            employeeDesignation: nextEmployeeDesignation,
                            employeeCnic: nextEmployeeCnic,
                            employeeMobile: nextEmployeeMobile,
                            employeeNameUrdu: nextEmployeeNameUrdu,
                            email: nextEmail,
                            mobileNo: nextUserMobile,
                          }));
                          toast.success('SDO/Officer Details filled instantly from active Roster!');
                        }}
                        className="text-xs text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-colors shadow-sm outline-none dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
                        title="Force reload SDO details from active roster"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin duration-1000" style={{ animationIterationCount: 1 }} /> Sync Active Roster SDO Details
                      </button>
                    )}
                    <a 
                      href="https://docs.google.com/forms/d/e/1FAIpQLSeQms4CeY4mlGCMdTAvCkmx6weVp-QyHfUm2BQ632A_3phcSQ/viewform?usp=header" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Reference Form
                    </a>
                  </div>
                </div>
                
                <div className="bg-neutral-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-neutral-100 dark:border-slate-800">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={fieldOrder}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {fieldOrder.map(id => renderField(id, fieldSerials[id]))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-bold mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>Please correct the following errors:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-sm text-indigo-800">{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && validationErrors.length === 0 && (
                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-800 font-medium">{error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => {
                    if (validateForm()) {
                      setStep(4);
                    }
                  }}
                  className={cn(
                    "flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                  )}
                >
                  <Eye className="w-5 h-5" /> View & Generate Templates
                </button>
              </div>
              <p className="text-center text-xs text-neutral-400 mt-2">
                * View and generate documents before saving the case to database.
              </p>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-slate-100">Step 4: View & Generate</h2>
              </div>
            </div>



            <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragEnd={handleTemplateDragEnd}
              >
                <SortableContext 
                  items={templateOrder}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {templateOrder.map((templateName, i) => {
                      const template = [
                        { name: 'DETECTION BILL PROFORMA', desc: 'Official proforma for penalty billing', icon: FileText },
                        { name: 'NOTICE', desc: 'Legal notice for electricity theft', icon: AlertCircle },
                        { name: 'FIR Request', desc: 'First Information Report for police submission', icon: ShieldAlert },
                        { name: 'FIR Urdu', desc: 'First Information Report in Urdu', icon: ShieldAlert },
                        { name: 'Detection Register', desc: 'Entry for sub-division detection register', icon: FileText },
                      ].find(t => t.name === templateName)!;

                      return (
                        <SortableItem key={template.name} id={template.name}>
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-indigo-200 dark:hover:border-indigo-800 transition-all h-full"
                          >
                            <div className="flex items-start gap-4 mb-6">
                              <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                <template.icon className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="font-bold text-neutral-900 dark:text-slate-100">{template.name}</h3>
                                <p className="text-sm text-neutral-500 dark:text-slate-400">{template.desc}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full">
                              <button 
                                onClick={() => {
                                  triggerPrint(template.name, false);
                                  setHasGenerated(true);
                                }}
                                className="flex-1 sm:flex-none justify-center bg-white dark:bg-slate-800 border-2 border-neutral-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 text-neutral-700 dark:text-slate-200 p-2 sm:p-3 rounded-xl transition-all flex items-center gap-1 sm:gap-2 shadow-sm whitespace-nowrap"
                                title="Preview Template"
                              >
                                <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-[10px] sm:text-xs font-bold">Preview</span>
                              </button>
                              <button 
                                onClick={() => {
                                  downloadAsJpeg(template.name);
                                  setHasGenerated(true);
                                }}
                                className="flex-1 sm:flex-none justify-center bg-white dark:bg-slate-800 border-2 border-neutral-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 text-neutral-700 dark:text-slate-200 p-2 sm:p-3 rounded-xl transition-all flex items-center gap-1 sm:gap-2 shadow-sm whitespace-nowrap"
                                title="Download as JPG"
                              >
                                <Download className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-[10px] sm:text-xs font-bold">JPG</span>
                              </button>
                              
                              <button 
                                onClick={() => {
                                  triggerPrint(template.name, true);
                                  setHasGenerated(true);
                                }}
                                className="flex-[2] sm:flex-1 w-full sm:w-auto min-w-[120px] bg-neutral-900 dark:bg-indigo-600 hover:bg-neutral-800 dark:hover:bg-indigo-500 text-white py-2 sm:py-3 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all shadow-lg"
                              >
                                <Printer className="w-4 h-4" /> Print PDF
                              </button>
                            </div>
                          </motion.div>
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {!isSaved && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm text-center space-y-6">
                <div className="bg-indigo-50 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <Save className="text-indigo-600 dark:text-indigo-400 w-8 h-8" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Final Step: Record Case</h3>
                  <p className="text-neutral-500 dark:text-slate-400 mt-2">After reviewing the templates above, save the case to the database and sync with Google Sheets.</p>
                </div>

                <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
                  {!driveToken && (
                    <button
                      onClick={connectDriveAndUpload}
                      className="w-full py-4 rounded-2xl font-bold border-2 border-dashed border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all flex items-center justify-center gap-3 text-lg"
                    >
                      <Cloud className="w-6 h-6 animate-pulse" />
                      <span>Connect Google Drive</span>
                    </button>
                  )}

                  {driveToken && (
                    <button
                      onClick={handleBulkUploadToDrive}
                      disabled={isBulkUploading || isSaving || isUploadedToDrive}
                      className={cn(
                        "w-full py-4 rounded-2xl font-bold border-2 transition-all flex items-center justify-center gap-3 text-lg",
                        isBulkUploading || isUploadedToDrive
                          ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 cursor-not-allowed"
                          : "bg-white dark:bg-slate-900 border-indigo-600 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 active:scale-95 shadow-sm"
                      )}
                    >
                      {isBulkUploading ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" /> 
                          <span>Uploading to Drive...</span>
                        </>
                      ) : isUploadedToDrive ? (
                        <>
                          <CheckCircle className="w-6 h-6" /> 
                          <span>Templates Baked Up!</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-6 h-6" /> 
                          <span>Bulk Upload (PDF) to Drive</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={saveCase}
                    disabled={isSaving || isBulkUploading || !isUploadedToDrive}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3 text-lg border-2 border-transparent",
                      isSaving || isBulkUploading || !isUploadedToDrive
                        ? "bg-neutral-200 dark:bg-slate-800 text-neutral-400 dark:text-slate-500 shadow-none cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 scale-100 hover:scale-[1.02] active:scale-95"
                    )}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" /> 
                        <span>Saving Case...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-6 h-6" /> 
                        <span>Final: Save Case to Database</span>
                      </>
                    )}
                  </button>
                  
                  {!isUploadedToDrive && driveToken && (
                    <p className="text-center text-xs text-neutral-500 dark:text-slate-400 animate-pulse">
                      * Please upload templates to Drive first to enable saving.
                    </p>
                  )}
                </div>
              </div>
            )}

            {isSaved && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm text-center">
                <div className="bg-green-50 dark:bg-green-900/30 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-green-600 dark:text-green-400 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-slate-100">Case Successfully Recorded</h3>
                <p className="text-neutral-500 dark:text-slate-400 mt-2 mb-6">All documents have been auto-filled and are ready for download.</p>
                <button
                  onClick={() => navigate('/')}
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wizard Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-neutral-200 dark:border-slate-800 p-4 sm:p-6 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => {
              if (step > 1) setStep(step - 1);
              else navigate('/');
            }}
            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-2xl font-bold text-neutral-600 dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="inline">{step === 1 ? 'Cancel' : 'Back'}</span>
          </button>

          <div className="flex items-center gap-2">
            {steps.map((s) => (
              <div 
                key={s.id} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  step === s.id ? "w-6 bg-indigo-600 dark:bg-indigo-500" : "bg-neutral-300 dark:bg-slate-700"
                )} 
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (step === 1) setStep(2);
              else if (step === 2) {
                if (billData) setStep(3);
                else toast.error('Please fetch or scan bill data first');
              }
              else if (step === 3) {
                if (validateForm()) setStep(4);
              }
              else if (step === 4) {
                // Already at last step
              }
            }}
            disabled={step === 4 || (step === 2 && !billData)}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base rounded-2xl font-bold text-white shadow-lg transition-all",
              step === 4 || (step === 2 && !billData)
                ? "bg-neutral-200 dark:bg-slate-800 text-neutral-400 dark:text-slate-500 shadow-none cursor-not-allowed"
                : "bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-500 dark:hover:bg-indigo-600 shadow-indigo-600/20"
            )}
          >
            <span className="inline">
              {step === 3 ? 'Review Templates' : 'Next'}
            </span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Hidden Print Templates - Rendered off-screen for capture and printing */}
      {step === 4 && (
        <div 
          className="fixed pointer-events-none -z-50 w-[210mm]"
          style={{ left: '-10000px', top: '0', opacity: 0.01 }}
        >
          {(() => {
            const commonData = {
              ...detectionData,
              photoUrl: photo,
              acType: (() => {
                const split = parseInt(detectionData.splitAcCount || '0');
                const window = parseInt(detectionData.windowAcCount || '0');
                if (split > 0 && window > 0) return 'Mixed (Split & Window)';
                if (split > 0) return 'Split';
                if (window > 0) return 'Window';
                return detectionData.acType || '';
              })(),
              discrepancy: (detectionData.discrepancy || []).map(item => {
                if (item === "Others") {
                  const others = (detectionData.othersDiscrepancy || "").trim();
                  return others || "Others";
                }
                return item;
              }),
              connectedLoad: `${((detectionData.loadItems || []).reduce((sum, item) => sum + (parseFloat(item.total.toString()) || 0), 0) / 1000).toFixed(3)} kW`,
              checkedBy: (detectionData.checkedBy || []).map(item => {
                if (item === "Along With") {
                  const others = (detectionData.othersCheckedBy || "").trim();
                  if (!others) return "Along With";
                  if (others.toLowerCase().startsWith("along with")) return others;
                  return `Along With ${others}`;
                }
                return item;
              }),
              referenceNumber: billData?.referenceNumber || detectionData.referenceNumber,
              dateOfChecking: detectionData.dateOfChecking.split('-').reverse().join('-'),
              noticeDated: detectionData.noticeDated ? detectionData.noticeDated.split('-').reverse().join('-') : '',
              firDated: detectionData.firDated ? detectionData.firDated.split('-').reverse().join('-') : '',
              detectionPeriodFrom: detectionData.detectionPeriodFrom ? detectionData.detectionPeriodFrom.split('-').reverse().join('-') : '',
              detectionPeriodTo: detectionData.detectionPeriodTo ? detectionData.detectionPeriodTo.split('-').reverse().join('-') : '',
              acPeriodFrom: detectionData.acPeriodFrom ? detectionData.acPeriodFrom.split('-').reverse().join('-') : '',
              acPeriodTo: detectionData.acPeriodTo ? detectionData.acPeriodTo.split('-').reverse().join('-') : '',
              monthWiseUnits: billData?.monthWiseUnits || [],
              billingMonth: billData?.billingMonth || detectionData.billingMonth,
              presentReading: billData?.presentReading || detectionData.presentReading,
              previousReading: billData?.previousReading || detectionData.previousReading,
              difference: billData?.difference || billData?.unitsConsumed?.toString() || detectionData.difference,
              loadItems: detectionData.loadItems,
              subDivisionName: billData?.subDivisionName,
              feederName: detectionData.feederName,
              meterStatus: billData?.meterStatus || detectionData.meterStatus
            };

            return [
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
                data={commonData as any}
                aiUrduTranslations={aiUrduTranslations}
              />
            ));
          })()}
        </div>
      )}
      {showMeterMismatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-900/90 p-4">
          <div className="bg-white p-12 rounded-3xl shadow-2xl max-w-2xl w-full text-center">
            <h2 className="text-2xl sm:text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold text-indigo-600 mb-6">Meter No. Mismatch</h2>
            <p className="text-xl text-neutral-700 mb-8">The meter number entered does not match the meter number on the bill.</p>
            <button
              onClick={() => {
                setIsMeterVerified(true);
                setShowMeterMismatch(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-2xl text-base sm:text-lg font-bold w-full transition-colors"
            >
              OK & Verified
            </button>
          </div>
        </div>
      )}
      {showReadingMismatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-900/90 p-4">
          <div className="bg-white p-12 rounded-3xl shadow-2xl max-w-2xl w-full text-center">
            <h2 className="text-2xl sm:text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold text-indigo-600 mb-6">
              {readingMismatchType === 'REVERSED' ? 'METER REVERSED' : 'PENDING UNITS'}
            </h2>
            <p className="text-xl text-neutral-700 mb-8">
              {readingMismatchType === 'REVERSED' 
                ? 'The present reading at site is less than the present reading on the bill.'
                : 'The difference between the present reading at site and the reading on the bill exceeds the maximum of the average monthly consumption and highest consumption of the last 12 months.'}
            </p>
            <button
              onClick={() => {
                setIsReadingVerified(true);
                setShowReadingMismatch(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-2xl text-base sm:text-lg font-bold w-full transition-colors"
            >
              OK & Verified
            </button>
          </div>
        </div>
      )}
      {showAcMismatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-900/90 p-4">
          <div className="bg-white p-12 rounded-3xl shadow-2xl max-w-2xl w-full text-center">
            <h2 className="text-2xl sm:text-xl sm:text-2xl md:text-3xl md:text-4xl font-bold text-indigo-600 mb-6 uppercase">CORRECT THE FIGURES OF ACs</h2>
            <p className="text-xl text-neutral-700 mb-8">The sum of Split ACs and Window ACs must equal the total No. of AC.</p>
            <button
              onClick={() => {
                setIsAcVerified(true);
                setShowAcMismatch(false);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base rounded-2xl text-base sm:text-lg font-bold w-full transition-colors"
            >
              OK & Verified
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
