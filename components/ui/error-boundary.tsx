// components/ui/error-boundary.tsx
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorDisplay } from './error-display';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[200px] flex items-center justify-center p-4">
                    <div className="max-w-md w-full">
                        <ErrorDisplay
                            error={this.state.error}
                            title="Something went wrong"
                            variant="destructive"
                            size="lg"
                            showRetry
                            onRetry={this.handleRetry}
                        >
                            <p className="text-xs mt-2 opacity-75">
                                Please try again or contact support if the problem persists.
                            </p>
                        </ErrorDisplay>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;