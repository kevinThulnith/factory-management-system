// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext'; // Adjust path
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, User, Lock, Loader2, AlertCircle } from 'lucide-react'; // Import icons

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors
        setLoading(true);
        try {
            await login(username, password); // login function should handle navigation on success internally or return status
            // If login function doesn't navigate, uncomment the line below
            navigate('/');
        } catch (err) {
             // Improve error message clarity
             const errorMsg = err?.response?.data?.detail || // Specific backend error (like 'No active account found with the given credentials')
                             'Login failed. Please check your username and password.';
             setError(errorMsg);
             console.error("Login Error:", err?.response?.data || err);
        } finally {
            setLoading(false);
        }
    };

    return (
        // Use gradient background consistent with RegisterPage or a clean background
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50 py-12 px-4 sm:px-6 lg:px-8 w-screen">
            <div className="w-full max-w-md space-y-8">
                {/* Header */}
                <div className="text-center">
                    <LogIn className="mx-auto h-12 w-auto text-blue-600" />
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Sign in to your account
                    </h2>
                     <p className="mt-2 text-center text-sm text-gray-600">
                         Or contact support if you have issues
                    </p>
                </div>

                {/* Login Form Card */}
                <form
                    onSubmit={handleSubmit}
                    className="mt-8 space-y-6 bg-white shadow-xl rounded-lg p-8 border border-gray-200/75"
                >
                    {/* Error Message Display */}
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 mb-4 border border-red-200">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-red-800">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <input type="hidden" name="remember" defaultValue="true" />
                    <div className="rounded-md shadow-sm -space-y-px">
                        {/* Username Input */}
                        <div>
                            <label htmlFor="login-username" className="sr-only">Username</label>
                            <div className="relative">
                                 <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                     <User className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                 </div>
                                <input
                                    id="login-username"
                                    name="username"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={loading}
                                    // ** Styling Changes **
                                    className="appearance-none relative block w-full pl-10 pr-3 py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white disabled:bg-gray-100" // Added bg-white, adjusted padding/text size
                                    placeholder="Username"
                                />
                            </div>
                        </div>
                        {/* Password Input */}
                        <div>
                            <label htmlFor="login-password" className="sr-only">Password</label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                     <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                 </div>
                                <input
                                    id="login-password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                     // ** Styling Changes **
                                    className="appearance-none relative block w-full pl-10 pr-3 py-2.5 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white disabled:bg-gray-100" // Added bg-white
                                    placeholder="Password"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Remember Me / Forgot Password (Optional) */}
                    {/* <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                            <label htmlFor="remember-me" className="ml-2 block text-gray-900"> Remember me </label>
                        </div>
                        <div className="font-medium text-blue-600 hover:text-blue-500">
                            <Link to="/forgot-password">Forgot your password?</Link>
                        </div>
                    </div> */}

                    {/* Submit Button */}
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center items-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
                        >
                             {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin"/>}
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>
                </form>

                 {/* Contact Info */}
                 <p className="mt-6 text-center text-xs text-gray-500">
                     If you encounter issues, please contact your administrator.
                     {/* Example Contact: <a href="tel:+940000000000" className="font-medium text-blue-600 hover:text-blue-500">+94 000 000 000</a> */}
                </p>

            </div>
        </div>
    );
}

export default LoginPage;