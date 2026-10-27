import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button.js';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

/**
 * Error boundary component for catching React component render errors.
 * Prevents entire component tree from crashing due to errors in children.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Error boundary caught:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  // The boundary intentionally returns either the fallback UI or the children,
  // both typed ReactNode. sonarjs/function-return-type is a false positive for
  // this React render contract, so the rule is suppressed on this method only.
  // eslint-disable-next-line sonarjs/function-return-type
  override render(): ReactNode {
    if (this.state.hasError) {
      const fallback: ReactNode = this.props.fallback;
      const errorUi: ReactNode = (
        fallback || (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-3 cursor-pointer text-xs">
                <summary className="font-semibold mb-2">Error details (dev only)</summary>
                <pre className="p-3 bg-muted text-muted-foreground overflow-auto rounded text-xs">
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="mt-4">
              <Button
                variant="destructive"
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          </div>
        )
      );
      return errorUi;
    }
    return this.props.children;
  }
}
