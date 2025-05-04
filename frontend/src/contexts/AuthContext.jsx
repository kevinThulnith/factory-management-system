import React, { createContext, useState, useContext, useEffect } from 'react';
import { getToken, getUserInfo, blacklistToken } from '../services/api';
import { useNavigate } from 'react-router-dom'; // Use hook for navigation

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
    const [loading, setLoading] = useState(true); // Start loading initially
    const navigate = useNavigate();

    useEffect(() => {
        const initializeAuth = async () => {
            const storedAccessToken = localStorage.getItem('accessToken');
            const storedRefreshToken = localStorage.getItem('refreshToken');

            if (storedAccessToken && storedRefreshToken) {
                setAccessToken(storedAccessToken);
                setRefreshToken(storedRefreshToken);
                try {
                    // Verify token by fetching user info
                    const response = await getUserInfo();
                    setUser(response.data);
                } catch (error) {
                    console.error("Initial auth check failed:", error);
                    // Token might be invalid/expired, try to refresh or clear
                    // The Axios interceptor should handle refresh, if it fails, logout happens there
                    // If getUserInfo fails even after potential refresh, clear local state
                     if (error.response?.status === 401) {
                         // Interceptor failed or no refresh token
                         clearAuthData();
                     }
                }
            }
            setLoading(false); // Finished loading
        };

        initializeAuth();
    }, []); // Run only once on mount

     const clearAuthData = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
    };

    const login = async (username, password) => {
        try {
            const response = await getToken({ username, password });
            const { access, refresh } = response.data;

            localStorage.setItem('accessToken', access);
            localStorage.setItem('refreshToken', refresh);
            setAccessToken(access);
            setRefreshToken(refresh);

            // Fetch user info after successful login
            const userResponse = await getUserInfo();
            setUser(userResponse.data);

            return true; // Indicate success
        } catch (error) {
            console.error("Login failed:", error);
            clearAuthData();
            throw error; // Re-throw error to be caught in component
        }
    };

    const logout = async () => {
        const currentRefreshToken = localStorage.getItem('refreshToken'); // Get token before clearing state
        clearAuthData(); // Clear local state immediately for faster UI update
        if (currentRefreshToken) {
            try {
                await blacklistToken(currentRefreshToken); // Invalidate token on backend
                console.log("Token blacklisted successfully.");
            } catch (error) {
                console.error("Failed to blacklist token:", error);
                // Log error, but proceed with logout on frontend anyway
            }
        }
         navigate('/login'); // Redirect after logout actions
    };

    const value = {
        user,
        accessToken,
        refreshToken,
        isAuthenticated: !!accessToken && !!user, // Adjusted logic
        loading, // Provide loading state
        login,
        logout,
        setUser, // Allow direct setting if needed (e.g., after registration)
        clearAuthData, // Expose for interceptor usage if needed elsewhere
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};