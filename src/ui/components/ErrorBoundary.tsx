import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { errorMessage: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      errorMessage: error.message || 'Unexpected rendering error'
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ContextStudio] UI ErrorBoundary caught error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.errorMessage === null) {
      return this.props.children;
    }

    return (
      <main className="cs-shell">
        <section className="cs-card" role="alert">
          <div className="cs-card-head">
            <h2 className="cs-card-title">Context Studio</h2>
          </div>
          <p className="cs-empty-text">{this.state.errorMessage}</p>
          <div>
            <button type="button" className="cs-btn cs-btn-secondary" onClick={this.handleReload}>
              Reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}
