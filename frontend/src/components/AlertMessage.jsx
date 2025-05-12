import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';

const variants = {
    error: {
        wrapper: 'bg-red-50 border-red-200',
        icon: 'text-red-500',
        text: 'text-red-700'
    },
    warning: {
        wrapper: 'bg-yellow-50 border-yellow-200',
        icon: 'text-yellow-500',
        text: 'text-yellow-700'
    },
    info: {
        wrapper: 'bg-blue-50 border-blue-200',
        icon: 'text-blue-500',
        text: 'text-blue-700'
    },
    success: {
        wrapper: 'bg-green-50 border-green-200',
        icon: 'text-green-500',
        text: 'text-green-700'
    }
};

const icons = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle
};

export const AlertMessage = ({ 
    message, 
    variant = 'info',
    className = '',
    onDismiss
}) => {
    const styles = variants[variant] || variants.info;
    const Icon = icons[variant] || icons.info;

    return (
        <div className={`p-4 rounded-md border shadow-sm ${styles.wrapper} ${className}`}>
            <div className="flex items-start">
                <Icon className={`h-5 w-5 ${styles.icon} mr-3 flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${styles.text}`}>
                        {message}
                    </p>
                </div>
                {onDismiss && (
                    <button
                        type="button"
                        className={`ml-3 flex-shrink-0 ${styles.text} hover:opacity-75 focus:outline-none`}
                        onClick={onDismiss}
                    >
                        <span className="sr-only">Dismiss</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
};

export default AlertMessage;