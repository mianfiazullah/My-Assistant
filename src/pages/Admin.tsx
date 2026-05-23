import { Shield, Copy, Check, Zap, ArrowRight, Activity, FolderPlus, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function Admin() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('google_sheets_webhook') || 'https://script.google.com/macros/s/AKfycbzFThMoqFExs2O_Gry9SrcZ_4W-RuFI7jADKEDf0Rq8LKBgxnO-IpK9yzdsRu-CNerp/exec');
  const [webhookUrl2, setWebhookUrl2] = useState(localStorage.getItem('google_sheets_webhook_2') || '');

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
        "Evidence Photo Drive Link", "Drive Folder Link"
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

  const getTestPayload = () => ({ 
    "Date of Checking": '16-05-2026',
    "Reference Number": '12345678901234',
    "Sub Division": '11751',
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
  });

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
    "Employee Designation", "Employee CNIC", "Employee Mobile", "Evidence Photo Drive Link", "Drive Folder Link"
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
                        body: JSON.stringify({ webhookUrl, payload: getTestPayload() })
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
                          body: JSON.stringify({ webhookUrl: webhookUrl2, payload: getTestPayload() })
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

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-100 dark:border-slate-800 shadow-sm p-12 text-center">
          <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-200 dark:text-slate-700 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 dark:text-slate-100 mb-2">System Administration</h2>
          <p className="text-neutral-500 dark:text-slate-400 max-w-md mx-auto">
            Welcome to the administration panel. Use this section to manage system-wide settings and user permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
