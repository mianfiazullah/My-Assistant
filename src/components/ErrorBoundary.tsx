import { Component, ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const msg = error.message || '';
    if (
      msg.includes('Cannot set property fetch of #<Window> which has only a getter') ||
      msg.includes('Failed to connect to MetaMask') ||
      msg.includes('MetaMask')
    ) {
      // Ignore MetaMask errors
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = error.message || '';
    if (
      msg.includes('Cannot set property fetch of #<Window> which has only a getter') ||
      msg.includes('Failed to connect to MetaMask') ||
      msg.includes('MetaMask')
    ) {
      // Silently ignore
      return;
    }
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const state = (this as any).state as State;
    const props = (this as any).props as Props;

    if (state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        // Try to parse if it's a FirestoreErrorInfo JSON string
        const parsed = JSON.parse(state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Firestore ${parsed.operationType} error: ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl text-center">
            <div className="bg-indigo-500/20 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-indigo-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-neutral-400 mb-8 text-sm leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => {
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return props.children;
  }
}
