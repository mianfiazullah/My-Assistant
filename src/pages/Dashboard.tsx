import { safeStringify } from "../lib/safeStringify";
import { safeFetchJson } from "../lib/safeFetch";
import { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, FileText, Download, TrendingUp, Users, AlertTriangle, ArrowRight, Loader2, Eye, X, Printer, Edit2, Save, Zap, ShieldAlert, ClipboardList, Bell, Trash2, ExternalLink, Search, CheckCircle2, ChevronDown, Landmark, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc, setDoc, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { DetectionCase, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ProformaTemplates } from '../components/ProformaTemplates';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageUsers = 
    user?.email?.toLowerCase() === 'mianfiazullah@gmail.com' || 
    auth.currentUser?.email?.toLowerCase() === 'mianfiazullah@gmail.com' || 
    user?.role === 'admin';
  const [recentCases, setRecentCases] = useState<DetectionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<{ type: string; data: any; isEditing?: boolean } | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [allFilteredCases, setAllFilteredCases] = useState<DetectionCase[]>([]);
  const [showFirDetailsModal, setShowFirDetailsModal] = useState(false);
  const [showActiveUsersModal, setShowActiveUsersModal] = useState(false);
  const [activeUsersList, setActiveUsersList] = useState<User[]>([]);
  const [usersSearchFilter, setUsersSearchFilter] = useState('');
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subDivision: string; expiryDate: string } | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserSubDivision, setNewUserSubDivision] = useState('');
  const [newUserExpiryDate, setNewUserExpiryDate] = useState('');
  const [policeStationFilter, setPoliceStationFilter] = useState('');
  const [firStatusFilter, setFirStatusFilter] = useState<'all' | 'pending' | 'lodged'>('all');
  const [expandedPs, setExpandedPs] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'total' | 'month' | 'pending'>('total');

  useEffect(() => {
    const savedStep = localStorage.getItem('lesco_new_case_step');
    if (savedStep) {
      try {
        const step = JSON.parse(savedStep);
        if (step > 1) {
          setActiveStep(step);
        }
      } catch (e) {
        console.error('Failed to parse saved step');
      }
    }
  }, []);
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
  const [activeUsersCount, setActiveUsersCount] = useState(1);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const uq = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(uq, (snapshot) => {
      setActiveUsersCount(snapshot.size || 1);
      const list: User[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          uid: docSnap.id,
          name: data.name || 'New Employee',
          email: data.email || '',
          role: data.role || 'user',
          expiryDate: data.expiryDate || '',
          subDivision: data.subDivision || '',
          disabled: !!data.disabled,
        });
      });
      setActiveUsersList(list);
    }, (error) => {
      console.warn('Could not fetch active users list: ', error);
    });
    return () => unsubscribeUsers();
  }, []);

  const stats = useMemo(() => [
    { label: 'Total Cases', value: allFilteredCases.length.toString(), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'This Month', value: allFilteredCases.filter(c => {
        if (!c.createdAt) return false;
        const date = new Date(c.createdAt);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length.toString(), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending FIRs', value: allFilteredCases.filter(c => !c.registeredFirNo).length.toString(), icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Active Users', value: activeUsersCount.toString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  ], [allFilteredCases, activeUsersCount]);

  const activeReportCases = useMemo(() => {
    let cases = allFilteredCases;
    if (reportType === 'month') {
      const now = new Date();
      cases = cases.filter(c => {
        if (!c.createdAt) return false;
        const date = new Date(c.createdAt);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });
    } else if (reportType === 'pending') {
      cases = cases.filter(c => !c.registeredFirNo);
    }
    return cases;
  }, [allFilteredCases, reportType]);

  const activeFilterReportCases = useMemo(() => {
    let cases = activeReportCases;
    if (firStatusFilter === 'pending') {
      cases = cases.filter(c => !c.registeredFirNo);
    } else if (firStatusFilter === 'lodged') {
      cases = cases.filter(c => !!c.registeredFirNo);
    }
    return cases;
  }, [activeReportCases, firStatusFilter]);

  const totalUnitsToBeCharged = useMemo(() => {
    return activeFilterReportCases.reduce((sum, c) => {
      const val = c.netUnitsToBeCharged;
      if (!val) return sum;
      const cleanVal = val.replace(/,/g, '');
      const num = parseFloat(cleanVal);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [activeFilterReportCases]);

  // Dynamic Grouping & Calculation of Police Station states
  const policeStationStats = useMemo(() => {
    const psMap: Record<string, { name: string; total: number; pending: number; lodged: number; cases: DetectionCase[] }> = {};
    
    activeReportCases.forEach(c => {
      const ps = (c.policeStation || 'Not Assigned').trim();
      if (!psMap[ps]) {
        psMap[ps] = { name: ps, total: 0, pending: 0, lodged: 0, cases: [] };
      }
      
      const isLodged = !!c.registeredFirNo;
      psMap[ps].total += 1;
      if (isLodged) {
        psMap[ps].lodged += 1;
      } else {
        psMap[ps].pending += 1;
      }
      psMap[ps].cases.push(c);
    });
    
    return Object.values(psMap);
  }, [activeReportCases]);

  const filteredPsStats = useMemo(() => {
    return policeStationStats.filter(ps => {
      const matchesSearch = ps.name.toLowerCase().includes(policeStationFilter.toLowerCase());
      if (!matchesSearch) return false;
      
      if (firStatusFilter === 'pending') return ps.pending > 0;
      if (firStatusFilter === 'lodged') return ps.lodged > 0;
      return true;
    });
  }, [policeStationStats, policeStationFilter, firStatusFilter]);

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
    const q = query(
      collection(db, 'cases'), 
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allCases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DetectionCase));
      
      // Filter by date range if specified
      const filteredCases = allCases.filter(c => {
        if (!c.createdAt) return false;
        const caseDate = new Date(c.createdAt).toISOString().split('T')[0];
        const isAfterStart = !dateRange.start || caseDate >= dateRange.start;
        const isBeforeEnd = !dateRange.end || caseDate <= dateRange.end;
        return isAfterStart && isBeforeEnd;
      });

      setRecentCases(filteredCases.slice(0, 5));
      setAllFilteredCases(filteredCases);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cases');
    });

    return () => unsubscribe();
  }, [dateRange]);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    const toastId = toast.loading('Generating realistic LESCO theft cases...');
    try {
      const now = new Date();
      
      const case1 = {
        userId: user?.uid || 'demo-user',
        employeeCnic: "35202-1234567-1",
        employeeMobile: "+923001234567",
        employeeName: user?.name || "Muhammad Ali",
        employeeDesignation: "Sub Divisional Officer",
        employeeNameUrdu: "محمد علی",
        photoUrl: "",
        dateOfChecking: format(now, 'yyyy-MM-dd'),
        detectionDate: format(now, 'yyyy-MM-dd'),
        discrepancy: ["Direct supply from LESCO Main Cable", "Meter Body Tempered"],
        checkedBy: ["Sub Divisional Checking Team", "LS-I", "M&T Representative"],
        meterType: "S-Phase Static",
        capacity: "10-40 Amp",
        meterStatus: "Tempered",
        presentReading: "4525",
        presentReadingAtSite: "4525",
        previousReading: "4320",
        difference: "205",
        email: user?.email || "ali.sdo@lesco.gov.pk",
        mobileNo: "+923219876543",
        meterMake: "Creative Electronics",
        meterNumber: "M-45129",
        name: "Mian Mehmood Ahmad",
        nameUrdu: "میاں محمود احمد",
        address: "House 45, Sector B, Kot Radha Kishan",
        addressUrdu: "مکان 45، سیکٹر بی، کوٹ رادھا کشن",
        presentOccupier: "Mian Mehmood Ahmad",
        presentOccupierUrdu: "میاں محمود احمد",
        sanctionLoad: "4 kW",
        connectedLoad: "5.5 kW",
        loadFactor: "100%",
        customerId: "1351290",
        tariff: "A-1a(01)",
        witnesses: ["Rehman Ali (Line Superintendent)", "Imran Khan (Meter Reader)"],
        remarks: "Direct supply detected during surprise checking. Seized cable is 15 feet long, black.",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        firNumber: "FIR-441/26",
        noticeNo: "NOT-991",
        noticeDated: format(now, 'yyyy-MM-dd'),
        firNo: "PS/REQ/094",
        firDated: format(now, 'yyyy-MM-dd'),
        referenceNumber: "12345678901234",
        registeredFirNo: "FIR-105/26",
        registeredFirDated: format(now, 'yyyy-MM-dd'),
        policeStation: "Kot Radha Kishan",
        noOfAC: "2",
        splitAcCount: "1",
        windowAcCount: "1",
        acType: "Split",
        detectionPeriodFrom: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM'),
        detectionPeriodTo: format(now, 'yyyy-MM'),
        detectionPeriodMonths: "5",
        acPeriodFrom: format(new Date(now.getFullYear(), 3, 1), 'yyyy-MM'),
        acPeriodTo: format(new Date(now.getFullYear(), 8, 1), 'yyyy-MM'),
        acPeriodMonths: "2",
        unitsOfAcPeriod: "1250",
        unitsAssessed: "3200",
        unitsAlreadyCharged: "850",
        netUnitsToBeCharged: "2350",
        grandTotalUnits: "2350",
        lossAmount: "78500",
        seizureCableSize: "7/029",
        seizureCableColor: "Black",
        seizureCableLength: "15 ft",
        dBillingMemoNo: "DB-199/26",
        dBillingMemoDated: format(now, 'yyyy-MM-dd'),
        billData: {
          consumerName: "Mian Mehmood Ahmad",
          address: "House 45, Sector B, Kot Radha Kishan",
          referenceNumber: "12345678901234",
          unitsConsumed: 205,
          amountDue: 8520,
          billingMonth: format(now, 'MMM yy').toUpperCase(),
          sanctionedLoad: "4 kW",
          connectionType: "Domestic",
          customerId: "1351290",
          tariff: "A-1a(01)",
          meterNoOnBill: "M-45129",
          subDivisionName: "Kot Radha Kishan",
          feederName: "KRK-04"
        }
      };

      const case2 = {
        userId: user?.uid || 'demo-user',
        employeeCnic: "35202-1234567-1",
        employeeMobile: "+923001234567",
        employeeName: user?.name || "Muhammad Ali",
        employeeDesignation: "Sub Divisional Officer",
        employeeNameUrdu: "محمد علی",
        photoUrl: "",
        dateOfChecking: format(now, 'yyyy-MM-dd'),
        detectionDate: format(now, 'yyyy-MM-dd'),
        discrepancy: ["Shunt wire in Phase Circuit of Meter"],
        checkedBy: ["Sub Divisional Checking Team"],
        meterType: "3-Phase Static",
        capacity: "40-100 Amp",
        meterStatus: "Shunted",
        presentReading: "11234",
        presentReadingAtSite: "11234",
        previousReading: "10984",
        difference: "250",
        email: user?.email || "ali.sdo@lesco.gov.pk",
        mobileNo: "+923015551122",
        meterMake: "Microtech Electronics",
        meterNumber: "M-33412B",
        name: "Sheikh Enterprises (Rice Mill)",
        nameUrdu: "شیخ انٹرپرائزز",
        address: "Feeder Road, Chunian",
        addressUrdu: "فیڈر روڈ، چونیاں",
        presentOccupier: "Sheikh Muhammad Rafique",
        presentOccupierUrdu: "شیخ محمد رفیق",
        sanctionLoad: "15 kW",
        connectedLoad: "18.5 kW",
        loadFactor: "100%",
        customerId: "2455912",
        tariff: "B-2b(01)",
        witnesses: ["Abid Hussain (Line Superintendent-II)"],
        remarks: "Theft in 3-phase commercial connection detected through shunt placement.",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        firNumber: "",
        noticeNo: "NOT-995",
        noticeDated: format(now, 'yyyy-MM-dd'),
        firNo: "PS/REQ/099",
        firDated: format(now, 'yyyy-MM-dd'),
        referenceNumber: "56789012345678",
        registeredFirNo: "",
        registeredFirDated: "",
        policeStation: "Saddar Chunian",
        noOfAC: "0",
        splitAcCount: "0",
        windowAcCount: "0",
        acType: "Others",
        detectionPeriodFrom: format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM'),
        detectionPeriodTo: format(now, 'yyyy-MM'),
        detectionPeriodMonths: "4",
        acPeriodFrom: "",
        acPeriodTo: "",
        unitsOfAcPeriod: "0",
        unitsAssessed: "8500",
        unitsAlreadyCharged: "3100",
        netUnitsToBeCharged: "5400",
        grandTotalUnits: "5400",
        lossAmount: "215000",
        seizureCableSize: "7/0.044 4-Core",
        seizureCableColor: "Red/Yellow/Blue/Black",
        seizureCableLength: "30 ft",
        dBillingMemoNo: "DB-212/26",
        dBillingMemoDated: format(now, 'yyyy-MM-dd'),
        billData: {
          consumerName: "Sheikh Enterprises (Rice Mill)",
          address: "Feeder Road, Chunian",
          referenceNumber: "56789012345678",
          unitsConsumed: 250,
          amountDue: 75400,
          billingMonth: format(now, 'MMM yy').toUpperCase(),
          sanctionedLoad: "15 kW",
          connectionType: "Commercial",
          customerId: "2455912",
          tariff: "B-2b(01)",
          meterNoOnBill: "M-33412B",
          subDivisionName: "Chunian-I",
          feederName: "Industrial-I"
        }
      };

      const batch = writeBatch(db);
      const case1Doc = doc(collection(db, 'cases'));
      const case2Doc = doc(collection(db, 'cases'));
      batch.set(case1Doc, case1);
      batch.set(case2Doc, case2);
      await batch.commit();

      toast.success('Successfully generated realistic LESCO theft cases!', { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to generate demo cases: ' + e.message, { id: toastId });
    } finally {
      setSeeding(false);
    }
  };

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

  const handleSaveUserEdits = async (targetUid: string) => {
    if (!editDraft) return;
    const toastId = toast.loading('Saving user updates...');
    try {
      const userDocRef = doc(db, 'users', targetUid);
      const originalUser = activeUsersList.find(u => u.uid === targetUid);
      let isoDate = originalUser?.expiryDate || '';
      if (editDraft.expiryDate) {
        isoDate = new Date(editDraft.expiryDate + 'T23:59:59Z').toISOString();
      }
      await setDoc(userDocRef, {
        subDivision: editDraft.subDivision,
        expiryDate: isoDate
      }, { merge: true });
      
      toast.success('User account updated successfully!', { id: toastId });
      setEditingUserUid(null);
      setEditDraft(null);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Update failed: ${error.message}`, { id: toastId });
    }
  };

  const handleToggleUserDisabled = async (targetUid: string, currentDisabled: boolean) => {
    const nextState = !currentDisabled;
    const statusWord = nextState ? 'disabled' : 'enabled';
    const toastId = toast.loading(`Setting account to ${statusWord}...`);
    try {
      const userDocRef = doc(db, 'users', targetUid);
      await setDoc(userDocRef, { disabled: nextState }, { merge: true });
      toast.success(`Account successfully ${statusWord}!`, { id: toastId });
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      toast.error(`Action failed: ${error.message}`, { id: toastId });
    }
  };

  const handleAddNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      toast.error('Name and Email are required.');
      return;
    }
    
    const toastId = toast.loading('Creating user profile...');
    try {
      const emailQuery = query(collection(db, 'users'), where('email', '==', newUserEmail.trim().toLowerCase()));
      const querySnap = await getDocs(emailQuery);
      if (!querySnap.empty) {
        toast.error('A user with this email address already exists.', { id: toastId });
        return;
      }
      
      const placeholderUid = `pre-${newUserEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
      let isoDate = '';
      if (newUserExpiryDate) {
        isoDate = new Date(newUserExpiryDate + 'T23:59:59Z').toISOString();
      } else {
        // Default 3 days demo
        isoDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      }
      
      const newUserDoc: User = {
        uid: placeholderUid,
        name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        role: newUserRole,
        expiryDate: isoDate,
        subDivision: newUserSubDivision.trim() || 'Gulberg',
        disabled: false
      };
      
      await setDoc(doc(db, 'users', placeholderUid), newUserDoc);
      toast.success('New user pre-registered successfully!', { id: toastId });
      
      // Clear fields
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('user');
      setNewUserSubDivision('');
      setNewUserExpiryDate('');
      setShowAddUserForm(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Create failed: ${error.message}`, { id: toastId });
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCase = async (id: string) => {
    setIsDeleting(true);
    const toastId = toast.loading('Moving case to trash...');
    let originalRecentCases: DetectionCase[] | null = null;
    let originalAllFilteredCases: DetectionCase[] | null = null;
    try {
      console.log('Initiating deletion for case ID:', id);
      
      // Try to find case in local state first to make it fast and bypass getDoc cache/local state bugs
      const localCase = recentCases.find(c => c.id === id);
      
      let caseData: any = null;
      if (localCase) {
        console.log('Found case data locally in state:', localCase);
        // Exclude internal React client state id
        const { id: _, ...rest } = localCase;
        caseData = rest;
      } else {
        console.log('Case not found locally. Fetching from Firestore...');
        const caseDoc = await getDoc(doc(db, 'cases', id));
        if (caseDoc.exists()) {
          caseData = caseDoc.data();
        }
      }

      if (caseData) {
        // Save current states for potential rollback
        originalRecentCases = [...recentCases];
        originalAllFilteredCases = [...allFilteredCases];

        // Optimistic UI updates - remove immediately from lists to make changes instantaneous on screen
        setRecentCases(prev => prev.filter(c => c.id !== id));
        setAllFilteredCases(prev => prev.filter(c => c.id !== id));

        const batch = writeBatch(db);
        batch.set(doc(db, 'trash', id), {
          ...caseData,
          deletedAt: new Date().toISOString()
        });
        batch.delete(doc(db, 'cases', id));
        
        try {
          await batch.commit();
          toast.success('Case moved to trash successfully', { id: toastId });
        } catch (commitErr) {
          // Revert optimistic updates
          if (originalRecentCases) setRecentCases(originalRecentCases);
          if (originalAllFilteredCases) setAllFilteredCases(originalAllFilteredCases);
          throw commitErr;
        }
      } else {
        toast.error(`Case not found (ID: ${id})`, { id: toastId });
      }
      setCaseToDelete(null);
    } catch (err: any) {
      console.error('Delete case error:', err);
      let friendlyMessage = 'Failed to delete case.';
      if (err?.message?.includes('permission-denied') || err?.code === 'permission-denied') {
        friendlyMessage = 'Permission Denied: Only administrators or the creator of this case can delete it.';
      } else if (err?.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
      toast.error(friendlyMessage, { id: toastId, duration: 6000 });
      try {
        handleFirestoreError(err, OperationType.DELETE, 'cases');
      } catch (e) {
        console.error('Logged Firestore error:', e);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">
            Welcome back, <span className="text-brand-primary">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium"></p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {activeStep && (
            <button
              onClick={() => navigate('/new-case')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 animate-pulse flex-1 sm:flex-none justify-center"
            >
              <ArrowRight className="w-5 h-5 rotate-180" />
              Resume Case (Step {activeStep})
            </button>
          )}
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

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-4 px-2">
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Start Date</label>
          <div className="relative group">
            <input
              type="date"
              value={dateRange.start}
              max={dateRange.end || today}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  if (val > today) {
                    toast.error("Start date cannot be after today's date");
                    setDateRange(prev => ({ ...prev, start: today }));
                    return;
                  }
                  if (dateRange.end && val > dateRange.end) {
                    toast.error("Start date cannot be after end date");
                    setDateRange(prev => ({ ...prev, start: dateRange.end }));
                    return;
                  }
                }
                setDateRange(prev => ({ ...prev, start: val }));
              }}
              className="w-full sm:w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all cursor-pointer"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">End Date</label>
          <div className="relative group">
            <input
              type="date"
              value={dateRange.end}
              min={dateRange.start || undefined}
              max={today}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  if (val > today) {
                    toast.error("End date cannot be after today's date");
                    setDateRange(prev => ({ ...prev, end: today }));
                    return;
                  }
                  if (dateRange.start && val < dateRange.start) {
                    toast.error("End date cannot be less than start date");
                    setDateRange(prev => ({ ...prev, end: dateRange.start }));
                    return;
                  }
                }
                setDateRange(prev => ({ ...prev, end: val }));
              }}
              className="w-full sm:w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all cursor-pointer"
            />
          </div>
        </div>
        <div className="flex items-end h-full pt-6">
          {(dateRange.start || dateRange.end) && (
            <button
              onClick={() => setDateRange({ start: '', end: '' })}
              className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all"
              title="Clear Filter"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="bento-grid px-2">
        {stats.map((stat, i) => {
          const isPendingCard = stat.label === 'Pending FIRs';
          const isTotalCard = stat.label === 'Total Cases';
          const isMonthCard = stat.label === 'This Month';
          const isActiveUsersCard = stat.label === 'Active Users';
          const isClickable = isPendingCard || isTotalCard || isMonthCard || isActiveUsersCard;
          
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => {
                if (isClickable) {
                  if (isActiveUsersCard) {
                    setShowActiveUsersModal(true);
                  } else {
                    if (isPendingCard) {
                      setReportType('pending');
                      setFirStatusFilter('pending');
                    } else if (isMonthCard) {
                      setReportType('month');
                      setFirStatusFilter('all');
                    } else if (isTotalCard) {
                      setReportType('total');
                      setFirStatusFilter('all');
                    }
                    setShowFirDetailsModal(true);
                  }
                }
              }}
              style={{ cursor: isClickable ? 'pointer' : 'default' }}
              className={cn(
                "glass-card p-6 rounded-3xl group transition-all duration-300",
                isClickable 
                  ? "hover:scale-[1.03] hover:border-indigo-500/30 dark:hover:border-indigo-550/30 hover:shadow-xl hover:shadow-indigo-500/5 select-none" 
                  : "hover:scale-[1.02]"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-2xl transition-colors duration-300", 
                  stat.bg, 
                  isClickable ? "group-hover:bg-indigo-600 group-hover:text-white" : "group-hover:bg-brand-primary group-hover:text-white"
                )}>
                  <stat.icon className={cn("w-6 h-6", stat.color, "group-hover:text-white")} />
                </div>
                <div className="flex items-center gap-1.5">
                  {isActiveUsersCard && canManageUsers && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowActiveUsersModal(true);
                        setShowAddUserForm(true);
                      }}
                      className="text-[9px] px-2.5 py-1 font-bold uppercase tracking-wider rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/45 transition-colors cursor-pointer flex items-center gap-1 z-10"
                    >
                      <PlusCircle className="w-3 h-3 text-purple-600 dark:text-purple-400" /> Add User
                    </button>
                  )}
                  {isClickable && (
                    <span className="text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                      {isActiveUsersCard ? 'View Users' : 'View Report'}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live</span>
                </div>
              </div>
              <p className="text-sm font-bold text-neutral-900 dark:text-slate-200 mb-1">{stat.label}</p>
              <h3 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-neutral-900 dark:text-white flex items-baseline gap-2">
                {stat.value}
                {isClickable && (
                  <span className="text-[10px] sm:text-xs font-normal text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 transition-colors">
                    {isActiveUsersCard ? '(Click to view details)' : '(Click to view stats)'}
                  </span>
                )}
              </h3>
            </motion.div>
          );
        })}
      </div>

      {allFilteredCases.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-2 bg-gradient-to-r from-indigo-50/40 to-blue-50/20 dark:from-indigo-950/20 dark:to-slate-900/40 p-8 rounded-[2rem] border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-sm self-start">
              <Landmark className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-slate-100 mb-1">
                💡 Database is Empty: Start Testing Instantly!
              </h3>
              <p className="text-sm text-neutral-600 dark:text-slate-400 max-w-2xl">
                There are currently no cases recorded in your LESCO system. To test the proforma generating features, registered FIR analytics, police station workflows, and Google Sheets sync immediately, click the button to generate highly realistic, pre-populated LESCO electric theft cases.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={handleSeedDemoData}
              disabled={seeding}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-550 text-white text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:shadow-indigo-600/10 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              {seeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Cases...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  Generate Demo Cases
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/new-case')}
              className="px-6 py-3.5 bg-white dark:bg-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-700 border border-neutral-200 dark:border-slate-700 text-neutral-800 dark:text-slate-200 text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Create New Case
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Cases */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Recent Cases</h2>
            <Link to="/cases" className="text-sm font-bold text-brand-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="glass-card rounded-[2rem] overflow-hidden">
            {/* Desktop Table - Now scrollable on mobile too for "desktop view" */}
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-neutral-900 dark:text-slate-400 text-[10px] uppercase tracking-[0.2em] font-bold">
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
                    recentCases.map((item, i) => {
                      const consumerName = item.name || item.billData?.consumerName || "Unknown Consumer";
                      const referenceNumber = item.referenceNumber || item.billData?.referenceNumber || "N/A";
                      const address = item.address || item.billData?.address || "N/A";
                      const customerId = item.customerId || item.billData?.customerId || "";
                      const tariff = item.tariff || item.billData?.tariff || "";
                      return (
                        <tr key={`desktop-${item.id}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                          <td className="px-8 py-5 font-mono text-xs font-bold text-neutral-900 dark:text-slate-300">{referenceNumber}</td>
                          <td className="px-8 py-5">
                            <p className="text-sm font-bold text-neutral-900 dark:text-slate-100">{consumerName}</p>
                            <p className="text-[10px] text-neutral-500 dark:text-slate-400 font-medium truncate max-w-[200px]">{address}</p>
                          </td>
                          <td className="px-8 py-5 text-sm font-bold text-neutral-900 dark:text-slate-300">{format(new Date(item.createdAt), 'MMM d, yyyy')}</td>
                          <td className="px-8 py-5">
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                              item.registeredFirNo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {item.registeredFirNo ? 'Completed' : 'Pending'}
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
                                      name: consumerName,
                                      address: address,
                                      referenceNumber: referenceNumber,
                                      customerId: customerId,
                                      tariff: tariff,
                                      employeeName: user?.name || '',
                                      employeeDesignation: 'SDO',
                                    }
                                  });
                                }}
                               className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-200 hover:bg-brand-primary hover:text-white transition-all duration-300"
                              title="View Templates"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-200 hover:bg-brand-primary hover:text-white transition-all duration-300">
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setCaseToDelete(item.id)}
                              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-200 hover:bg-indigo-600 hover:text-white transition-all duration-300"
                              title="Delete Case"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ); })
                  )}
                </tbody>
              </table>
            </div>

          {/* Mobile Card List (Optional, but kept for better mobile experience if they prefer it) */}
          <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
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
              recentCases.map((item) => {
                const consumerName = item.name || item.billData?.consumerName || "Unknown Consumer";
                const referenceNumber = item.referenceNumber || item.billData?.referenceNumber || "N/A";
                const address = item.address || item.billData?.address || "N/A";
                const customerId = item.customerId || item.billData?.customerId || "";
                const tariff = item.tariff || item.billData?.tariff || "";
                return (
                  <div key={`mobile-${item.id}`} className="p-6 space-y-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{consumerName}</p>
                        <p className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 mt-0.5">{referenceNumber}</p>
                      </div>
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                        item.registeredFirNo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {item.registeredFirNo ? 'Done' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{format(new Date(item.createdAt), 'MMM d, yyyy')}</p>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => {
                            setError('');
                            setPreviewDoc({ 
                              type: 'DETECTION BILL PROFORMA', 
                              isEditing: true,
                              data: {
                                ...item,
                                name: consumerName,
                                address: address,
                                referenceNumber: referenceNumber,
                                customerId: customerId,
                                tariff: tariff,
                                employeeName: user?.name || '',
                                employeeDesignation: 'SDO',
                              }
                            });
                          }}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 hover:bg-brand-primary hover:text-white transition-all duration-300"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 hover:bg-brand-primary hover:text-white transition-all duration-300">
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setCaseToDelete(item.id)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-300 hover:bg-indigo-600 hover:text-white transition-all duration-300"
                        title="Delete Case"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ); })
            )}
          </div>
        </div>

        {/* Quick Actions / Templates */}
        <div className="space-y-6">
          <div className="glass-card p-8 rounded-[2rem]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">Notice Template</h2>
              <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Official</span>
            </div>
            
            <div className="relative group mb-8">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white dark:bg-slate-900 dark:border-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 leading-none flex flex-col">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">LESCO Official Notice</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Section 39-A Electricity Act</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 text-left">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <span>Direct Hooking Detection</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <span>Meter Tampering Notice</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
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
                    className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm hover:bg-black dark:hover:bg-slate-700 transition-all"
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
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <template.icon className="w-4 h-4 text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">{template.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400" />
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
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center space-y-6 border border-transparent dark:border-slate-800"
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
        {previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "bg-white dark:bg-slate-900 w-full rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col transition-all duration-500",
                previewDoc.isEditing ? "max-w-6xl" : "max-w-4xl"
              )}
            >
            <div className="p-4 md:p-6 border-b border-neutral-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 z-10 gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-slate-100 truncate max-w-[250px] sm:max-w-none">
                  {previewDoc.isEditing ? 'Edit' : 'Preview'}: {previewDoc.type}
                </h2>
                <button 
                  onClick={() => setPreviewDoc({ ...previewDoc, isEditing: !previewDoc.isEditing })}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 w-fit",
                    previewDoc.isEditing ? "bg-indigo-600 text-white" : "bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:bg-neutral-200 dark:hover:bg-slate-700"
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
                  <div className="w-full md:w-80 lg:w-96 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-slate-800 p-4 md:p-6 space-y-8 shrink-0">
                    {/* Bill Fetcher Section */}
                    <div className="space-y-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
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
                      <h3 className="text-xs font-bold text-neutral-900 dark:text-slate-100 uppercase tracking-widest">Consumer & Detection Details</h3>
                      <div className="grid grid-cols-1 gap-4">
                        {/* Consumer Info */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-neutral-900 dark:text-slate-100 uppercase border-b border-neutral-100 dark:border-slate-800 pb-1">Consumer Info</p>
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
                              <label className="block text-[10px] font-bold text-neutral-600 dark:text-slate-400 uppercase mb-1">{field.label}</label>
                              <input
                                type="text"
                                value={previewDoc.data[field.key] || ''}
                                onChange={(e) => setPreviewDoc({
                                  ...previewDoc,
                                  data: { ...previewDoc.data, [field.key]: e.target.value }
                                })}
                                className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold text-neutral-900 dark:text-slate-100"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Employee Info */}
                        <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-slate-800">
                          <p className="text-[10px] font-bold text-neutral-500 dark:text-slate-400 uppercase border-b border-neutral-50 dark:border-slate-800/50 pb-1">Employee Info</p>
                          {[
                            { key: 'employeeName', label: 'Employee Name' },
                            { key: 'employeeDesignation', label: 'Designation' },
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-[10px] font-bold text-neutral-600 dark:text-slate-400 uppercase mb-1">{field.label}</label>
                              <input
                                type="text"
                                value={previewDoc.data[field.key] || ''}
                                onChange={(e) => setPreviewDoc({
                                  ...previewDoc,
                                  data: { ...previewDoc.data, [field.key]: e.target.value }
                                })}
                                className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold text-neutral-900 dark:text-slate-100"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Detection Info */}
                        <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-slate-800">
                          <p className="text-[10px] font-bold text-neutral-900 dark:text-slate-100 uppercase border-b border-neutral-50 dark:border-slate-800/50 pb-1">Detection Info</p>
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
                            { key: 'dBillingMemoNo', label: 'D.BILL MEMO NO.' },
                            { key: 'dBillingMemoDated', label: 'D.BILL MEMO DATED', type: 'date' },
                            { key: 'registeredFirNo', label: 'Registered FIR No.' },
                            { 
                              key: 'policeStation', 
                              label: 'Police Station',
                              type: 'select',
                              options: ['Kot Radha Kishan', 'Raiwind', 'Changa Manga', 'Manga Mandi']
                            },
                          ].map((field) => (
                            <div key={field.key}>
                              <label className="block text-[10px] font-bold text-neutral-600 dark:text-slate-400 uppercase mb-1">{field.label}</label>
                              {field.type === 'select' ? (
                                <select
                                  value={previewDoc.data[field.key] || ''}
                                  onChange={(e) => setPreviewDoc({
                                    ...previewDoc,
                                    data: { ...previewDoc.data, [field.key]: e.target.value }
                                  })}
                                  className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold text-neutral-900 dark:text-slate-100"
                                >
                                  <option value="">Select...</option>
                                  {field.options?.map(opt => (
                                    <option key={opt} value={opt} className="dark:bg-slate-900">{opt}</option>
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
                                    "w-full border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold text-neutral-900 dark:text-slate-100",
                                    field.readOnly ? "bg-neutral-100 dark:bg-slate-900/50 cursor-not-allowed opacity-70" : "bg-neutral-50 dark:bg-slate-800",
                                    field.key === 'meterStatus' && previewDoc.data.meterStatus?.toUpperCase()?.includes('REPLACED') && "text-red-600 dark:text-red-400"
                                  )}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Discrepancy */}
                        <div className="pt-4 border-t border-neutral-100 dark:border-slate-800">
                          <label className="block text-[10px] font-bold text-neutral-900 dark:text-slate-100 uppercase mb-1">Discrepancy (Comma Separated)</label>
                          <textarea
                            value={(Array.isArray(previewDoc.data.discrepancy) ? previewDoc.data.discrepancy : []).join(', ')}
                            onChange={(e) => setPreviewDoc({
                              ...previewDoc,
                              data: { ...previewDoc.data, discrepancy: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                            })}
                            className="w-full bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-all h-20 font-bold text-neutral-900 dark:text-slate-100"
                          />
                        </div>

                        {/* Witnesses */}
                        <div className="pt-4 border-t border-neutral-100 dark:border-slate-800">
                          <label className="block text-[10px] font-bold text-neutral-900 dark:text-slate-100 uppercase mb-1">Witnesses (Comma Separated)</label>
                          <input
                            type="text"
                            value={(Array.isArray(previewDoc.data.witnesses) ? previewDoc.data.witnesses : []).join(', ')}
                            onChange={(e) => setPreviewDoc({
                              ...previewDoc,
                              data: { ...previewDoc.data, witnesses: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                            })}
                            className="w-full bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold text-neutral-900 dark:text-slate-100"
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

        {showFirDetailsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-[2rem] flex flex-col overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/45 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Police Station FIR Reports</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sans">Police station-wise overview of lodged vs pending FIR actions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFirDetailsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Banner Summary Cards */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-4 gap-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-900/10">
                {/* Stat 1: Total FIR Request Cases */}
                <div className="bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100/30 dark:border-blue-900/10 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Actions</p>
                    <h4 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                      {activeReportCases.length}
                    </h4>
                  </div>
                </div>

                {/* Stat 2: Total Lodged */}
                <div className="bg-emerald-50/40 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100/30 dark:border-emerald-900/10 flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lodged FIRs</p>
                    <h4 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-baseline gap-2">
                      {activeReportCases.filter(c => !!c.registeredFirNo).length}
                      <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                        ({activeReportCases.length > 0 ? Math.round((activeReportCases.filter(c => !!c.registeredFirNo).length / activeReportCases.length) * 100) : 0}%)
                      </span>
                    </h4>
                  </div>
                </div>

                {/* Stat 3: Total Pending */}
                <div className="bg-amber-50/40 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100/30 dark:border-amber-900/10 flex items-center gap-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending FIRs</p>
                    <h4 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100 flex items-baseline gap-2">
                      {activeReportCases.filter(c => !c.registeredFirNo).length}
                      <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                        ({activeReportCases.length > 0 ? Math.round((activeReportCases.filter(c => !c.registeredFirNo).length / activeReportCases.length) * 100) : 0}%)
                      </span>
                    </h4>
                  </div>
                </div>

                {/* Stat 4: Total Units Charged */}
                <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/30 dark:border-indigo-900/10 flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Zap className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units to be Charged</p>
                    <h4 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                      {totalUnitsToBeCharged.toLocaleString()}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={policeStationFilter}
                    onChange={(e) => setPoliceStationFilter(e.target.value)}
                    placeholder="Search police station..."
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl py-2 pl-10 pr-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-sans"
                  />
                </div>
                
                {/* Toggle tab filters */}
                <div className="flex bg-slate-105 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/20 select-none">
                  <button
                    onClick={() => setFirStatusFilter('all')}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                      firStatusFilter === 'all' 
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                  >
                    All Stations
                  </button>
                  <button
                    onClick={() => setFirStatusFilter('pending')}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                      firStatusFilter === 'pending' 
                        ? "bg-amber-500 text-white shadow"
                        : "text-slate-500 dark:text-slate-400 hover:text-amber-500"
                    )}
                  >
                    With Pending FIRs
                  </button>
                  <button
                    onClick={() => setFirStatusFilter('lodged')}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                      firStatusFilter === 'lodged' 
                        ? "bg-emerald-505 bg-emerald-550 bg-emerald-600 text-white shadow"
                        : "text-slate-500 dark:text-slate-400 hover:text-emerald-500"
                    )}
                  >
                    With Lodged FIRs
                  </button>
                </div>
              </div>

              {/* Scrollable list content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {filteredPsStats.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <Landmark className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Police Stations Found</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No stations match the search query or filters.</p>
                    </div>
                  </div>
                ) : (
                  filteredPsStats.map((ps) => {
                    const isExpanded = expandedPs === ps.name;
                    const lodgedPct = ps.total > 0 ? (ps.lodged / ps.total) * 100 : 0;
                    const pendingPct = ps.total > 0 ? (ps.pending / ps.total) * 100 : 0;

                    return (
                      <div 
                        key={ps.name}
                        className={cn(
                          "border rounded-2xl transition-all duration-300 bg-white dark:bg-slate-905 bg-slate-50/5 dark:bg-slate-900/60",
                          isExpanded 
                            ? "border-indigo-200 dark:border-indigo-900/60 shadow-lg" 
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-205 dark:hover:border-slate-700/80"
                        )}
                      >
                        {/* Section Header */}
                        <div 
                          onClick={() => setExpandedPs(isExpanded ? null : ps.name)}
                          className="p-5 flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="flex-1 space-y-1 mr-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <h3 className="text-md font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400">
                                  <Landmark className="w-4 h-4" />
                                </span>
                                {ps.name}
                              </h3>
                              
                              {/* Pill overview */}
                              <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
                                <span className="bg-slate-100 dark:bg-slate-805 text-slate-700 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {ps.total} {ps.total === 1 ? 'case' : 'cases'}
                                </span>
                                {ps.lodged > 0 && (
                                  <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                    {ps.lodged} Lodged
                                  </span>
                                )}
                                {ps.pending > 0 && (
                                  <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-605 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-500 animate-pulse" />
                                    {ps.pending} Pending
                                  </span>
                                )}
                                <span className="bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-sans">
                                  <Zap className="w-3 h-3 text-indigo-500" />
                                  {ps.cases.reduce((sum, c) => {
                                    const val = c.netUnitsToBeCharged;
                                    if (!val) return sum;
                                    const cleanVal = val.replace(/,/g, '');
                                    const num = parseFloat(cleanVal);
                                    return sum + (isNaN(num) ? 0 : num);
                                  }, 0).toLocaleString()} Units
                                </span>
                              </div>
                            </div>

                            {/* Dual Completion Progress Bar */}
                            <div className="pt-2 max-w-sm w-full">
                              <div className="flex h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div style={{ width: `${lodgedPct}%` }} className="bg-emerald-500 h-full rounded-l-full" />
                                <div style={{ width: `${pendingPct}%` }} className="bg-amber-500 h-full rounded-r-full" />
                              </div>
                            </div>
                          </div>

                          {/* Expansion arrow icon */}
                          <div className="p-1 mb-auto">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-indigo-500 transition-transform rotate-180" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400 transition-transform" />
                            )}
                          </div>
                        </div>

                        {/* Expanded details list */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/10 dark:bg-slate-900/[0.15]"
                            >
                              <div className="overflow-x-auto">
                                <table className="w-full text-left whitespace-nowrap">
                                  <thead>
                                    <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                                      <th className="px-6 py-3.5">Ref / Client</th>
                                      <th className="px-6 py-3.5 font-sans">Checked Date</th>
                                      <th className="px-6 py-3.5 text-right">Units to Charge</th>
                                      <th className="px-6 py-3.5">FIR Progress Status</th>
                                      <th className="px-6 py-3.5 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100/40 dark:divide-slate-800/50">
                                    {ps.cases.map((c) => {
                                      const consumerName = c.name || c.billData?.consumerName || "Unknown Consumer";
                                      const referenceNumber = c.referenceNumber || c.billData?.referenceNumber || "N/A";
                                      return (
                                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                          <td className="px-6 py-4">
                                            <div>
                                              <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200">
                                                {referenceNumber}
                                              </p>
                                              <p className="text-xs text-slate-550 dark:text-slate-405 font-medium truncate max-w-[180px] font-sans">
                                                {consumerName}
                                              </p>
                                            </div>
                                          </td>
                                        
                                        <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-350 font-mono">
                                          {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : 'N/A'}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-350 font-mono text-right">
                                          {c.netUnitsToBeCharged ? parseInt(c.netUnitsToBeCharged.replace(/,/g, '')).toLocaleString() : '0'}
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                          {c.registeredFirNo ? (
                                            <div className="space-y-0.5">
                                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                                                <ShieldCheck className="w-3 h-3" /> Lodged
                                              </span>
                                              <p className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 ml-1">
                                                FIR: {c.registeredFirNo} {c.registeredFirDated ? `(${c.registeredFirDated})` : ''}
                                              </p>
                                            </div>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-10 gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 animate-pulse">
                                              <AlertTriangle className="w-3 h-3" /> Pending FIR
                                            </span>
                                          )}
                                        </td>

                                        <td className="px-6 py-4 text-right">
                                          <button
                                            onClick={() => {
                                              setShowFirDetailsModal(false);
                                              navigate('/quick-edit', { state: { case: c } });
                                            }}
                                            className="px-3 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer select-none"
                                          >
                                            Edit FIR <ExternalLink className="w-3 h-3" />
                                          </button>
                                        </td>
                                      </tr>
                                      ); })}
                                  </tbody>
                                </table>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 select-none">
                <button
                  onClick={() => setShowFirDetailsModal(false)}
                  className="px-5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold text-slate-705 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all cursor-pointer"
                >
                  Close Report
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showActiveUsersModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[85vh] rounded-[2rem] flex flex-col overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-50 dark:bg-purple-950/45 rounded-xl text-purple-600 dark:text-purple-400">
                    <Users className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Active System Users</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium font-sans">
                      Real-time register of authorized employees currently logged into the LESCO Detection Engine
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowActiveUsersModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar / Filter */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/25 dark:bg-slate-950/10 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96 select-none">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search active users by name or email..."
                    id="search-active-users"
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 transition-all font-sans text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                    onChange={(e) => {
                      setUsersSearchFilter(e.target.value);
                    }}
                  />
                </div>
                <div className="flex items-center gap-3 select-none">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-full border border-purple-100 dark:border-purple-900/10 shrink-0 animate-pulse">
                    {activeUsersList.length} Authorized {activeUsersList.length === 1 ? 'User' : 'Users'}
                  </span>
                  {canManageUsers && (
                    <button
                      onClick={() => setShowAddUserForm(!showAddUserForm)}
                      className={cn(
                        "px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5",
                        showAddUserForm
                          ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-750 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/15"
                      )}
                    >
                      <PlusCircle className="w-4 h-4" />
                      {showAddUserForm ? 'Hide Form' : 'Add Register User'}
                    </button>
                  )}
                </div>
              </div>

              {/* Body: Active Users list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {canManageUsers && showAddUserForm && (
                  <motion.form
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    onSubmit={handleAddNewUser}
                    className="p-6 rounded-3xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/10 dark:bg-purple-950/5 space-y-4 mb-6 relative overflow-hidden shadow-sm"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                    <div className="flex items-center gap-2 mb-2 select-none">
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-950/45 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Users className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-105">
                        Pre-Register New LESCO Employee Access
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Full Name *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Muhammad Ahmad"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-101 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                        />
                      </div>
                      {/* Email */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Email Address *</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. ahmad.lesco@gmail.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-101 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                        />
                      </div>
                      {/* Sub Division */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Sub Division Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Kot Radha Kishan"
                          value={newUserSubDivision}
                          onChange={(e) => setNewUserSubDivision(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-101 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                        />
                      </div>
                      {/* Account Expiry */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Account Expires</label>
                        <input
                          type="date"
                          value={newUserExpiryDate}
                          onChange={(e) => setNewUserExpiryDate(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-101 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">System Authorization Role</label>
                        <div className="flex items-center gap-4 select-none">
                          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="radio"
                              name="role"
                              value="user"
                              checked={newUserRole === 'user'}
                              onChange={() => setNewUserRole('user')}
                              className="text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                            />
                            Field Agent (User)
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="radio"
                              name="role"
                              value="admin"
                              checked={newUserRole === 'admin'}
                              onChange={() => setNewUserRole('admin')}
                              className="text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                            />
                            Super Admin
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 select-none self-end">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddUserForm(false);
                            setNewUserName('');
                            setNewUserEmail('');
                            setNewUserRole('user');
                            setNewUserSubDivision('');
                            setNewUserExpiryDate('');
                          }}
                          className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/10 cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Pre-Register User
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
                {activeUsersList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50/50 dark:bg-slate-800/10 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800">
                    <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mb-3" />
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Loading system sessions list...</p>
                  </div>
                ) : (() => {
                  const filtered = activeUsersList.filter(u => 
                    u.name.toLowerCase().includes((usersSearchFilter || '').toLowerCase()) ||
                    u.email.toLowerCase().includes((usersSearchFilter || '').toLowerCase()) ||
                    (u.subDivision || '').toLowerCase().includes((usersSearchFilter || '').toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 dark:bg-slate-800/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Users className="w-8 h-8 text-slate-400 mb-3" />
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-slate-200 mb-1">No matching users found</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Try checking your spelling or search terms.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filtered.map(u => {
                        const isCurrentUser = u.uid === user?.uid;
                        // Initial initials for avatar icon
                        const initials = u.name
                          .split(' ')
                          .map(n => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase();

                        // Unique soft color based on user name
                        const colors = [
                          'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/10',
                          'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-100/50 dark:border-purple-900/10',
                          'bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 border-pink-100/50 dark:border-pink-900/10',
                          'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/10',
                          'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/10',
                          'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/10'
                        ];
                        const hash = u.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const assignedColor = colors[hash % colors.length];
                        const isEditing = editingUserUid === u.uid;

                        return (
                          <motion.div
                            key={u.uid}
                            layoutId={`user-card-${u.uid}`}
                            className={cn(
                              "p-5 rounded-2xl border bg-white dark:bg-slate-900 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden",
                              isCurrentUser 
                                ? "border-purple-500/40 ring-1 ring-purple-500/20 bg-purple-550/5 dark:bg-purple-950/5" 
                                : "border-slate-100 dark:border-slate-800"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className={cn("w-12 h-12 flex items-center justify-center rounded-2xl font-bold border text-sm shrink-0 shadow-sm select-none", assignedColor)}>
                                {initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm">
                                    {u.name}
                                  </h4>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {isCurrentUser && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 px-2 py-0.5 rounded-md">
                                        You
                                      </span>
                                    )}
                                    <span className={cn(
                                      "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                      u.role === 'admin' 
                                        ? "bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border-red-100 dark:border-red-900/25" 
                                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/80"
                                    )}>
                                      {u.role}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mb-1.5">
                                  {u.email}
                                </p>
                                {u.disabled ? (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    Account Disabled
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Session Active
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-sans select-none">Sub Division</span>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editDraft?.subDivision || ''}
                                    onChange={(e) => setEditDraft(prev => prev ? { ...prev, subDivision: e.target.value } : null)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-slate-100 font-bold focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                    placeholder="Enter subdivision..."
                                  />
                                ) : (
                                  <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/40 px-2 py-0.5 rounded-md block truncate">
                                    {u.subDivision || 'N/A'}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-sans select-none">Account Expires</span>
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={editDraft?.expiryDate || ''}
                                    onChange={(e) => setEditDraft(prev => prev ? { ...prev, expiryDate: e.target.value } : null)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-900 dark:text-slate-100 font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                                  />
                                ) : (
                                  <span className="font-bold text-slate-700 dark:text-slate-300 font-mono text-[10px] block truncate">
                                    {u.expiryDate ? format(new Date(u.expiryDate), 'MMM d, yyyy') : 'Never'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Admin Controls */}
                            {canManageUsers && (
                              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2.5 select-none font-sans">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleSaveUserEdits(u.uid)}
                                      className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/10 cursor-pointer flex items-center justify-center gap-1"
                                    >
                                      <Save className="w-3.5 h-3.5" /> Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingUserUid(null);
                                        setEditDraft(null);
                                      }}
                                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setEditingUserUid(u.uid);
                                        setEditDraft({
                                          subDivision: u.subDivision || '',
                                          expiryDate: u.expiryDate ? u.expiryDate.split('T')[0] : ''
                                        });
                                      }}
                                      className="flex-1 py-1.5 bg-slate-50 dark:bg-slate-950/65 dark:hover:bg-slate-800 hover:bg-purple-50 border border-slate-100 dark:border-slate-800 hover:border-purple-100 dark:hover:border-slate-700 hover:text-purple-600 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleUserDisabled(u.uid, !!u.disabled)}
                                      className={cn(
                                        "flex-1 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer flex items-center justify-center gap-1",
                                        u.disabled
                                          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100"
                                          : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 hover:bg-rose-100"
                                      )}
                                    >
                                      {u.disabled ? (
                                        <>
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Enable
                                        </>
                                      ) : (
                                        <>
                                          <X className="w-3.5 h-3.5" /> Disable
                                        </>
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Client ID info */}
                            <div className="pt-2 text-right border-t border-slate-100/40 dark:border-slate-800/40 select-none">
                              <span className="text-[8px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                                ID: {u.uid}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3 select-none">
                <button
                  onClick={() => setShowActiveUsersModal(false)}
                  className="px-5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold text-slate-705 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 rounded-xl transition-all cursor-pointer"
                >
                  Close Register
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
