// components/ui/error-message.tsx
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorMessageProps {
    error?: string | Error | null;
    className?: string;
    showIcon?: boolean;
    size?: 'xs' | 'sm' | 'md';
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
    error,
    className,
    showIcon = true,
    size = 'sm',
}) => {
    if (!error) return null;

    const errorMessage = typeof error === 'string' ? error : error.message || 'An error occurred';

    const sizes = {
        xs: 'text-xs',
        sm: 'text-sm',
        md: 'text-base',
    };

    const iconSizes = {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
    };

    return (
        <div
            className={cn(
                'flex items-center space-x-1 text-red-600',
                sizes[size],
                className
            )}
            role="alert"
            aria-live="polite"
        >
            {showIcon && (
                <AlertCircle className={cn('flex-shrink-0', iconSizes[size])} />
            )}
            <span>{errorMessage}</span>
        </div>
    );
};

export default ErrorMessage;