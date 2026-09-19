import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card rounded-[2.5rem] p-12 card-shadow border border-primary/10 text-center space-y-8">
            <div className="w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto animate-bounce">
              <AlertTriangle size={48} />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-display font-bold text-text-primary">Oops!</h1>
              <p className="text-text-secondary leading-relaxed">
                Something went wrong. Don't worry, even the best eco-warriors hit a bump sometimes.
              </p>
              {this.state.error && (
                <div className="bg-primary/5 p-4 rounded-2xl text-xs font-mono text-text-secondary text-left overflow-auto max-h-32 border border-primary/10">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-light transition-all shadow-lg shadow-primary/20"
              >
                <RefreshCcw size={20} />
                Try Again
              </button>
              <a
                href="/"
                className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-primary/5 text-text-primary rounded-2xl font-bold hover:bg-primary/10 transition-all"
              >
                <Home size={20} />
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
