// src/pages/departments/CreateNewDepartment.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Adjust import path based on your project structure
// Need getUserInfo to check role, getUserDetail for supervisor lookup, createDepartment to save
import { createDepartment, getUserDetail, getUserInfo } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
import {
    Building2, Save, X, ArrowLeft, Loader2, MapPin, User, FileText,
    CheckCircle, XCircle, ShieldAlert // Icons
} from 'lucide-react';

// --- Role Constants ---
// Ensure these values EXACTLY match the role strings stored in your user objects/backend
const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    // Add other roles if they exist, even if they don't have access here
    SUPERVISOR: 'SUPERVISOR',
    OPERATOR: 'OPERATOR',
    TECHNICIAN: 'TECHNICIAN',
    PURCHASING: 'PURCHASING',
};

// --- Debounce Hook ---
// Included directly for completeness, but ideally import from a shared utility file
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        // Cancel the timeout if value changes (also on delay change or unmount)
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

    // State for supervisor input and lookup
    const [supervisorInput, setSupervisorInput] = useState(''); // Raw string from input
    const [supervisorLookupLoading, setSupervisorLookupLoading] = useState(false);
    const [supervisorLookupError, setSupervisorLookupError] = useState('');
    const [fetchedSupervisorName, setFetchedSupervisorName] = useState(null); // Name if found

    // Component State
    const [loading, setLoading] = useState(false); // For form submission loading
    const [error, setError] = useState(''); // General form/validation/permission errors
    const [authLoading, setAuthLoading] = useState(true); // For checking user permission initially
    const [canAccess, setCanAccess] = useState(false); // Track if user has permission to be on this page

    const navigate = useNavigate();
    const { isAuthenticated } = useAuth(); // Get authentication status

    // --- Debounced Supervisor ID for Fetching ---
    const debouncedSupervisorInput = useDebounce(supervisorInput, 500); // 500ms debounce

    // --- Check Authorization ---
     useEffect(() => {
        let isMounted = true;
        setAuthLoading(true);
        setError(''); // Clear previous errors

        if (!isAuthenticated) {
            // Redirect immediately if not logged in, adding a message for context
            navigate('/login?message=Authentication required to create departments');
            return; // Stop execution
        }

        // Fetch user info to check role
        getUserInfo()
            .then(response => {
                if (!isMounted) return;
                const currentUser = response.data;
                // *** IMPORTANT: Adjust role check condition as needed based on your user data structure ***
                const hasPermission = !!(
                    currentUser?.is_staff ||
                    currentUser?.is_superuser ||
                    currentUser?.role?.toUpperCase() === ROLES.ADMIN ||
                    currentUser?.role?.toUpperCase() === ROLES.MANAGER
                );
                setCanAccess(hasPermission);
                if (!hasPermission) {
                    // Set a specific error message if user is logged in but lacks permission
                    setError('Access Denied: You do not have permission to create departments.');
                }
                console.log("CreateDepartment: Auth check complete. Has Permission:", hasPermission);
            })
            .catch(err => {
                 if (!isMounted) return;
                console.error("CreateDepartment: Failed to verify user role:", err);
                setError('Could not verify your permissions. Please try again later.');
                setCanAccess(false); // Deny access on error
            })
            .finally(() => {
                 if (isMounted) setAuthLoading(false); // Finish auth loading check
            });

         // Cleanup function to prevent state updates if the component unmounts during async operations
         return () => {
             isMounted = false;
         };

    }, [isAuthenticated, navigate]); // Re-run only if authentication status changes


    // --- Effect for Debounced Supervisor Lookup (Only runs if user can access and input changes) ---
    useEffect(() => {
        // Don't run if user doesn't have access, input is empty, or lookup is already running
        if (!canAccess || !debouncedSupervisorInput || supervisorLookupLoading) {
            // Reset state if input is empty
            if (!debouncedSupervisorInput) {
                 setSupervisorLookupLoading(false);
                 setSupervisorLookupError('');
                 setFetchedSupervisorName(null);
                 // Ensure validated ID is cleared if input is empty
                 if (formData.supervisor !== null) {
                     setFormData(prev => ({ ...prev, supervisor: null }));
                 }
            }
            return; // Exit early
        }

        const lookupSupervisor = async (idString) => {
            const numericId = parseInt(idString, 10);
            // Basic validation for the ID format
            if (isNaN(numericId) || numericId <= 0) {
                setSupervisorLookupError('Invalid ID format.');
                setFetchedSupervisorName(null);
                setFormData(prev => ({ ...prev, supervisor: null })); // Clear invalid ID
                return;
            }
            // Avoid refetch if the input corresponds to the already validated & displayed supervisor
            if (numericId === formData.supervisor && fetchedSupervisorName) {
                // console.log("Supervisor ID already validated.");
                return;
            }

            console.log(`Looking up supervisor ID: ${numericId}`);
            setSupervisorLookupLoading(true);
            setSupervisorLookupError(''); // Clear previous lookup errors
            setFetchedSupervisorName(null); // Clear previous name during lookup

            try {
                const userRes = await getUserDetail(numericId); // Call the API function
                const userData = userRes?.data;

                if (userData && userData.id) {
                    // Success: Found the user
                    setFetchedSupervisorName(userData.name || userData.username || `User ID ${userData.id}`);
                    setFormData(prev => ({ ...prev, supervisor: numericId })); // Store the *validated* ID
                    setSupervisorLookupError('');
                } else {
                     // API might return 200 OK but with no data if ID not found (depends on backend)
                     setSupervisorLookupError('User not found.');
                     setFetchedSupervisorName(null);
                     setFormData(prev => ({ ...prev, supervisor: null })); // Clear invalid ID
                }
            } catch (err) {
                console.error(`Failed to lookup supervisor (ID: ${numericId}):`, err);
                 if (err.response?.status === 404) {
                     setSupervisorLookupError('User not found.');
                 } else {
                     setSupervisorLookupError('Lookup failed.'); // Generic lookup error
                 }
                 setFetchedSupervisorName(null);
                 setFormData(prev => ({ ...prev, supervisor: null })); // Clear invalid ID on error
            } finally {
                setSupervisorLookupLoading(false); // Finish lookup loading
            }
        };

        lookupSupervisor(debouncedSupervisorInput);

    }, [canAccess, debouncedSupervisorInput, formData.supervisor, fetchedSupervisorName]); // Dependencies


    // --- Handlers ---
    // Handles input changes for fields other than the supervisor ID input
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
        if (error) setError(''); // Clear general form/permission error on input
    };

    // Specific handler for the supervisor ID text input
    const handleSupervisorInputChange = (e) => {
        const value = e.target.value;
        setSupervisorInput(value); // Update raw input state immediately

        // Clear validation status immediately when user types or clears the input
        if (value === '') {
            setSupervisorLookupLoading(false);
            setSupervisorLookupError('');
            setFetchedSupervisorName(null);
            setFormData(prev => ({...prev, supervisor: null})); // Ensure validated ID is also cleared
        } else {
             // Optional: Clear previous error/success as user types a new ID
             setSupervisorLookupError('');
             setFetchedSupervisorName(null);
        }
    };


    // --- Handle Form Submission ---
    const handleSubmit = async (e) => {
        e.preventDefault();
         // Final permission check
         if (!canAccess) {
             setError("Permission denied. Cannot create department.");
             return;
         }
        setError(''); // Clear previous submission errors

        // Pre-submission checks for supervisor lookup state
        if (supervisorLookupLoading) {
            setError('Please wait for supervisor ID verification to complete.');
            return;
        }
        if (supervisorInput && supervisorLookupError) {
            setError(`Cannot save with invalid Supervisor ID: ${supervisorLookupError}`);
            return;
        }
        // If input has text but validation didn't succeed or is pending somehow
        if (supervisorInput && formData.supervisor === null && !supervisorLookupError) {
            setError('Supervisor ID verification might be pending or failed silently. Please re-check or clear the field.');
            return;
        }
         // Sync state if input was cleared but validated ID somehow remained
         if (!supervisorInput && formData.supervisor !== null) {
             console.warn("Mismatch: Supervisor input empty but formData has ID. Clearing before submit.");
             setFormData(prev => ({...prev, supervisor: null}));
             // Re-validate or proceed depending on requirements, here we proceed with null
         }

        // Other basic field validation
        if (!formData.name.trim()) {
            setError('Department name cannot be empty.');
            return;
        }

        // Start submission loading
        setLoading(true);

        // Prepare payload - formData.supervisor holds the validated ID or null
        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            location: formData.location.trim() || null,
            supervisor: formData.supervisor, // Use the validated ID from state
        };

        console.log("Creating department with payload:", payload);

        try {
            await createDepartment(payload);
            console.log("Department created successfully");
            // On success, navigate to the list page
            navigate('/departments?success=true'); // Optionally add query param for success message on list page

        } catch (err) {
            // Handle backend errors (parsing logic remains the same)
            console.error("Failed to create department:", err.response || err);
            let errorMessage = 'Failed to create department. Please check your input.';
            const backendErrors = err.response?.data;
             if (typeof backendErrors === 'object' && backendErrors !== null) {
                 const errors = [];
                 for (const key in backendErrors) {
                     const formattedField = key.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                     const messages = Array.isArray(backendErrors[key]) ? backendErrors[key].join(' ') : backendErrors[key];
                     if (key === 'supervisor') { errors.push(`${formattedField}: ${messages} (Ensure the ID is valid and exists)`); }
                     else { errors.push(`${formattedField}: ${messages}`); }
                 }
                 if (errors.length > 0) { errorMessage = errors.join(' | '); }
                 else if (backendErrors.detail) { errorMessage = backendErrors.detail; }
                 else { try { errorMessage = JSON.stringify(backendErrors); } catch { /* ignore */ } }
             } else if (err.message) { errorMessage = err.message; }
            setError(errorMessage); // Display error message

        } finally {
             setLoading(false); // Stop submission loading
        }
    };

    // --- Navigate Back ---
    const handleGoBack = () => {
        navigate('/departments'); // Navigate back to the departments list
    };

    // --- RENDERING ---

    // 1. Show loading indicator while checking authorization
     if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                 <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                 <p className="ml-3 text-gray-600">Verifying access...</p>
             </div>
        );
    }

    // 2. Show Access Denied message if user doesn't have permission
    if (!canAccess) {
         return (
             <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
                 <div className="bg-white shadow-xl rounded-lg p-8 text-center border border-red-200 max-w-md">
                     <ShieldAlert className="mx-auto h-16 w-16 text-red-500 mb-4" />
                     <h2 className="text-2xl font-bold text-red-800 mb-3">Access Denied</h2>
                     <p className="text-red-700 mb-6">{error || 'You do not have permission to access this page.'}</p>
                     <button
                         onClick={() => navigate('/')} // Go to dashboard/home
                         className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                     >
                         <ArrowLeft className="h-4 w-4 mr-2" /> Go to Dashboard
                     </button>
                 </div>
             </div>
         );
    }


    // 3. Render the form if user has access
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             {/* Back Button */}
            <button
                onClick={handleGoBack} // Use button with handler for consistency
                className="inline-flex items-center text-sm text-gray-950 bg-white hover:text-blue-700 mb-6 group transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-2 shadow-sm border-gray-200"
                aria-label="Go back to departments list"
                title="Go back to departments list"
             >
                <ArrowLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" />
                Back to Departments
            </button>

             {/* Main Card */}
             <div className="bg-white shadow-lg rounded-lg overflow-hidden border border-gray-200/75">
                 {/* Card Header */}
                 <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Building2 className="h-6 w-6 mr-2 text-blue-600"/>
                         Create New Department
                     </h2>
                 </div>

                 {/* Card Body - Form */}
                 <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6"> {/* Added padding consistency */}
                     {/* Form Error Display (Only shows submission errors now) */}
                     {error && !authLoading && (
                         <div className="p-3 rounded-md bg-red-50 border border-red-200">
                             <div className="flex items-start">
                                 <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                                 <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
                             </div>
                         </div>
                      )}

                      {/* Name Input */}
                     <div>
                         <label htmlFor="dept-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Building2 className="h-4 w-4 mr-1 text-gray-400 opacity-70"/> Department Name <span className="text-red-500 ml-1">*</span>
                         </label>
                         <input
                             type="text" id="dept-name" name="name"
                             value={formData.name} onChange={handleInputChange} required
                             disabled={loading}
                             className="shadow-sm block w-full border bg-white text-gray-950 border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="e.g., Production Unit A"
                         />
                     </div>

                     {/* Location Input */}
                     <div>
                         <label htmlFor="dept-loc" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <MapPin className="h-4 w-4 mr-1 text-gray-400"/> Location (Optional)
                         </label>
                         <input
                             type="text" id="dept-loc" name="location"
                             value={formData.location || ''}
                             onChange={handleInputChange}
                             disabled={loading}
                             className="shadow-sm block w-full border bg-white text-gray-950 border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="e.g., Building 3, Floor 2"
                         />
                     </div>

                     {/* Supervisor ID Input + Lookup */}
                      <div>
                         <label htmlFor="dept-supervisor-id" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <User className="h-4 w-4 mr-1 text-gray-400"/> Supervisor ID (Optional)
                         </label>
                         <div className="flex items-center space-x-3">
                              <input
                                  type="number"
                                  id="dept-supervisor-id"
                                  name="supervisorInput"
                                  value={supervisorInput}
                                  onChange={handleSupervisorInputChange}
                                  min="1" step="1"
                                  disabled={loading}
                                  className="shadow-sm block w-full max-w-xs border bg-white text-gray-950 border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                                  placeholder="Enter User ID or leave blank"
                              />
                              {/* Supervisor Lookup Status Display */}
                              <div className="flex items-center text-sm h-9"> {/* Fixed height container */}
                                  {supervisorLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  {!supervisorLookupLoading && supervisorLookupError && ( <span className="flex items-center text-red-600"> <XCircle className="h-4 w-4 mr-1 text-red-500" /> {supervisorLookupError} </span> )}
                                  {!supervisorLookupLoading && !supervisorLookupError && fetchedSupervisorName && ( <span className="flex items-center text-green-600"> <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> {fetchedSupervisorName} </span> )}
                                  {/* Show verifying only if input exists and no result/error yet */}
                                  {!supervisorLookupLoading && !fetchedSupervisorName && !supervisorLookupError && supervisorInput && ( <span className="text-gray-500 italic">Verifying...</span> )}
                              </div>
                          </div>
                     </div>

                      {/* Description Input */}
                     <div>
                         <label htmlFor="dept-desc" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <FileText className="h-4 w-4 mr-1 text-gray-400"/> Description (Optional)
                         </label>
                         <textarea
                             id="dept-desc" name="description" rows="4"
                             value={formData.description || ''}
                             onChange={handleInputChange}
                             disabled={loading}
                             className="shadow-sm block w-full border bg-white text-gray-950 border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="Enter a brief description..."
                         ></textarea>
                     </div>

                     {/* Action Buttons Footer */}
                     <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-8"> {/* Added padding/margin */}
                         <button
                             type="button" // Changed Link to button for consistency
                             onClick={handleGoBack}
                             className={`inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                             disabled={loading} // Disable cancel during save
                         >
                             <X className="h-4 w-4 mr-1.5" /> Cancel
                         </button>
                         <button
                             type="submit"
                             className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                             disabled={loading || supervisorLookupLoading} // Disable if saving or looking up supervisor
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