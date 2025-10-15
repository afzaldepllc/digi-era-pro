// components/ui/field-error.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export interface FieldErrorProps {
    error?: string | null;
    className?: string;
    id?: string;
}

const FieldError: React.FC<FieldErrorProps> = ({
    error,
    className,
    id,
}) => {
    if (!error) return null;

    return (
        <p
            id={id}
            className={cn(
                'text-xs text-red-600 mt-1',
                className
            )}
            role="alert"
            aria-live="polite"
        >
            {error}
        </p>
    );
};

export default FieldError;