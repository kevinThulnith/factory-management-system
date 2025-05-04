// src/components/StatCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react'; // Optional: for link indication

// Define the expected props
export function StatCard({ title, value, icon, linkTo, extraClasses = '', children }) {

    // Basic validation or fallback for value
    const displayValue = (value !== undefined && value !== null) ? String(value) : '-';

    const cardContent = (
        <>
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-full bg-gray-100 ${!icon ? 'opacity-0': ''}`}> {/* Placeholder bg if no icon */}
                    {icon ? React.cloneElement(icon, { size: 22 }) : <div className="h-[22px] w-[22px]"></div>}
                </div>
                {/* Render link arrow only if linkTo is provided */}
                {linkTo && (
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                )}
            </div>
            <div>
                <h3 className="text-sm font-medium text-gray-500 truncate">{title || 'Stat'}</h3>
                <p className="mt-1 text-3xl font-semibold text-gray-900">{displayValue}</p>
            </div>
             {/* Render children (sub-stats) if provided */}
             {children && (
                <div className="mt-3">
                    {children}
                </div>
             )}
        </>
    );

    // Base classes for the card
    const baseCardClasses = "bg-white p-5 rounded-lg shadow border border-gray-200 transition-shadow duration-200 hover:shadow-md";

    // If linkTo prop exists, wrap the content in a Link component
    if (linkTo) {
        return (
            <Link to={linkTo} className={`group block ${baseCardClasses} ${extraClasses}`}>
                 {cardContent}
            </Link>
        );
    }

    // Otherwise, render as a simple div
    return (
        <div className={`${baseCardClasses} ${extraClasses}`}>
            {cardContent}
        </div>
    );
}