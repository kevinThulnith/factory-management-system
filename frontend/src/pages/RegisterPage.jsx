// src/pages/RegisterPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/api'; // Adjust path if needed
import { ArrowLeft, UserPlus, Mail, User, Lock, Phone, Hash, Calendar, Briefcase, Loader2, CheckCircle, AlertCircle } from 'lucide-react'; // Import icons

// Define Role constants - MUST match backend choices
const ROLES = {
    OPERATOR: 'OPERATOR',
    SUPERVISOR: 'SUPERVISOR',
    ADMIN: 'ADMIN',
    MANAGER:'MANAGER',
    TECHNICIAN: 'TECHNICIAN',
    PURCHASING: 'PURCHASING',
};

function RegisterPage() {
    // Form Field States
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        name: '',
        email: '',
        nic: '',
        mobile_no: '',
        dob: '',
        role: ROLES.OPERATOR, // Default role
    });

    // Component State
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Handle general input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear errors when user starts typing
        if (error) setError('');
        if (success) setSuccess(''); // Clear success message too
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // --- Client-side Validation ---
        if (!formData.password) { setError('Password is required.'); setLoading(false); return; }
        if (formData.password.length < 8) { setError('Password must be at least 8 characters.'); setLoading(false); return; }
        if (!formData.username.trim()) { setError('Username is required.'); setLoading(false); return; }
        if (!formData.name.trim()) { setError('Full name is required.'); setLoading(false); return; }
        if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) { setError('Valid email is required.'); setLoading(false); return; }
        if (!formData.nic.trim()) { setError('NIC is required.'); setLoading(false); return; }
        // Basic 10-digit phone check (adjust regex if needed for different formats)
        if (!formData.mobile_no.trim() || !/^\d{10}$/.test(formData.mobile_no)) { setError('Valid 10-digit mobile number is required.'); setLoading(false); return; }
        if (!formData.role) { setError('Please select a role.'); setLoading(false); return; }
        // --- End Validation ---


        try {
            const userData = {
                ...formData,
                dob: formData.dob || null, // Send null if DOB is empty
            };

            console.log("Sending registration data:", userData);
            const response = await registerUser(userData); // Call your API function
            setSuccess(`User ${response.data.username} registered successfully! You can now log in.`);
            // Clear form on success (optional)
            // setFormData({ username: '', password: '', name: '', email: '', nic: '', mobile_no: '', dob: '', role: ROLES.OPERATOR });
            // Optionally redirect after a delay
            // setTimeout(() => { navigate('/login'); }, 3000);

        } catch (err) {
            let errorMessage = 'Registration failed. Please check your input and try again.';
            console.error("Registration Error Response:", err.response);
            const backendErrors = err.response?.data;
             if (typeof backendErrors === 'object' && backendErrors !== null) {
                 const errorMessages = [];
                 Object.entries(backendErrors).forEach(([field, messages]) => {
                     const messageText = Array.isArray(messages) ? messages.join(' ') : String(messages);
                     const friendlyField = field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                     errorMessages.push(`${friendlyField}: ${messageText}`);
                 });
                 if (errorMessages.length > 0) {
                     errorMessage = errorMessages.join('\n');
                 } else if (backendErrors.detail) {
                     errorMessage = backendErrors.detail;
                 } else {
                    // Fallback for unexpected object structure
                    try { errorMessage = JSON.stringify(backendErrors); } catch { /* ignore */ }
                 }
             } else if (err.message) {
                 errorMessage = err.message;
             }
            setError(errorMessage);
            console.error("Processed Error:", errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Navigate back (e.g., to dashboard or previous page)
    const handleGoBack = () => {
        navigate(-1); // Go back one step in history
        // Or navigate('/'); // Navigate to the home page explicitly
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 py-10 px-4 relative">

             {/* --- Back Button --- */}
             <button
                 onClick={handleGoBack}
                 className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 inline-flex items-center text-sm text-gray-500 hover:text-blue-700 transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1.5 bg-white/50 hover:bg-white shadow"
                 aria-label="Go back"
                 title="Go back"
             >
                 <ArrowLeft className="h-5 w-5" />
             </button>
             {/* --- End Back Button --- */}


            <div className="bg-white shadow-xl rounded-lg p-6 sm:p-8 md:p-10 w-full max-w-2xl border border-gray-200/75">
                <div className="text-center mb-8">
                    <UserPlus className="mx-auto h-12 w-12 text-blue-600" />
                     <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-800">Create New Account</h2>
                     <p className="mt-1 text-sm text-gray-500">Fill in the details to register a new user.</p>
                </div>

                {/* Display Success Message */}
                {success && (
                     <div className="mb-6 p-3 rounded-md bg-green-50 border border-green-200 text-center">
                         <CheckCircle className="inline-block h-5 w-5 text-green-500 mr-2" />
                         <p className="text-sm text-green-700 inline">{success}</p>
                     </div>
                 )}
                 {/* Display Error Message */}
                 {error && (
                      <div className="mb-6 p-3 rounded-md bg-red-50 border border-red-200">
                          <div className="flex items-start">
                             <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                             <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
                          </div>
                      </div>
                  )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Personal Information Section */}
                    <fieldset className="border-t border-gray-200 pt-5">
                         <legend className="text-lg font-medium text-gray-900 mb-4">Personal Information</legend>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Full Name */}
                            <div>
                                <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                <div className="relative rounded-md shadow-sm">
                                     <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <User className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="text" id="reg-name" name="name" value={formData.name} onChange={handleChange} required disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" />
                                </div>
                            </div>
                            {/* Email */}
                            <div>
                                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email Address <span className="text-red-500">*</span></label>
                                 <div className="relative rounded-md shadow-sm">
                                     <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <Mail className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="email" id="reg-email" name="email" value={formData.email} onChange={handleChange} required disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" />
                                </div>
                            </div>
                            {/* NIC */}
                            <div>
                                <label htmlFor="reg-nic" className="block text-sm font-medium text-gray-700 mb-1">NIC <span className="text-red-500">*</span></label>
                                 <div className="relative rounded-md shadow-sm">
                                     <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <Hash className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="text" id="reg-nic" name="nic" value={formData.nic} onChange={handleChange} required maxLength="12" disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" placeholder="e.g., 901234567V or 200012345678" />
                                </div>
                            </div>
                            {/* Mobile No */}
                            <div>
                                <label htmlFor="reg-mobile" className="block text-sm font-medium text-gray-700 mb-1">Mobile No <span className="text-red-500">*</span></label>
                                <div className="relative rounded-md shadow-sm">
                                     <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <Phone className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="tel" id="reg-mobile" name="mobile_no" value={formData.mobile_no} onChange={handleChange} required pattern="[0-9]{10}" title="Enter 10 digits" disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" />
                                </div>
                            </div>
                             {/* Date of Birth */}
                             <div>
                                <label htmlFor="reg-dob" className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                <div className="relative rounded-md bg-white text-gray-950 shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <Calendar className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="date" id="reg-dob" name="dob" value={formData.dob} onChange={handleChange} disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" max={new Date().toISOString().split("T")[0]} />
                                </div>
                            </div>
                             {/* Role */}
                             <div>
                                <label htmlFor="reg-role" className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                                 <div className="relative rounded-md shadow-sm">
                                     <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <Briefcase className="h-4 w-4 text-gray-400" /> </div>
                                     <select id="reg-role" name="role" value={formData.role} onChange={handleChange} required disabled={loading} className="block w-full pl-10 pr-3 py-2 border text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white disabled:bg-gray-100">
                                        {Object.entries(ROLES).map(([key, value]) => (
                                             <option key={key} value={value}>
                                                {value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </fieldset>

                     {/* Account Information Section */}
                     <fieldset className="border-t border-gray-200 pt-5">
                         <legend className="text-lg font-medium text-gray-900 mb-4">Account Credentials</legend>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {/* Username */}
                            <div>
                                <label htmlFor="reg-username" className="block text-sm font-medium text-gray-700 mb-1">Username <span className="text-red-500">*</span></label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <User className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="text" id="reg-username" name="username" value={formData.username} onChange={handleChange} required disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" />
                                </div>
                            </div>
                            {/* Password */}
                            <div>
                                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                                <div className="relative rounded-md shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center"> <Lock className="h-4 w-4 text-gray-400" /> </div>
                                    <input type="password" id="reg-password" name="password" value={formData.password} onChange={handleChange} required minLength="8" disabled={loading} className="block w-full pl-10 pr-3 py-2 border bg-white text-gray-950 border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Minimum 8 characters required.</p>
                            </div>
                         </div>
                     </fieldset>

                    {/* Submit Button */}
                     <div className="pt-5"> {/* Added padding top for spacing */}
                        <button
                            type="submit"
                            disabled={loading || !!success} // Disable if loading or success message shown
                            className={`w-full flex justify-center items-center font-bold py-2.5 px-4 rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-white ${
                                (loading || !!success)
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            } transition duration-150 ease-in-out`}
                        >
                            {loading && <Loader2 className="h-5 w-5 mr-2 animate-spin"/>}
                            {loading ? 'Registering...' : 'Create Account'}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}

export default RegisterPage;