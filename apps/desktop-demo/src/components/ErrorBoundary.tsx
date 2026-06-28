/**
 * ErrorBoundary — catch and display render errors gracefully
 *
 * Wraps screens and components to catch render-time exceptions and surface
 * them in a controlled, accessible error state instead of crashing the entire
 * demo. Uses the alarm design register (--alarm-*) for critical state.
 *
 * Scope (AGENTS.md Rule 6): real error handling for real edge cases.
 * - Catches errors that occur during render (screen data missing, null refs, etc.)
 * - Logs errors to console for debugging
 * - Surfaces clear error UI with retry and back navigation
 * - Never hides errors (fail-open for debugging, fail-closed for UX)
 */

import {
  Component,
  type ReactNode,
  type ErrorInfo,
} from "react";

interface Props {
  children: ReactNode;
  screenName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log the full error chain for debugging
    console.error(
      `[ErrorBoundary${this.props.screenName ? ` (${this.props.screenName})` : ""}] Caught error:`,
      error,
      "\nComponent stack:",
      errorInfo.componentStack,
    );

    // Notify parent if callback provided (for metrics/reporting)
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          className="error-boundary"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="error-boundary__content">
            <div className="error-boundary__icon" aria-hidden="true">
              ⚠
            </div>

            <h2 className="error-boundary__title">
              {this.props.screenName
                ? `Error in ${this.props.screenName}`
                : "Something went wrong"}
            </h2>

            <p className="error-boundary__message">
              {this.state.error.message ||
                "An unexpected error occurred while rendering this screen."}
            </p>

            {process.env.NODE_ENV === "development" && (
              <details className="error-boundary__debug">
                <summary>Technical details (development only)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {"\n\n"}React Component Stack:{"\n"}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="error-boundary__actions">
              <button
                className="error-boundary__action error-boundary__action--retry"
                onClick={this.handleReset}
              >
                Try again
              </button>
              <button
                className="error-boundary__action error-boundary__action--back"
                onClick={() => window.history.back()}
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
