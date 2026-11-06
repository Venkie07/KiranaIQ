import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';
import { Component, type ErrorInfo, type ReactNode } from 'react';

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[app] render error', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="state-box" role="alert">
          <h1>Something went wrong</h1>
          <p className="text-sm muted">The app ran into an unexpected error.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.assign('/')}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  );
}

export default App;