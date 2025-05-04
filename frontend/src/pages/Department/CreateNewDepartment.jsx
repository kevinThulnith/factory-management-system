// src/pages/departments/CreateNewDepartment.jsx // Or your actual path
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useNavigate, Link } from 'react-router-dom';
// Adjust import path based on your project structure
// Need getUserDetail for the lookup
import { createDepartment, getUserDetail } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
import {
    Building2, Save, X, ArrowLeft, Loader2, MapPin, User, FileText,
    CheckCircle, XCircle // Icons for lookup status
} from 'lucide-react';

// --- Debounce Hook (Copy from MachineFormPage or import if centralized) ---
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}
// --- End Debounce Hook ---

function CreateNewDepartment() {
    // --- State ---
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        location: '',
        supervisor: null, // Will store the *validated* numeric ID or null
    });

    // State for supervisor input and lookup (like MachineFormPage)
    const [supervisorInput, setSupervisorInput] = useState(''); // Raw string from input
    const [supervisorLookupLoading, setSupervisorLookupLoading] = useState(false);
    const [supervisorLookupError, setSupervisorLookupError] = useState('');
    const [fetchedSupervisorName, setFetchedSupervisorName] = useState(null); // Name if found

    // Component State
    const [loading, setLoading] = useState(false); // For form submission
    const [error, setError] = useState(''); // General form errors
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Debounced Supervisor ID for Fetching ---
    const debouncedSupervisorInput = useDebounce(supervisorInput, 500); // 500ms debounce

    // Check Auth on Mount
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // --- Effect for Debounced Supervisor Lookup ---
    useEffect(() => {
        // Logic copied and adapted from MachineFormPage's operator lookup
        if (!debouncedSupervisorInput) {
            setSupervisorLookupLoading(false);
            setSupervisorLookupError('');
            setFetchedSupervisorName(null);
            // Clear validated ID if input is cleared
            if (formData.supervisor !== null) {
                setFormData(prev => ({ ...prev, supervisor: null }));
            }
            return;
        }

        const lookupSupervisor = async (idString) => {
            const numericId = parseInt(idString, 10);
            if (isNaN(numericId) || numericId <= 0) {
                setSupervisorLookupError('Invalid ID format.');
                setFetchedSupervisorName(null);
                setFormData(prev => ({ ...prev, supervisor: null }));
                return;
            }
            // Avoid refetch if already validated
            if (numericId === formData.supervisor && fetchedSupervisorName) {
                return;
            }

            console.log(`Looking up supervisor ID: ${numericId}`);
            setSupervisorLookupLoading(true);
            setSupervisorLookupError('');
            setFetchedSupervisorName(null);

            try {
                const userRes = await getUserDetail(numericId); // Use the API function
                const userData = userRes?.data;

                if (userData && userData.id) {
                    setFetchedSupervisorName(userData.name || userData.username || `User ID ${userData.id}`);
                    setFormData(prev => ({ ...prev, supervisor: numericId })); // Store validated ID
                    setSupervisorLookupError('');
                } else {
                    setSupervisorLookupError('User not found.');
                    setFetchedSupervisorName(null);
                    setFormData(prev => ({ ...prev, supervisor: null }));
                }
            } catch (err) {
                console.error(`Failed to lookup supervisor (ID: ${numericId}):`, err);
                if (err.response?.status === 404) {
                    setSupervisorLookupError('User not found.');
                } else {
                    setSupervisorLookupError('Lookup failed.');
                }
                setFetchedSupervisorName(null);
                setFormData(prev => ({ ...prev, supervisor: null }));
            } finally {
                setSupervisorLookupLoading(false);
            }
        };

        lookupSupervisor(debouncedSupervisorInput);

    }, [debouncedSupervisorInput, formData.supervisor, fetchedSupervisorName]); // Dependencies

    // --- Handlers ---
    // Handles fields other than supervisor input
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value // Store raw value for name, description, location
        }));
        if (error) setError(''); // Clear general form error
    };

    // Specific handler for the supervisor ID text input
    const handleSupervisorInputChange = (e) => {
        const value = e.target.value;
        setSupervisorInput(value); // Update raw input state

        // Immediately clear validation when user types
        if (value === '') {
            setSupervisorLookupLoading(false);
            setSupervisorLookupError('');
            setFetchedSupervisorName(null);
            setFormData(prev => ({...prev, supervisor: null})); // Clear validated ID too
        }
        // Actual fetch happens in debounced effect
    };


    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous general errors

        // Pre-submission checks for supervisor lookup (from MachineFormPage)
        if (supervisorLookupLoading) {
            setError('Please wait for supervisor verification to complete.');
            return;
        }
        if (supervisorInput && supervisorLookupError) {
            setError(`Supervisor ID is invalid: ${supervisorLookupError}`);
            return;
        }
        if (supervisorInput && formData.supervisor === null && !supervisorLookupError) {
            setError('Supervisor verification pending/failed. Please re-check.');
            return;
        }
         if (!supervisorInput && formData.supervisor !== null) {
             console.warn("Mismatch: Supervisor input empty but formData has ID. Clearing.");
             setFormData(prev => ({...prev, supervisor: null}));
         }

        // Other basic validation
        if (!formData.name.trim()) {
            setError('Department name cannot be empty.');
            return;
        }
        setLoading(true);

        // Prepare payload - formData.supervisor now holds validated ID or null
        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            location: formData.location.trim() || null,
            supervisor: formData.supervisor, // Directly use the validated ID or null
        };

        console.log("Creating department with payload:", payload);

        try {
            await createDepartment(payload);
            console.log("Department created successfully");
            navigate('/departments'); // Navigate back on success
        } catch (err) {
            // Error handling remains largely the same, but ensure supervisor errors are clear
            console.error("Failed to create department:", err.response || err);
            let errorMessage = 'Failed to create department. Please check your input.';
            const backendErrors = err.response?.data;

             if (typeof backendErrors === 'object' && backendErrors !== null) {
                 const errors = [];
                 for (const key in backendErrors) {
                     const formattedField = key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                     const messages = Array.isArray(backendErrors[key]) ? backendErrors[key].join(' ') : backendErrors[key];
                      // Explicitly mention if the supervisor ID was the issue
                     if (key === 'supervisor') {
                        errors.push(`${formattedField}: ${messages} (Ensure the ID is valid and exists)`);
                     } else {
                        errors.push(`${formattedField}: ${messages}`);
                     }
                 }
                 if (errors.length > 0) {
                     errorMessage = errors.join(' | ');
                 } else if (backendErrors.detail) {
                     errorMessage = backendErrors.detail;
                 }
             } else if (err.message) {
                 errorMessage = err.message;
             }
            setError(errorMessage);

        } finally {
             setLoading(false); // Ensure loading stops on error
        }
    };

    // --- RENDERING ---
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             {/* Back Button */}
            <Link
                to="/departments"
                className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 mb-4 group"
            >
                <ArrowLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" />
                Back to Departments
            </Link>

             {/* Main Card */}
             <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                 <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Building2 className="h-6 w-6 mr-2 text-blue-600"/>
                         Create New Department
                     </h2>
                 </div>

                 {/* Card Body - Form */}
                 <form onSubmit={handleSubmit} className="p-6 space-y-5 ">
                     {/* Form Error Display */}
                     {error && (
                         <div className="p-3 rounded-md bg-red-50 border border-red-200">
                             <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
                         </div>
                      )}

                      {/* Name */}
                     <div>
                         <label htmlFor="dept-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Building2 className="h-4 w-4 mr-1 text-gray-400 opacity-70"/> Department Name <span className="text-red-500 ml-1">*</span>
                         </label>
                         <input
                             type="text" id="dept-name" name="name"
                             value={formData.name} onChange={handleInputChange} required
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="e.g., Production Unit A"
                         />
                     </div>

                     {/* Location */}
                     <div>
                         <label htmlFor="dept-loc" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <MapPin className="h-4 w-4 mr-1 text-gray-400"/> Location
                         </label>
                         <input
                             type="text" id="dept-loc" name="location"
                             value={formData.location || ''}
                             onChange={handleInputChange}
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="e.g., Building 3, Floor 2"
                         />
                     </div>

                     {/* --- MODIFIED: Supervisor ID Input + Lookup --- */}
                      <div>
                         <label htmlFor="dept-supervisor-id" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <User className="h-4 w-4 mr-1 text-gray-400"/> Supervisor ID (Optional)
                         </label>
                         <div className="flex items-center space-x-3">
                              <input
                                  type="number"
                                  id="dept-supervisor-id"
                                  name="supervisorInput" // Different name for the raw input
                                  value={supervisorInput}
                                  onChange={handleSupervisorInputChange} // Use dedicated handler
                                  min="1" step="1"
                                  disabled={loading}
                                  className="shadow-sm block w-full max-w-xs border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500" // Applied styling
                                  placeholder="Enter User ID or leave blank"
                              />
                              {/* Supervisor Lookup Status Display */}
                              <div className="flex items-center text-sm h-9">
                                  {supervisorLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  {!supervisorLookupLoading && supervisorLookupError && (
                                      <span className="flex items-center text-red-600">
                                          <XCircle className="h-4 w-4 mr-1 text-red-500" /> {supervisorLookupError}
                                      </span>
                                  )}
                                  {!supervisorLookupLoading && !supervisorLookupError && fetchedSupervisorName && (
                                      <span className="flex items-center text-green-600">
                                          <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> {fetchedSupervisorName}
                                      </span>
                                  )}
                                  {!supervisorLookupLoading && !fetchedSupervisorName && !supervisorLookupError && supervisorInput && (
                                      <span className="text-gray-500 italic">Verifying...</span>
                                  )}
                              </div>
                          </div>
                     </div>
                     {/* --- End Modification --- */}


                      {/* Description */}
                     <div>
                         <label htmlFor="dept-desc" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <FileText className="h-4 w-4 mr-1 text-gray-400"/> Description
                         </label>
                         <textarea
                             id="dept-desc" name="description" rows="4"
                             value={formData.description || ''}
                             onChange={handleInputChange}
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="Enter a brief description of the department..."
                         ></textarea>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200">
                         <Link
                             to="/departments"
                             className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                             onClick={(e) => { if (loading) e.preventDefault(); }}
                             aria-disabled={loading}
                         >
                             <X className="h-4 w-4 mr-1.5" />
                             Cancel
                         </Link>
                         <button
                             type="submit"
                             className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                             // Also disable if supervisor lookup is active
                             disabled={loading || supervisorLookupLoading}
                         >
                             {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5" />}
                             {loading ? 'Creating...' : 'Create Department'}
                         </button>
                     </div>
                 </form>
             </div>
        </div>
    );
}

export default CreateNewDepartment;