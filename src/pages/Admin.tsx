import { Shield, Copy, Check, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Admin() {
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(localStorage.getItem('google_sheets_webhook') || 'https://script.google.com/macros/s/AKfycbzXzjN4H0kVSuOfyNHdDb_rig-UVh7bqdvRnUPl7IGR1NNpljX3CRsm6OAVyU5gfRlZ/exec');

  const saveWebhook = () => {
    localStorage.setItem('google_sheets_webhook', webhookUrl);
    toast.success('Google Sheets link saved successfully!');
  };

  const headers = [
    "Reference Number", "Consumer Name", "Address", "Date of Checking", "Customer ID", 
    "Tariff", "Sanction Load", "Connected Load", "Meter Number", "Meter Type", 
    "Meter Make", "Capacity", "Meter Status", "Present Reading", "Previous Reading", 
    "Difference", "Units Assessed", "Net Units to be Charged", "Billing Month", 
    "FIR Number", "Police Station", "Registered FIR Date", "Remarks", "Checked By", "Witnesses"
  ];

  const handleCopyHeaders = () => {
    // Joining with tabs (\t) makes Excel/Google Sheets paste them into separate horizontal cells
    const textToCopy = headers.join('\t');
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast.success('Headers copied to clipboard!');
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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900">Admin Panel</h1>
          <p className="text-neutral-500">Manage users, access levels, and system settings</p>
        </div>
      </header>

      <div className="grid gap-6">
        {/* Automatic Google Sheets Setup */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
              <Zap className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Automatic Google Sheets Connection</h2>
              <p className="text-neutral-500 mb-4 text-sm">
                Paste your Google Apps Script "Web App URL" here to automatically save cases to your sheet.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
                <button
                  onClick={saveWebhook}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Save Link
                </button>
              </div>
              
              <button
                onClick={async () => {
                  try {
                    toast.info('Sending test data...');
                    await fetch(webhookUrl, {
                      method: 'POST',
                      mode: 'no-cors',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: 'TEST USER', ref: '12345', date: new Date().toISOString() })
                    });
                    toast.success('Test data sent! Check your Google Sheet.');
                  } catch (e) {
                    toast.error('Failed to send test data.');
                  }
                }}
                className="mt-4 flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline"
              >
                <Zap className="w-4 h-4" />
                Test Connection (Send Sample Data)
              </button>
              
              <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 italic text-amber-800 text-xs">
                <strong>Student Tip:</strong> Remember to set "Who has access" to "Anyone" when deploying your script in Google Sheets!
              </div>
            </div>
          </div>
        </div>
        {/* Google Sheets Helper Card */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
              <Copy className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-neutral-900 mb-2">Google Sheets Helper</h2>
              <p className="text-neutral-500 mb-6 text-sm">
                Need to set up your Google Sheet? Tap the button below to copy the header row. 
                When you paste it into Google Sheets (Cell A1), it will automatically create separate columns for all fields.
              </p>
              
              <button
                onClick={handleCopyHeaders}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors active:scale-[0.98]"
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

        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-12 text-center">
          <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-neutral-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-900 mb-2">System Administration</h2>
          <p className="text-neutral-500 max-w-md mx-auto">
            Welcome to the administration panel. Use this section to manage system-wide settings and user permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
