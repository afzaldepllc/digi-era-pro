// components/ui/error-toast.tsx
import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ErrorToastProps {
    error?: string | Error | null;
    title?: string;
    onClose?: () => void;
    duration?: number;
    className?: string;
}

const ErrorToast: React.FC<ErrorToastProps> = ({
    error,
    title = 'Error',
    onClose,
    duration = 5000,
    className,
}) => {
    const [isVisible, setIsVisible] = React.useState(true);

    React.useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => onClose?.(), 300);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    if (!error || !isVisible) return null;

    const errorMessage = typeof error === 'string' ? error : error.message || 'An unexpected error occurred';

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300);
    };

    return (
        <div
            className={cn(
                'fixed top-4 right-4 z-50 max-w-sm w-full',
                'bg-red-50 border border-red-200 rounded-lg shadow-lg',
                'transform transition-all duration-300 ease-in-out',
                isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
                className
            )}
            role="alert"
            aria-live="assertive"
        >
            <div className="p-4">
                <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="ml-3 flex-1">
                        <h3 className="text-sm font-medium text-red-900">
                            {title}
                        </h3>
                        <p className="text-sm text-red-700 mt-1">
                            {errorMessage}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="ml-4 inline-flex text-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorToast;