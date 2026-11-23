import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface Props {
  onError(error: unknown): void;
  children: ReactNode;
}

/** Catches render errors and hands them to the app-level recovery screen. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
