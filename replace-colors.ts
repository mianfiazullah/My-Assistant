import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (filepath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./src', (filepath) => {
  if (filepath.endsWith('.tsx') || filepath.endsWith('.ts') || filepath.endsWith('.css')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;
    content = content.replace(/bg-red-/g, 'bg-indigo-');
    content = content.replace(/text-red-/g, 'text-indigo-');
    content = content.replace(/border-red-/g, 'border-indigo-');
    content = content.replace(/ring-red-/g, 'ring-indigo-');
    content = content.replace(/shadow-red-/g, 'shadow-indigo-');
    content = content.replace(/from-red-/g, 'from-indigo-');
    content = content.replace(/to-red-/g, 'to-indigo-');
    content = content.replace(/accent-red-/g, 'accent-indigo-');
    content = content.replace(/bg-rose-/g, 'bg-indigo-');
    content = content.replace(/text-rose-/g, 'text-indigo-');
    content = content.replace(/shadow-rose-/g, 'shadow-indigo-');
    
    // Also make big padding buttons responsive
    content = content.replace(/px-8 py-4/g, 'px-4 sm:px-8 py-3 sm:py-4 text-sm sm:text-base');
    content = content.replace(/px-6 py-3/g, 'px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base');
    content = content.replace(/p-4 rounded-full/g, 'p-3 sm:p-4 rounded-full');
    content = content.replace(/w-16 h-16/g, 'w-12 h-12 sm:w-16 sm:h-16');
    content = content.replace(/text-4xl/g, 'text-2xl sm:text-3xl md:text-4xl');
    content = content.replace(/text-3xl/g, 'text-xl sm:text-2xl md:text-3xl');
    content = content.replace(/text-lg font-bold/g, 'text-base sm:text-lg font-bold');

    if (content !== original) {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log('Updated ' + filepath);
    }
  }
});
