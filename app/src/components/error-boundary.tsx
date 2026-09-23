import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/button';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* No customer data is sent to an unconfigured telemetry provider. */
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="my-4 text-muted-foreground">
          Reload the application to recover. Your saved changes are safe.
        </p>
        <Button onClick={() => location.reload()}>Reload application</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
