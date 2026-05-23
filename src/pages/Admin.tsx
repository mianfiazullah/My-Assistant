import { Shield, Copy, Check, Zap, ArrowRight, Activity, FolderPlus, Terminal, ChevronDown, ChevronUp, PlusCircle, Save, Trash2, Edit2, CheckCircle2, X, Users, Loader2, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, where, getDocs } from 'firebase/firestore';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageUsers = user?.email?.toLowerCase() === 'mianfiazullah@gmail.com' || user?.role === 'admin';

  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('google_sheets_webhook') || 'https://script.google.com/macros/s/AKfycbzFThMoqFExs2O_Gry9SrcZ_4W-RuFI7jADKEDf0Rq8LKBgxnO-IpK9yzdsRu-CNerp/exec');
  const [webhookUrl2, setWebhookUrl2] = useState(localStorage.getItem('google_sheets_webhook_2') || '');

  // Active Users states (originally from Dashboard)
  const [activeUsersList, setActiveUsersList] = useState<User[]>([]);
  const [usersSearchFilter, setUsersSearchFilter] = useState('');
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ subDivision: string; expiryDate: string; webhookUrl: string; webhookUrl2: string } | null>(null);
  const [expandedScriptUid, setExpandedScriptUid] = useState<string | null>(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserSubDivision, setNewUserSubDivision] = useState('');
  const [newUserExpiryDate, setNewUserExpiryDate] = useState('');
  const [newUserWebhookUrl, setNewUserWebhookUrl] = useState('');
  const [newUserWebhookUrl2, setNewUserWebhookUrl2] = useState('');

  const appsScriptCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get Sub Division name/code dynamically from incoming payload (or fallback)
    var subDivision = (data["Sub Division"] || data["subDivision"] || "").toString().trim();
    if (!subDivision) {
      subDivision = "Default";
    }
    
    // Check and create Dynamic Google Drive Folder named "My Assistant [subDivision]"
    var folderName = "My Assistant " + subDivision;
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    // Check if this is a File Upload request
    if (data.action === "uploadFile") {
      var fileBlob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.fileType, data.fileName);
      var file = folder.createFile(fileBlob);
      return ContentService.createTextOutput(JSON.stringify({ 
        "success": true, 
        "message": "File saved to folder: " + folderName,
        "fileId": file.getId(),
        "url": file.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get or Create Dynamic Google Sheets Tab dynamically named like the Sub Division!
    var sheet = ss.getSheetByName(subDivision);
    if (!sheet) {
      sheet = ss.insertSheet(subDivision);
    }
    
    // Otherwise, it is standard Row Data
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length === 0 || headers[0] === "") {
      headers = [
        "Date of Checking", "Reference Number", "Sub Division", "Billing Month", "Consumer Name", "Consumer Name (Urdu)", 
        "Present Occupier", "Present Occupier (Urdu)", "Address", "Address (Urdu)", "Customer ID", 
        "Tariff", "Sanction Load", "Connected Load", "Feeder Name", "G. Total Units TO BE CHARGED", 
        "Meter No.", "Meter Make", "Meter Type", "Capacity", "Meter Status", "Meter Slow By (%)", 
        "Discrepancy", "Notice No.", "Notice Dated", "FIR Request No.", "FIR Request Dated", 
        "Registered FIR No.", "Registered FIR Dated", "Police Station", "No. of AC", "Split AC Count", 
        "Window AC Count", "AC Type", "AC Period From", "AC Period To", "AC Period Months", 
        "Units of AC Period", "Detection Period From", "Detection Period To", "Detection Period Months", 
        "Units Assessed", "Units Already Charged", "Net Units to be Charged", "D.BILL MEMO NO.", 
        "D.BILL MEMO DATED", "Loss Amount", "Seizure Cable Size", "Seizure Cable Color", 
        "Seizure Cable Length", "Checked By", "Witnesses", "Present Reading at Site", 
        "E-Mail Address", "Mobile Number", "Load Factor", "Connected Load Details", "Remarks", 
        "Employee Name", "Employee Name (Urdu)", "Employee Designation", "Employee CNIC", "Employee Mobile",
        "Evidence Photo Drive Link", "Drive Folder Link", "photoUrl"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Update links inside standard data cells
    if (!data["Drive Folder Link"]) {
      data["Drive Folder Link"] = folder.getUrl();
    }
    
    var row = [];
    for (var i = 0; i < headers.length; i++) {
      var key = headers[i];
      row.push(data[key] || "");
    }
    
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": true, 
      "message": "Data saved and folder verified/created successfully.",
      "folderName": folderName,
      "sheetName": subDivision
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      "success": false, 
      "error": error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(appsScriptCode).then(() => {
      setCopiedScript(true);
      toast.success('Google Apps Script copied successfully!');
      setTimeout(() => setCopiedScript(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy script code');
    });
  };

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

  const saveWebhooks = () => {
    localStorage.setItem('google_sheets_webhook', webhookUrl);
    localStorage.setItem('google_sheets_webhook_2', webhookUrl2);
    toast.success('Google Sheets links saved successfully!');
  };

  const getTestPayload = (options?: { customSubDivision?: string }) => {
    const rawSubDiv = (options?.customSubDivision || '11751').trim();
    const cleanNumbers = rawSubDiv.replace(/[^0-9]/g, '');
    let referenceNumberCode = '11751012345678';
    if (cleanNumbers) {
      referenceNumberCode = (cleanNumbers + '01234567890123').substring(0, 14);
    }

    return { 
      "Date of Checking": '16-05-2026',
      "Reference Number": referenceNumberCode,
      "Sub Division": rawSubDiv,
    "Billing Month": 'MAY 26',
    "Consumer Name": 'TEST CONSUMER',
    "Consumer Name (Urdu)": 'ٹیسٹ صارف',
    "Present Occupier": 'TEST OCCUPIER',
    "Present Occupier (Urdu)": 'ٹیسٹ قابض',
    "Address": '123 TEST STREET, LESCO AREA',
    "Address (Urdu)": '123 ٹیسٹ اسٹریٹ',
    "Customer ID": 'ID123456',
    "Tariff": 'A-1',
    "Sanction Load": '5 kW',
    "Connected Load": '2.5 kW',
    "Feeder Name": 'RADHA KISHAN',
    "G. Total Units TO BE CHARGED": '1500',
    "Meter No.": 'M-7890',
    "Meter Make": 'Creative',
    "Meter Type": 'S-Phase Static',
    "Capacity": '10-40 Amp',
    "Meter Status": 'Normal',
    "Meter Slow By (%)": '0%',
    "Discrepancy": 'Direct Supply From LESCO main Cable, Meter Body Tempered',
    "Notice No.": 'N-12345',
    "Notice Dated": '2026-05-01',
    "FIR Request No.": 'TO-987',
    "FIR Request Dated": '2026-05-10',
    "Registered FIR No.": 'PS-444',
    "Registered FIR Dated": '2026-05-12',
    "Police Station": 'Kot Radha Kishan',
    "No. of AC": '2',
    "Split AC Count": '1',
    "Window AC Count": '1',
    "AC Type": 'Mixed',
    "AC Period From": '2026-04',
    "AC Period To": '2026-09',
    "AC Period Months": '6',
    "Units of AC Period": '1200',
    "Detection Period From": '2026-01',
    "Detection Period To": '2026-05',
    "Detection Period Months": '5',
    "Units Assessed": '2000',
    "Units Already Charged": '500',
    "Net Units to be Charged": '1500',
    "D.BILL MEMO NO.": 'MEMO-001',
    "D.BILL MEMO DATED": '2026-05-16',
    "Loss Amount": '45000',
    "Seizure Cable Size": '7/029',
    "Seizure Cable Color": 'Black',
    "Seizure Cable Length": '10 Foot',
    "Checked By": 'Sub Divisional Checking Team, M&T Representative',
    "Witnesses": 'John Doe (S-Phase MI), Jane Smith (LS-I)',
    "Present Reading at Site": '8540',
    "E-Mail Address": 'test@example.com',
    "Mobile Number": '+923001234567',
    "Load Factor": '20%',
    "Connected Load Details": 'Light(10x20=200W); Fan(5x80=400W)',
    "Remarks": 'Test Case for Full Data Logging',
    "Employee Name": 'ADMIN TESTER',
    "Employee Name (Urdu)": 'ایڈمن ٹیسٹر',
    "Employee Designation": 'Assistant Manager',
    "Employee CNIC": '35202-1234567-1',
    "Employee Mobile": '+923112233445',
    "photoUrl": 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  };
};

  const headers = [
    "Date of Checking", "Reference Number", "Sub Division", "Billing Month", "Consumer Name", "Consumer Name (Urdu)", 
    "Present Occupier", "Present Occupier (Urdu)", "Address", "Address (Urdu)", 
    "Customer ID", "Tariff", "Sanction Load", "Connected Load", "Feeder Name", "G. Total Units TO BE CHARGED", 
    "Meter No.", "Meter Make", "Meter Type", "Capacity", "Meter Status", "Meter Slow By (%)", "Discrepancy", 
    "Notice No.", "Notice Dated", "FIR Request No.", "FIR Request Dated", 
    "Registered FIR No.", "Registered FIR Dated", "Police Station", "No. of AC", "Split AC Count", "Window AC Count", "AC Type",
    "AC Period From", "AC Period To", "AC Period Months", "Units of AC Period", 
    "Detection Period From", "Detection Period To", "Detection Period Months", 
    "Units Assessed", "Units Already Charged", "Net Units to be Charged", 
    "D.BILL MEMO NO.", "D.BILL MEMO DATED", "Loss Amount", "Seizure Cable Size", 
    "Seizure Cable Color", "Seizure Cable Length", "Checked By", "Witnesses", 
    "Present Reading at Site", "E-Mail Address", "Mobile Number", "Load Factor", 
    "Connected Load Details", "Remarks", "Employee Name", "Employee Name (Urdu)", 
    "Employee Designation", "Employee CNIC", "Employee Mobile", "Evidence Photo Drive Link", "Drive Folder Link", "photoUrl"
  ];

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('Google Sheets structure synced with latest fields!');
    }, 1000);
  };

  const handleCopyHeaders = () => {
    // Joining with tabs (\t) makes Excel/Google Sheets paste them into separate horizontal cells
    const textToCopy = headers.join('\t');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast.success('Headers copied to clipboard! Paste in Cell A1 of your Sheet.');
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
      toast.error('Failed to copy headers');
    });
  };

  // Real-time user subscriber (Moved from Dashboard)
  useEffect(() => {
    if (!canManageUsers) return;
    const uq = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(uq, (snapshot) => {
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
          webhookUrl: data.webhookUrl || '',
          webhookUrl2: data.webhookUrl2 || '',
        });
      });
      setActiveUsersList(list);
    }, (error) => {
      console.warn('Could not fetch active users list: ', error);
    });
    return () => unsubscribeUsers();
  }, [canManageUsers]);

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
        expiryDate: isoDate,
        webhookUrl: editDraft.webhookUrl,
        webhookUrl2: editDraft.webhookUrl2
      }, { merge: true });
      
      toast.success('User account updated successfully!', { id: toastId });
      setEditingUserUid(null);
      setEditDraft(null);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(`Update failed: ${error.message}`, { id: toastId });
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
        disabled: false,
        webhookUrl: newUserWebhookUrl.trim(),
        webhookUrl2: newUserWebhookUrl2.trim()
      };
      
      await setDoc(doc(db, 'users', placeholderUid), newUserDoc);
      toast.success('New user pre-registered successfully!', { id: toastId });
      
      // Clear fields
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('user');
      setNewUserSubDivision('');
      setNewUserExpiryDate('');
      setNewUserWebhookUrl('');
      setNewUserWebhookUrl2('');
      setShowAddUserForm(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(`Create failed: ${error.message}`, { id: toastId });
    }
  };

  // Guard the page to only authorize mianfiazullah or role === admin
  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-neutral-150 dark:border-slate-800 min-h-[60vh] max-w-2xl mx-auto space-y-4 shadow-xl">
        <Shield className="w-16 h-16 text-rose-500 animate-pulse mb-3" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Access Restricted</h2>
        <p className="text-neutral-500 dark:text-slate-400">
          You are not authorized to access the Admin Panel. This section is restricted to administrators and authorized officers of the LESCO Detection Engine.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-md cursor-pointer text-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 dark:text-slate-100">Admin Panel</h1>
          <p className="text-neutral-500 dark:text-slate-400">Manage users, access levels, and system settings</p>
        </div>

        {activeStep && (
          <button
            onClick={() => navigate('/new-case')}
            className="flex items-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all animate-pulse"
          >
            <Activity className="w-5 h-5" />
            <span>RESUME ACTIVE CASE (STEP {activeStep})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </header>

      <div className="grid gap-6">
        {/* Automatic Google Sheets Setup */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-slate-100 mb-2">Automatic Google Sheets Connection</h2>
              <p className="text-neutral-500 dark:text-slate-400 mb-6 text-sm">
                Paste your Google Apps Script "Web App URL" here to automatically save cases to your sheets. You can now use 2 sheets simultaneously!
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-slate-400 mb-1">
                    Google Sheets Webhook 1 (Primary)
                  </label>
                  <input 
                    type="text" 
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-slate-400 mb-1">
                    Google Sheets Webhook 2 (Secondary - Optional)
                  </label>
                  <input 
                    type="text" 
                    value={webhookUrl2}
                    onChange={(e) => setWebhookUrl2(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec (Leave empty if not required)"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={saveWebhooks}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20 text-sm"
                  >
                    Save Links
                  </button>
                </div>
              </div>
              
              <div className="mt-6 flex flex-wrap gap-4 border-t border-neutral-100 dark:border-slate-800/80 pt-4">
                <button
                  onClick={async () => {
                    if (!webhookUrl) {
                      toast.error("Webhook 1 is required to run a test.");
                      return;
                    }
                    try {
                      toast.info('Sending test data to Sheet 1...');
                      await fetch('/api/webhook-proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ webhookUrl, payload: getTestPayload({ customSubDivision: user?.subDivision }) })
                      });
                      toast.success('Test data sent to Sheet 1 successfully!');
                    } catch (e) {
                      toast.error('Failed to send test data.');
                    }
                  }}
                  className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
                >
                  <Zap className="w-4 h-4" />
                  Test Primary Sheet (1)
                </button>

                {webhookUrl2 && (
                  <button
                    onClick={async () => {
                      try {
                        toast.info('Sending test data to Sheet 2...');
                        await fetch('/api/webhook-proxy', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ webhookUrl: webhookUrl2, payload: getTestPayload({ customSubDivision: user?.subDivision }) })
                        });
                        toast.success('Test data sent to Sheet 2 successfully!');
                      } catch (e) {
                        toast.error('Failed to send test data to Sheet 2.');
                      }
                    }}
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
                  >
                    <Zap className="w-4 h-4" />
                    Test Secondary Sheet (2)
                  </button>
                )}
              </div>
              
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 italic text-amber-800 dark:text-amber-400 text-xs">
                <strong>Student Tip:</strong> Remember to set "Who has access" to "Anyone" when deploying your script in Google Sheets!
              </div>
            </div>
          </div>
        </div>

        {/* Google Apps Script Integration Helper Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-slate-100 mb-1">Google Apps Script Webhook Code (Auto-Drive Folder & Photo Sync)</h2>
                <p className="text-neutral-500 dark:text-slate-400 text-sm">
                  To automatically create folders in Google Drive using the exact same name as your sheets, and automatically upload evidence photos directly to those folders, use this updated code in your Google Sheets' Apps Script!
                </p>
              </div>

              <div className="bg-neutral-50 dark:bg-slate-800 p-4 rounded-2xl border border-neutral-100 dark:border-slate-700">
                <div className="text-xs font-mono text-neutral-600 dark:text-slate-300 space-y-2">
                  <p className="font-bold text-neutral-900 dark:text-white">🚀 Real-time Drive & Sheet Automation features included:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Creates a Google Drive folder named exactly like the spreadsheet automatically.</li>
                    <li>Receives case details and base64 evidence photos, saves them as JPEGs inside that folder.</li>
                    <li>Saves specific Google Drive view links back into your spreadsheet columns automatically!</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={handleCopyScript}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/10 text-sm"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Apps Script Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Google Apps Script Code</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Google Sheets Helper Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <Copy className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-slate-100">Google Sheets Helper</h2>
                <button
                  onClick={handleSync}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                    isSyncing 
                      ? "bg-indigo-50 text-indigo-400 cursor-not-allowed" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/10"
                  )}
                  disabled={isSyncing}
                >
                  <Zap className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                  {isSyncing ? 'Syncing...' : 'SYNC WITH LATEST FIELDS'}
                </button>
              </div>
              <p className="text-neutral-500 dark:text-slate-400 mb-6 text-sm">
                Need to set up your Google Sheet? Tap the button below to copy the header row. 
                When you paste it into Google Sheets (Cell A1), it will automatically create separate columns for all fields.
              </p>
              
              <button
                onClick={handleCopyHeaders}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-neutral-900 dark:bg-indigo-600 text-white font-medium hover:bg-neutral-800 dark:hover:bg-indigo-700 transition-colors active:scale-[0.98] shadow-xl dark:shadow-indigo-900/20"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Headers for Google Sheets</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* User Accounts & Session Manager (Moved here from Dashboard Modal) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/45 rounded-xl text-purple-600 dark:text-purple-400">
                <Users className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-slate-100">User Accounts Manager</h2>
                <p className="text-xs text-neutral-500 dark:text-slate-400">
                  Pre-register, activate, disable, or custom-configure LESCO subdivisions and sheets webhook rules for all employee accounts.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-full border border-purple-100 dark:border-purple-900/10 shrink-0">
                {activeUsersList.length} Accounts Registered
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-900/10 shrink-0">
                {activeUsersList.filter(u => !u.uid.startsWith('pre-')).length} Google Accounts
              </span>
              <button
                onClick={() => setShowAddUserForm(!showAddUserForm)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5",
                  showAddUserForm
                    ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-705 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/15"
                )}
              >
                <PlusCircle className="w-4 h-4" />
                {showAddUserForm ? 'Hide Form' : 'Register User'}
              </button>
            </div>
          </div>

          {/* New User Pre-registration Form */}
          <AnimatePresence>
            {showAddUserForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleAddNewUser}
                className="overflow-hidden mb-6 p-6 rounded-2xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/10 dark:bg-purple-950/5 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Muhammad Ahmad"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. ahmad.lesco@gmail.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Sub Division Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Kot Radha Kishan"
                      value={newUserSubDivision}
                      onChange={(e) => setNewUserSubDivision(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Account Expires</label>
                    <input
                      type="date"
                      value={newUserExpiryDate}
                      onChange={(e) => setNewUserExpiryDate(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Google Sheets Webhook (1)</label>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={newUserWebhookUrl}
                      onChange={(e) => setNewUserWebhookUrl(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Google Sheets Webhook (2 - Optional)</label>
                    <input
                      type="url"
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={newUserWebhookUrl2}
                      onChange={(e) => setNewUserWebhookUrl2(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2 border-t border-purple-100/30">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">System Authorization Role</label>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
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
                      <label className="inline-flex items-center gap-2 cursor-pointer">
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

                  <div className="flex items-center gap-2.5 self-end select-none">
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
                      className="px-4 py-2 hover:bg-slate-105 dark:hover:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl transition-all cursor-pointer"
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
          </AnimatePresence>

          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Filter registered employees by name, email, or division..."
              value={usersSearchFilter}
              onChange={(e) => setUsersSearchFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* User List Listing Grid */}
          {activeUsersList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center bg-slate-50 dark:bg-slate-800/10 rounded-2xl p-6 border border-dashed border-slate-200 dark:border-slate-800">
              <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 animate-pulse">Loading active employee registry...</p>
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">Try adjusting your spelling or division searches.</p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map(u => {
                  const isCurrentUser = u.uid === user?.uid;
                  const initials = u.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                  
                  const colors = [
                    'bg-indigo-50 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/10',
                    'bg-purple-50 dark:bg-purple-950/45 text-purple-600 dark:text-purple-400 border-purple-100/50 dark:border-purple-900/10',
                    'bg-pink-50 dark:bg-pink-950/45 text-pink-600 dark:text-pink-400 border-pink-100/50 dark:border-pink-900/10',
                    'bg-blue-50 dark:bg-blue-950/45 text-blue-600 dark:text-blue-400 border-blue-100/50 dark:border-blue-900/10',
                    'bg-teal-50 dark:bg-teal-950/45 text-teal-600 dark:text-teal-400 border-teal-100/50 dark:border-teal-900/10',
                    'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/10'
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
                          ? "border-purple-500/40 ring-1 ring-purple-500/20 bg-purple-500/5 dark:bg-purple-950/5" 
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
                                  : "bg-slate-50 dark:bg-slate-805/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                              )}>
                                {u.role}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-404 truncate mb-1.5 font-sans">
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

                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-sans select-none">Sub Division</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDraft?.subDivision || ''}
                              onChange={(e) => setEditDraft(prev => prev ? { ...prev, subDivision: e.target.value } : null)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-slate-101 font-bold focus:ring-1 focus:ring-purple-500 focus:outline-none"
                              placeholder="Enter subdivision..."
                            />
                          ) : (
                            <span className="font-bold text-slate-705 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/40 px-2 py-0.5 rounded-md block truncate">
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
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-900 dark:text-slate-101 font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            />
                          ) : (
                            <span className="font-bold text-slate-705 dark:text-slate-300 font-mono text-[10px] block truncate px-1">
                              {u.expiryDate ? format(new Date(u.expiryDate), 'MMM d, yyyy') : 'Never'}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-sans select-none">Account Type</span>
                          <span className={cn(
                            "font-bold text-[10.5px] py-1 px-2 rounded-md block truncate text-center border font-sans select-none",
                            !u.uid.startsWith('pre-')
                              ? "bg-purple-50 dark:bg-purple-950/25 text-purple-600 dark:text-purple-400 border-purple-100/50 dark:border-purple-900/10"
                              : "bg-slate-50 dark:bg-slate-805/30 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                          )}>
                            {!u.uid.startsWith('pre-') ? 'Google Account' : 'Pre-registered'}
                          </span>
                        </div>
                      </div>

                      {/* User webhook configuration fields */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-sans select-none">Google Sheets Webhook (1)</span>
                          {isEditing ? (
                            <input
                              type="url"
                              value={editDraft?.webhookUrl || ''}
                              onChange={(e) => setEditDraft(prev => prev ? { ...prev, webhookUrl: e.target.value } : null)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-900 dark:text-slate-101 font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                              placeholder="Deployment webhook URL..."
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md block truncate border border-slate-100 dark:border-slate-800/80 flex-1" title={u.webhookUrl || 'Not Configured'}>
                                {u.webhookUrl || 'Not Configured (Using Default Webhook)'}
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const targetWebhook = u.webhookUrl || webhookUrl;
                                  if (!targetWebhook) {
                                    toast.error("Webhook 1 is required to run a test.");
                                    return;
                                  }
                                  try {
                                    toast.info(`Sending test data to ${u.name}'s Sheet 1...`);
                                    await fetch('/api/webhook-proxy', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ webhookUrl: targetWebhook, payload: getTestPayload({ customSubDivision: u.subDivision }) })
                                    });
                                    toast.success(`Success! Test data sent to ${u.name}'s Webhook 1`);
                                  } catch (e) {
                                    toast.error('Failed to send test data.');
                                  }
                                }}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-lg font-bold text-[10px] cursor-pointer shrink-0 transition-all select-none"
                              >
                                Test Sheet
                              </button>
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-sans select-none">Google Sheets Webhook (2 - Optional)</span>
                          {isEditing ? (
                            <input
                              type="url"
                              value={editDraft?.webhookUrl2 || ''}
                              onChange={(e) => setEditDraft(prev => prev ? { ...prev, webhookUrl2: e.target.value } : null)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-900 dark:text-slate-101 font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                              placeholder="Optional secondary webhook URL..."
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md block truncate border border-slate-100 dark:border-slate-800/80 flex-1" title={u.webhookUrl2 || 'None (Optional)'}>
                                {u.webhookUrl2 || 'None (Optional)'}
                              </span>
                              {(u.webhookUrl2 || webhookUrl2) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const targetWebhook = u.webhookUrl2 || webhookUrl2;
                                    try {
                                      toast.info(`Sending test data to ${u.name}'s Sheet 2...`);
                                      await fetch('/api/webhook-proxy', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ webhookUrl: targetWebhook, payload: getTestPayload({ customSubDivision: u.subDivision }) })
                                      });
                                      toast.success(`Success! Test data sent to ${u.name}'s Webhook 2`);
                                    } catch (e) {
                                      toast.error('Failed to send test data to Sheet 2.');
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 rounded-lg font-bold text-[10px] cursor-pointer shrink-0 transition-all select-none"
                                >
                                  Test Sheet 2
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Google Sheet custom pre-configured script */}
                      {!isEditing && (
                        <div className="pt-2 border-t border-slate-150/40 dark:border-slate-800/40">
                          <button
                            type="button"
                            onClick={() => setExpandedScriptUid(expandedScriptUid === u.uid ? null : u.uid)}
                            className="w-full flex items-center justify-between py-1.5 px-3 bg-purple-50/50 hover:bg-purple-100/60 dark:bg-purple-950/20 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl text-[11px] font-bold font-sans transition-all cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 animate-pulse text-purple-500" />
                              {expandedScriptUid === u.uid ? "Hide Google Sheet Script" : "Show Google Sheet Script"}
                            </span>
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-all", expandedScriptUid === u.uid ? "rotate-180" : "")} />
                          </button>

                          <AnimatePresence>
                            {expandedScriptUid === u.uid && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden space-y-3 pt-3 text-[11px]"
                              >
                                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl select-text">
                                  <p className="font-bold text-slate-800 dark:text-slate-200 mb-1 font-sans">
                                    Pre-configured setup guide for: <span className="text-purple-600 dark:text-purple-400">{u.name} ({u.subDivision || 'Default'})</span>
                                  </p>
                                  <ol className="list-decimal pl-4.5 space-y-1 text-slate-500 dark:text-slate-400 font-medium font-sans">
                                    <li>Create sheet named <span className="font-bold text-slate-700 dark:text-slate-355">"{u.subDivision || 'Default'}"</span></li>
                                    <li>Open Extensions &gt; Apps Script. Paste script code below.</li>
                                    <li>Deploy as "Web App" accessible to "Anyone".</li>
                                    <li>Copy Web App URL & enter as user Webhook 1!</li>
                                  </ol>
                                </div>

                                <div className="relative">
                                  <div className="absolute top-2 right-2 flex items-center gap-1 z-10 select-none">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const code = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var subDivision = "${u.subDivision || 'Default'}";
    var folderName = "My Assistant " + subDivision;
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    if (data.action === "uploadFile") {
      var fileBlob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.fileType, data.fileName);
      var file = folder.createFile(fileBlob);
      return ContentService.createTextOutput(JSON.stringify({ "success": true, "url": file.getUrl() })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = ss.getSheetByName(subDivision) || ss.insertSheet(subDivision);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length === 0 || headers[0] === "") {
      headers = [
        "Date of Checking", "Reference Number", "Sub Division", "Billing Month", "Consumer Name", "Consumer Name (Urdu)", 
        "Present Occupier", "Present Occupier (Urdu)", "Address", "Address (Urdu)", "Customer ID", 
        "Tariff", "Sanction Load", "Connected Load", "Feeder Name", "G. Total Units TO BE CHARGED", 
        "Meter No.", "Meter Make", "Meter Type", "Capacity", "Meter Status", "Meter Slow By (%)", 
        "Discrepancy", "Notice No.", "Notice Dated", "FIR Request No.", "FIR Request Dated", 
        "Registered FIR No.", "Registered FIR Dated", "Police Station", "No. of AC", "Split AC Count", 
        "Window AC Count", "AC Type", "AC Period From", "AC Period To", "AC Period Months", 
        "Units of AC Period", "Detection Period From", "Detection Period To", "Detection Period Months", 
        "Units Assessed", "Units Already Charged", "Net Units to be Charged", "D.BILL MEMO NO.", 
        "D.BILL MEMO DATED", "Loss Amount", "Seizure Cable Size", "Seizure Cable Color", 
        "Seizure Cable Length", "Checked By", "Witnesses", "Present Reading at Site", 
        "E-Mail Address", "Mobile Number", "Load Factor", "Connected Load Details", "Remarks", 
        "Employee Name", "Employee Name (Urdu)", "Employee Designation", "Employee CNIC", "Employee Mobile",
        "Evidence Photo Drive Link", "Drive Folder Link", "photoUrl"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    if (!data["Drive Folder Link"]) data["Drive Folder Link"] = folder.getUrl();
    var row = [];
    for (var i = 0; i < headers.length; i++) {
      row.push(data[headers[i]] || "");
    }
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ "success": true, "folderName": folderName, "sheetName": subDivision })).setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "error": e.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                                        navigator.clipboard.writeText(code).then(() => {
                                          toast.success(`Copied preconfigured script for ${u.name}!`);
                                        });
                                      }}
                                      className="px-2 py-1 bg-slate-900 border border-slate-700 text-white font-bold rounded-lg text-[9px] cursor-pointer hover:bg-slate-800 flex items-center gap-1 scale-[0.8]"
                                    >
                                      <Copy className="w-3 h-3" /> Copy Code
                                    </button>
                                  </div>
                                  <textarea
                                    readOnly
                                    value={`// Google Sheets Automator specifically preconfigured for Division: "${u.subDivision || 'Default'}"
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var subDivision = "${u.subDivision || 'Default'}";
    var folderName = "My Assistant " + subDivision;
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    if (data.action === "uploadFile") {
      var fileBlob = Utilities.newBlob(Utilities.base64Decode(data.fileData), data.fileType, data.fileName);
      var file = folder.createFile(fileBlob);
      return ContentService.createTextOutput(JSON.stringify({ "success": true, "url": file.getUrl() })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = ss.getSheetByName(subDivision) || ss.insertSheet(subDivision);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.length === 0 || headers[0] === "") {
      headers = [
        "Date of Checking", "Reference Number", "Sub Division", "Billing Month", "Consumer Name", "Consumer Name (Urdu)", 
        "Present Occupier", "Present Occupier (Urdu)", "Address", "Address (Urdu)", "Customer ID", 
        "Tariff", "Sanction Load", "Connected Load", "Feeder Name", "G. Total Units TO BE CHARGED", 
        "Meter No.", "Meter Make", "Meter Type", "Capacity", "Meter Status", "Meter Slow By (%)", 
        "Discrepancy", "Notice No.", "Notice Dated", "FIR Request No.", "FIR Request Dated", 
        "Registered FIR No.", "Registered FIR Dated", "Police Station", "No. of AC", "Split AC Count", 
        "Window AC Count", "AC Type", "AC Period From", "AC Period To", "AC Period Months", 
        "Units of AC Period", "Detection Period From", "Detection Period To", "Detection Period Months", 
        "Units Assessed", "Units Already Charged", "Net Units to be Charged", "D.BILL MEMO NO.", 
        "D.BILL MEMO DATED", "Loss Amount", "Seizure Cable Size", "Seizure Cable Color", 
        "Seizure Cable Length", "Checked By", "Witnesses", "Present Reading at Site", 
        "E-Mail Address", "Mobile Number", "Load Factor", "Connected Load Details", "Remarks", 
        "Employee Name", "Employee Name (Urdu)", "Employee Designation", "Employee CNIC", "Employee Mobile",
        "Evidence Photo Drive Link", "Drive Folder Link", "photoUrl"
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    if (!data["Drive Folder Link"]) data["Drive Folder Link"] = folder.getUrl();
    var row = [];
    for (var i = 0; i < headers.length; i++) {
      row.push(data[headers[i]] || "");
    }
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ "success": true, "folderName": folderName, "sheetName": subDivision })).setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "error": e.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`}
                                    className="w-full h-24 bg-slate-900 border border-slate-800 text-slate-400 rounded-xl p-3.5 font-mono text-[9px] resize-none focus:outline-none"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Admin edit controls */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveUserEdits(u.uid)}
                              className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-600/10 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                            <button
                              type="button"
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
                              type="button"
                              onClick={() => {
                                setEditingUserUid(u.uid);
                                setEditDraft({
                                  subDivision: u.subDivision || '',
                                  expiryDate: u.expiryDate ? u.expiryDate.split('T')[0] : '',
                                  webhookUrl: u.webhookUrl || '',
                                  webhookUrl2: u.webhookUrl2 || ''
                                });
                              }}
                              className="flex-1 py-1.5 bg-slate-50 dark:bg-slate-950/65 dark:hover:bg-slate-800 hover:bg-purple-50 border border-slate-100 dark:border-slate-800 hover:border-purple-100 dark:hover:border-slate-700 hover:text-purple-600 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit Settings
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleUserDisabled(u.uid, !!u.disabled)}
                              className={cn(
                                "flex-1 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer flex items-center justify-center gap-1",
                                u.disabled
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-110"
                                  : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30 hover:bg-rose-105"
                              )}
                            >
                              {u.disabled ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Enable Account
                                </>
                              ) : (
                                <>
                                  <X className="w-3.5 h-3.5" /> Disable Account
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>

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
      </div>
    </div>
  );
}
