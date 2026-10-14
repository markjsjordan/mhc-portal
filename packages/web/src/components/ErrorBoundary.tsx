import React, { ReactNode } from 'react';

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('Error boundary caught:', error, errorInfo);
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              padding: '20px',
              color: '#d32f2f',
              backgroundColor: '#ffebee',
              border: '1px solid #d32f2f',
              borderRadius: '4px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: '10px' }}>Something went wrong</h2>
            <p style={{ margin: '0 0 10px 0' }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '10px', cursor: 'pointer' }}>
                <summary style={{ fontWeight: 'bold' }}>Error details (dev only)</summary>
                <pre
                  style={{
                    marginTop: '10px',
                    padding: '10px',
                    backgroundColor: '#fff3e0',
                    overflow: 'auto',
                    fontSize: '12px',
                    borderRadius: '2px',
                  }}
                >
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '15px',
                padding: '8px 16px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Reload page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
