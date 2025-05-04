// src/pages/workshops/WorkshopFormPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Adjust import paths for API functions
import { getWorkshop, createWorkshop, updateWorkshop, listDepartments, getUserDetail } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, Save, X, ArrowLeft, Building, User, CheckCircle, XCircle,
    Activity, // Icon for Status
    FileText // Icon for Description
} from 'lucide-react';

// Choices from Django Model
const OPERATIONAL_STATUS_CHOICES = [
    ['ACTIVE', 'Active'],
    ['MAINTENANCE', 'Under Maintenance'],
    ['INACTIVE', 'Inactive'],
    // Add other relevant choices if they exist
];

// --- Debounce Hook (Include or import) ---
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

function WorkshopFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const isEditing = Boolean(id);

    // --- State ---
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        department: '', // Stores Department ID
        manager: null,   // Stores *validated* User ID or null for submission
        operational_status: 'ACTIVE',
    });
    const [departments, setDepartments] = useState([]); // For department dropdown

    // State for manager input and lookup
    const [managerInput, setManagerInput] = useState(''); // Raw string from input
    const [managerLookupLoading, setManagerLookupLoading] = useState(false);
    const [managerLookupError, setManagerLookupError] = useState('');
    const [fetchedManagerName, setFetchedManagerName] = useState(null); // Display name if found

    const [loading, setLoading] = useState(false); // For form submission
    const [dataLoading, setDataLoading] = useState(true); // For initial data fetch (dept list, workshop details)
    const [error, setError] = useState(''); // General form/load errors

    // --- Debounced Manager ID ---
    const debouncedManagerInput = useDebounce(managerInput, 500);

    // --- Fetch Initial Data (Departments, and Workshop if Editing) ---
    const fetchRequiredData = useCallback(async () => {
        setDataLoading(true);
        setError(''); setManagerLookupError(''); setFetchedManagerName(null);

        let fetchErrors = [];

        try {
            console.log("Fetching required data for workshop form...");
            const requests = [listDepartments()]; // Fetch departments for dropdown
            if (isEditing) {
                requests.push(getWorkshop(id)); // Fetch workshop details if editing
            }
            const results = await Promise.allSettled(requests);

            // Process Departments List
            if (results[0].status === 'fulfilled') {
                setDepartments(Array.isArray(results[0].value?.data) ? results[0].value.data : []);
            } else {
                console.error("Failed to fetch departments list:", results[0].reason);
                fetchErrors.push('Failed to load departments list.');
            }

            // Process Workshop Data if Editing
            let workshopData = null;
            let initialManagerId = null;
            if (isEditing && results[1]) {
                if (results[1].status === 'fulfilled') {
                    workshopData = results[1].value.data;
                    setFormData({
                        name: workshopData.name || '',
                        description: workshopData.description || '',
                        department: workshopData.department || '',
                        manager: workshopData.manager || null, // Store validated ID
                        operational_status: workshopData.operational_status || 'ACTIVE',
                    });
                    setManagerInput(workshopData.manager ? String(workshopData.manager) : ''); // Set input value
                    initialManagerId = workshopData.manager;
                } else {
                    console.error("Failed to fetch workshop for editing:", results[1].reason);
                    fetchErrors.push('Failed to load workshop data.');
                    setError('Failed to load workshop data. Please try again.'); // Set main error if workshop load fails
                }
            }

             // Fetch initial manager name if editing and manager ID exists
             if (initialManagerId) {
                 try {
                     setManagerLookupLoading(true);
                     const userRes = await getUserDetail(initialManagerId);
                     const userData = userRes?.data;
                     if (userData && userData.id) {
                          setFetchedManagerName(userData.name || userData.username || `User ID ${userData.id}`);
                          setManagerLookupError('');
                     } else {
                         setManagerLookupError('Initial manager not found.');
                          setFetchedManagerName(null);
                     }
                 } catch (err) {
                     console.error(`Failed to fetch initial manager (ID: ${initialManagerId}):`, err);
                      setManagerLookupError('Could not verify initial manager.');
                      setFetchedManagerName(null);
                 } finally {
                     setManagerLookupLoading(false);
                 }
             }

             // Set combined related errors
             if (fetchErrors.length > 0 && !error) { // Only set related if no main error yet
                 setError(fetchErrors.join(' ')); // Combine initial load errors
             }

        } catch (err) {
            console.error("Unexpected error fetching form data:", err);
            setError('An unexpected error occurred while loading form data.');
        } finally {
            setDataLoading(false);
        }
    }, [id, isEditing]); // Dependencies

    // --- useEffect Hooks ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchRequiredData();
    }, [isAuthenticated, navigate, fetchRequiredData]); // Added fetchRequiredData

    useEffect(() => { // Debounced Manager Lookup
        if (!debouncedManagerInput) {
            setManagerLookupLoading(false); setManagerLookupError(''); setFetchedManagerName(null);
            if (formData.manager !== null) { setFormData(prev => ({ ...prev, manager: null })); }
            return;
        }
        const lookupManager = async (idString) => {
            const numericId = parseInt(idString, 10);
            if (isNaN(numericId) || numericId <= 0) { setManagerLookupError('Invalid ID format.'); setFetchedManagerName(null); setFormData(prev => ({ ...prev, manager: null })); return; }
            if (numericId === formData.manager && fetchedManagerName) { return; }

            setManagerLookupLoading(true); setManagerLookupError(''); setFetchedManagerName(null);
            try {
                const userRes = await getUserDetail(numericId); const userData = userRes?.data;
                if (userData && userData.id) { setFetchedManagerName(userData.name || userData.username || `User ID ${userData.id}`); setFormData(prev => ({ ...prev, manager: numericId })); setManagerLookupError(''); }
                else { setManagerLookupError('User not found.'); setFetchedManagerName(null); setFormData(prev => ({ ...prev, manager: null })); }
            } catch (err) {
                if (err.response?.status === 404) { setManagerLookupError('User not found.'); } else { setManagerLookupError('Lookup failed.'); }
                setFetchedManagerName(null); setFormData(prev => ({ ...prev, manager: null }));
            } finally { setManagerLookupLoading(false); }
        };
        lookupManager(debouncedManagerInput);
    }, [debouncedManagerInput, formData.manager, fetchedManagerName]); // Dependencies

    // --- Handlers ---
    const handleChange = (e) => { // Handles fields other than manager input
        const { name, value } = e.target;
        if (error) setError(''); // Clear general error
        // Handle department ID specifically if needed, else generic update
        if (name === 'department') {
             setFormData(prev => ({ ...prev, [name]: value ? parseInt(value, 10) : '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleManagerInputChange = (e) => { // Specific handler for manager text input
         const value = e.target.value;
         setManagerInput(value);
         if (value === '') {
             setManagerLookupLoading(false); setManagerLookupError(''); setFetchedManagerName(null);
             setFormData(prev => ({...prev, manager: null}));
         }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear general error, form-specific error is used below

        // Pre-submission checks for manager lookup
        if (managerLookupLoading) { setError('Please wait for manager verification.'); return; }
        if (managerInput && managerLookupError) { setError(`Manager ID is invalid: ${managerLookupError}`); return; }
        if (managerInput && formData.manager === null && !managerLookupError) { setError('Manager verification pending/failed.'); return; }
        if (!managerInput && formData.manager !== null) { setFormData(prev => ({...prev, manager: null})); }

        // Other validation
        if (!formData.name.trim()) { setError('Workshop name is required.'); return; }
        if (!formData.department) { setError('Department selection is required.'); return; }

        setLoading(true); // Start submission loading

        // Payload uses formData.manager (validated ID or null)
        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            department: formData.department, // Already number or ''
            manager: formData.manager, // Validated ID or null
            operational_status: formData.operational_status,
        };

        console.log("Submitting workshop with payload:", payload);

        try {
            if (isEditing) {
                await updateWorkshop(id, payload);
            } else {
                await createWorkshop(payload);
            }
            navigate('/workshops');
        } catch (err) {
            console.error("Failed to save workshop:", err.response?.data || err.message || err);
             const backendErrors = err.response?.data;
             if (typeof backendErrors === 'object' && backendErrors !== null) {
                 const errorMessages = Object.entries(backendErrors)
                     .map(([field, messages]) => {
                         const formattedField = field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                         return `${formattedField}: ${Array.isArray(messages) ? messages.join(' ') : messages}`;
                     }).join(' \n');
                 setError(errorMessages || 'Save failed. Please check the fields.'); // Use general error state for save errors
             } else { setError(backendErrors?.detail || err.message || 'An unknown error occurred during save.'); }
        } finally {
            setLoading(false); // Stop submission loading
        }
    };

    // --- Render Logic ---

    if (dataLoading) { return ( <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3 text-gray-600">Loading data...</p></div> ); }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Button */}
            <Link to="/workshops" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Workshops
            </Link>

             {/* Main Card */}
             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                 {/* Card Header */}
                 <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Building className="h-6 w-6 mr-2.5 text-blue-600"/> {/* Workshop Icon */}
                         {isEditing ? 'Edit Workshop' : 'Add New Workshop'}
                     </h2>
                 </div>

                 {/* Card Body - Form */}
                 <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6"> {/* Increased spacing */}
                     {/* General Error Display Area */}
                     {error && (
                          <div className="p-3 rounded-md bg-red-50 border border-red-200">
                              <p className="text-sm text-red-700 flex items-start whitespace-pre-wrap"> {/* Use pre-wrap */}
                                  <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                                 {error}
                              </p>
                          </div>
                       )}

                      {/* Name */}
                     <div>
                         <label htmlFor="ws-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Building className="h-4 w-4 mr-1.5 text-gray-400"/> Workshop Name <span className="text-red-500 ml-1">*</span>
                         </label>
                         <input
                             type="text" id="ws-name" name="name"
                             value={formData.name} onChange={handleChange} required
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                             placeholder="e.g., Assembly Line Alpha"
                         />
                     </div>

                     {/* Department Dropdown */}
                     <div>
                          <label htmlFor="ws-department" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Building className="h-4 w-4 mr-1.5 text-gray-400 opacity-70"/> Department <span className="text-red-500 ml-1">*</span>
                          </label>
                          <select
                              id="ws-department" name="department"
                              value={formData.department} onChange={handleChange} required
                              disabled={loading || departments.length === 0}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                          >
                              <option value="">-- Select Department --</option>
                              {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name || `Department ID ${dept.id}`}</option>)}
                          </select>
                          {departments.length === 0 && !dataLoading && <p className="mt-1 text-xs text-yellow-600">No departments loaded.</p>}
                      </div>

                      {/* Manager ID Input + Lookup */}
                       <div>
                          <label htmlFor="ws-manager-id" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <User className="h-4 w-4 mr-1.5 text-gray-400"/> Manager ID (Optional)
                          </label>
                          <div className="flex items-center space-x-3">
                              <input
                                  type="number" id="ws-manager-id" name="managerInput"
                                  value={managerInput} onChange={handleManagerInputChange}
                                  min="1" step="1"
                                  disabled={loading}
                                  className="shadow-sm block w-full max-w-xs border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                  placeholder="Enter User ID or leave blank"
                              />
                              {/* Manager Lookup Status Display */}
                              <div className="flex items-center text-sm h-9">
                                  {managerLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400"/>}
                                  {!managerLookupLoading && managerLookupError && (<span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1 text-red-500"/> {managerLookupError}</span>)}
                                  {!managerLookupLoading && !managerLookupError && fetchedManagerName && (<span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1 text-green-500"/> {fetchedManagerName}</span>)}
                                  {!managerLookupLoading && !fetchedManagerName && !managerLookupError && managerInput && (<span className="text-gray-500 italic">Verifying...</span>)}
                              </div>
                          </div>
                       </div>

                       {/* Operational Status Dropdown */}
                        <div>
                            <label htmlFor="ws-status" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <Activity className="h-4 w-4 mr-1.5 text-gray-400"/> Operational Status <span className="text-red-500 ml-1">*</span>
                            </label>
                            <select
                                id="ws-status" name="operational_status"
                                value={formData.operational_status} onChange={handleChange} required
                                disabled={loading}
                                className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                {OPERATIONAL_STATUS_CHOICES.map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                       {/* Description */}
                       <div>
                           <label htmlFor="ws-description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <FileText className="h-4 w-4 mr-1.5 text-gray-400"/> Description
                           </label>
                           <textarea
                               id="ws-description" name="description" rows="4"
                               value={formData.description} onChange={handleChange}
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                               placeholder="Optional: Add details about the workshop..."
                           ></textarea>
                       </div>


                     {/* Action Buttons */}
                     <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-8">
                         <Link
                             to="/workshops" type="button"
                             className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50"
                             onClick={(e) => { if (loading) e.preventDefault(); }} // Prevent navigation if saving
                             aria-disabled={loading}
                         >
                             <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel
                         </Link>
                         <button
                             type="submit"
                             className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50"
                             disabled={loading || managerLookupLoading} // Disable if saving or looking up manager
                         >
                             {loading ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />}
                             {loading ? 'Saving...' : (isEditing ? 'Update Workshop' : 'Create Workshop')}
                         </button>
                     </div>
                 </form>
             </div>
        </div>
    );
}

export default WorkshopFormPage;