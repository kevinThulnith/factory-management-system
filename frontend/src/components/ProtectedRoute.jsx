import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        // Show a loading indicator while checking auth status
        return <div>Loading authentication status...</div>;
    }

    // If authenticated, render the child route (Outlet)
    // If not authenticated, redirect to the login page
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export default ProtectedRoute;