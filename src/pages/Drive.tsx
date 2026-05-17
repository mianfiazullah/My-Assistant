import { useState, useEffect } from 'react';
import { getStorage, ref, listAll, getDownloadURL, getMetadata, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { FileImage, Download, Trash2, Calendar, FileText, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface DriveFile {
  name: string;
  url: string;
  timeCreated: string;
  size: number;
  contentType: string;
  fullPath: string;
}

export default function Drive() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setErrorDetails(null);
      const listRef = ref(storage, 'My Assistant');
      const res = await listAll(listRef);

      const filesData = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          const metadata = await getMetadata(itemRef);
          return {
            name: itemRef.name,
            url,
            timeCreated: metadata.timeCreated,
            size: metadata.size,
            contentType: metadata.contentType || '',
            fullPath: itemRef.fullPath
          };
        })
      );

      // Sort by newest first
      filesData.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime());
      
      setFiles(filesData);
    } catch (error) {
      console.error("Error fetching files from drive:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (file: DriveFile) => {
    if (!window.confirm(`Are you sure you want to delete ${file.name}?`)) return;
    
    try {
      setDeleting(file.fullPath);
      const fileRef = ref(storage, file.fullPath);
      await deleteObject(fileRef);
      setFiles(prev => prev.filter(f => f.fullPath !== file.fullPath));
      toast.success(`${file.name} deleted successfully`);
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error('Failed to delete file');
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
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <svg className="w-8 h-8 text-indigo-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 22H22L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            My Assistant Drive
          </h1>
          <p className="text-slate-500 mt-2">Saved Proformas and Generated Images synchronized automatically.</p>
        </div>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
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
                key={file.fullPath}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                <div className="aspect-video bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-center relative overflow-hidden">
                   {file.contentType.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.url} alt={file.name} className="object-cover w-full h-full" />
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
                        download={file.name}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-indigo-600 text-white rounded-full hover:scale-110 transition-transform"
                        title="Download"
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
                        onClick={() => handleDelete(file)}
                        disabled={deleting === file.fullPath}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                        title="Delete file"
                      >
                        {deleting === file.fullPath ? (
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
    </div>
  );
}
