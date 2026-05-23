import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, User, AlertCircle, LogIn, Github } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGithubLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      console.error('GitHub auth error:', err);
      setError(err.message || 'Failed to login with GitHub. Please check if GitHub provider is enabled in Firebase configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to login with Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-600/20 mb-4">
            <ShieldAlert className="text-white w-10 h-10" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2">My Assistant</h1>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-4 rounded-xl mb-6 flex items-center gap-3 text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </motion.div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGithubLogin}
            disabled={isLoading}
            className="w-full bg-[#181a1f] hover:bg-[#202329] active:bg-[#121418] disabled:bg-neutral-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 border border-neutral-850 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <>
                <Github className="w-5 h-5 text-white" />
                Sign In with GitHub
              </>
            )}
          </button>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-neutral-100 disabled:bg-neutral-700 text-neutral-900 font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-indigo-600 rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5 text-neutral-600" />
                Sign In with Google
              </>
            )}
          </button>
          
          <p className="text-[10px] text-amber-500 text-center font-medium">
            Note: If the button doesn't respond, please ensure popups are allowed in your browser.
          </p>
          
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-neutral-500 font-semibold tracking-wider">Official Access</span>
            </div>
          </div>

          <p className="text-neutral-400 text-xs text-center leading-relaxed">
            Please use your authorized GitHub or Google account to sign in. 
            Access is restricted to authorized field personnel.
          </p>
        </div>

        <p className="text-center text-neutral-500 text-[10px] mt-8 uppercase tracking-widest">
          Authorized Personnel Only. <br />
          System access is monitored and logged.
        </p>
      </motion.div>
    </div>
  );
}
