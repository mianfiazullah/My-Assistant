import { useState, useEffect } from 'react';
import { FileImage, Download, Trash2, Calendar, FileText, Loader2, ExternalLink, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { createOrGetFolder, listFilesFromGoogleDrive, deleteFileFromGoogleDrive } from '../lib/googleDrive';

interface DriveFile {
  id: string;
  name: string;
  url: string;
  timeCreated: string;
  size: number;
  contentType: string;
  thumbnailLink?: string;
}

export default function Drive() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(localStorage.getItem('google_drive_token'));

  const handleConnectGoogleDrive = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        localStorage.setItem('google_drive_token', credential.accessToken);
        setDriveToken(credential.accessToken);
        toast.success('Successfully connected to Google Drive!');
      } else {
        toast.error('Failed to get Google Drive access token.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Error connecting Google Drive: ' + error.message);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    localStorage.removeItem('google_drive_token');
    setDriveToken(null);
    setFiles([]);
    toast.success('Disconnected from Google Drive.');
  };

  const fetchFiles = async () => {
    if (!driveToken) return;
    
    try {
      setLoading(true);
      setErrorDetails(null);
      const folderId = await createOrGetFolder(driveToken, 'My Assistant');
      const driveFiles = await listFilesFromGoogleDrive(driveToken, folderId);
      
      const filesData = driveFiles.map((item: any) => ({
        id: item.id,
        name: item.name,
        url: item.webViewLink || item.webContentLink,
        timeCreated: item.createdTime,
        size: parseInt(item.size || '0', 10),
        contentType: item.mimeType || '',
        thumbnailLink: item.thumbnailLink
      }));

      setFiles(filesData);
    } catch (error) {
      console.error("Error fetching files from Google drive:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setErrorDetails(errMsg);
      if (errMsg.includes('expired')) {
        handleDisconnectGoogleDrive(); // prompt user to reconnect
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (driveToken) {
      fetchFiles();
    }
  }, [driveToken]);

  const handleDelete = async () => {
    if (!driveToken || !fileToDelete) return;
    
    try {
      setDeleting(fileToDelete.id);
      await deleteFileFromGoogleDrive(driveToken, fileToDelete.id);
      setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
      toast.success(`${fileToDelete.name} deleted successfully`);
      setFileToDelete(null);
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast.error(`Failed to delete file: ${error.message || 'Unknown error'}`);
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22H22L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            My Assistant Drive
          </h1>
          <p className="text-slate-500 mt-2">Saved Proformas and Generated Images synchronized automatically.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {driveToken ? (
            <button
              onClick={handleDisconnectGoogleDrive}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-medium border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-2 text-sm"
              title="Stop auto-uploading to actual Google Drive"
            >
              <Cloud className="w-4 h-4" />
              Disconnect Google Drive
            </button>
          ) : (
            <button
              onClick={handleConnectGoogleDrive}
              className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-medium border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-2 text-sm"
              title="Auto-upload PDFs and JPEGs to your actual Google Drive instead of just Firebase Storage"
            >
              <Cloud className="w-4 h-4" />
              Connect to Google Drive
            </button>
          )}

          <button
            onClick={fetchFiles}
            disabled={loading}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium text-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : errorDetails ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Error Connecting to Storage</h3>
          
          {errorDetails.includes('retry-limit-exceeded') ? (
            <div className="text-left mt-6 bg-red-50 dark:bg-red-500/10 p-6 rounded-xl border border-red-100 dark:border-red-500/20">
              <p className="text-red-800 dark:text-red-200 font-medium mb-4">
                Firebase Storage is likely not initialized or your security rules are blocking access.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-red-700 dark:text-red-300 text-sm">
                <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold">Firebase Console</a>.</li>
                <li>Select your project.</li>
                <li>In the left menu, click on <strong>Storage</strong> (under Build).</li>
                <li>Click <strong>Get Started</strong> and follow the prompts to enable Storage.</li>
                <li>Click on the <strong>Rules</strong> tab and ensure they allow reads/writes, for example: <br/>
                    <code className="block mt-2 bg-red-100 dark:bg-slate-800 p-2 rounded text-xs select-all text-slate-800 dark:text-slate-200">
                      rules_version = '2';<br/>
                      service firebase.storage {'{'}<br/>
                      &nbsp;&nbsp;match /b/{'{'}bucket{'}'}/o {'{'}<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;match /{"{"}allPaths=**{"}"} {'{'}<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if request.auth != null;<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
                      &nbsp;&nbsp;{'}'}<br/>
                      {'}'}
                    </code>
                </li>
		<li>If you already did this, you might need to enable CORS for your bucket if running locally.</li>
              </ol>
            </div>
          ) : (
             <p className="text-slate-500 mx-auto break-words bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
               {errorDetails}
             </p>
          )}
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileImage className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">No files saved yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            When you view proformas in a case, click the "Drive Sync" button to securely save them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                <div className="aspect-video bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-center relative overflow-hidden">
                   {file.contentType.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.thumbnailLink || file.url} alt={file.name} referrerPolicy="no-referrer" className="object-cover w-full h-full" />
                   ) : (
                      <FileText className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                   )}
                   <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform"
                        title="View Full Size"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                      <a 
                        href={file.url} 
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 transition-transform"
                        title="Open in Drive"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                   </div>
                </div>
                
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 truncate mb-1" title={file.name}>
                    {file.name}
                  </h3>
                  
                  <div className="mt-auto space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(file.timeCreated).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                        {formatFileSize(file.size)}
                      </span>
                      
                      <button 
                        onClick={() => setFileToDelete(file)}
                        disabled={deleting === file.id}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                        title="Delete file"
                      >
                        {deleting === file.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Delete File?</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2">
                  Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-slate-200">{fileToDelete.name}</span>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setFileToDelete(null)}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={!!deleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
