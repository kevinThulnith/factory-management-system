// src/pages/machines/MachineFormPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Assuming getUserDetail exists in your API service
import { getMachine, createMachine, updateMachine, listWorkshops, getUserDetail } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, Save, X, ArrowLeft, Building, User, CheckCircle, XCircle,
    Cog, // Icon for Machine Name/Model
    ListChecks, // Icon for Status
    Calendar, // Icon for Dates
} from 'lucide-react'; // Added relevant icons

// STATUS_CHOICES and formatDateForInput remain the same...
const STATUS_CHOICES = [
    ['OPERATIONAL', 'Operational'],
    ['IDLE', 'Idle'],
    ['MAINTENANCE', 'Under Maintenance'],
    ['BROKEN', 'Broken Down'],
];

const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date:", e);
        return '';
    }
};

// --- Debounce Hook (Keep as is) ---
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


function MachineFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const isEditing = Boolean(id);

    // --- State (Keep as is) ---
    const [formData, setFormData] = useState({
        name: '',
        model_number: '',
        workshop: '',
        status: 'IDLE',
        last_maintenance_date: null,
        next_maintenance_date: null,
        purchase_date: null,
        operator: null, // Stores the *validated* numeric ID or null
    });
    const [workshops, setWorkshops] = useState([]);
    const [operatorInput, setOperatorInput] = useState('');
    const [operatorLookupLoading, setOperatorLookupLoading] = useState(false);
    const [operatorLookupError, setOperatorLookupError] = useState('');
    const [fetchedOperatorName, setFetchedOperatorName] = useState(null);
    const [loading, setLoading] = useState(false); // For form submission
    const [dataLoading, setDataLoading] = useState(true); // For initial data fetch
    const [error, setError] = useState(''); // General form errors

    // --- Debounced Operator ID (Keep as is) ---
    const debouncedOperatorInput = useDebounce(operatorInput, 500);

    // --- Fetch Initial Data (Keep logic, update error state handling if needed) ---
    const fetchRequiredData = useCallback(async () => {
        setDataLoading(true);
        setError(''); // Clear general error
        setOperatorLookupError(''); // Clear specific operator error
        setFetchedOperatorName(null); // Clear fetched name

        // Combine potential error messages
        let fetchErrors = [];

        try {
            console.log("Fetching required data for form...");
            const requests = [listWorkshops()];
            if (isEditing) {
                requests.push(getMachine(id));
            }
            const results = await Promise.allSettled(requests);

            // Process Workshops
            if (results[0].status === 'fulfilled') {
                setWorkshops(Array.isArray(results[0].value?.data) ? results[0].value.data : []);
            } else {
                console.error("Failed to fetch workshops:", results[0].reason);
                fetchErrors.push('Failed to load workshops.');
            }

            // Process Machine Data if Editing
            let initialOperatorId = null;
            if (isEditing && results[1]) {
                if (results[1].status === 'fulfilled') {
                    const machineData = results[1].value?.data;
                    setFormData({
                        name: machineData.name || '',
                        model_number: machineData.model_number || '',
                        workshop: machineData.workshop || '',
                        status: machineData.status || 'IDLE',
                        last_maintenance_date: formatDateForInput(machineData.last_maintenance_date),
                        next_maintenance_date: formatDateForInput(machineData.next_maintenance_date),
                        purchase_date: formatDateForInput(machineData.purchase_date),
                        operator: machineData.operator || null, // Set the validated ID
                    });
                    setOperatorInput(machineData.operator ? String(machineData.operator) : ''); // Set input field
                    initialOperatorId = machineData.operator;
                } else {
                    console.error("Failed to fetch machine for editing:", results[1].reason);
                    fetchErrors.push('Failed to load machine data.');
                }
            }

            // Fetch initial operator name if editing and operator exists
            if (initialOperatorId) {
                try {
                    setOperatorLookupLoading(true);
                    const userRes = await getUserDetail(initialOperatorId);
                    const userData = userRes?.data;
                    if (userData && userData.id) {
                         setFetchedOperatorName(userData.name || userData.username || `User ID ${userData.id}`);
                         setOperatorLookupError('');
                    } else {
                        setOperatorLookupError('Initial operator not found.'); // Set specific error
                         setFetchedOperatorName(null);
                    }
                } catch (err) {
                    console.error(`Failed to fetch initial operator (ID: ${initialOperatorId}):`, err);
                     setOperatorLookupError('Could not verify initial operator.'); // Set specific error
                     setFetchedOperatorName(null);
                } finally {
                    setOperatorLookupLoading(false);
                }
            }
            // Set general error state if any fetch failed
            if (fetchErrors.length > 0) {
                setError(fetchErrors.join(' '));
            }

        } catch (err) {
            console.error("Unexpected error fetching form data:", err);
            setError('An unexpected error occurred while loading form data.');
        } finally {
            setDataLoading(false);
        }
    }, [id, isEditing]);

    // --- useEffect Hooks (Keep as is) ---
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        fetchRequiredData();
    }, [isAuthenticated, navigate, fetchRequiredData]);

    useEffect(() => { // Debounced Operator Lookup Logic (Keep as is)
        if (!debouncedOperatorInput) {
            setOperatorLookupLoading(false); setOperatorLookupError(''); setFetchedOperatorName(null);
            if (formData.operator !== null) { setFormData(prev => ({ ...prev, operator: null })); }
            return;
        }
        const lookupOperator = async (idString) => {
            const numericId = parseInt(idString, 10);
            if (isNaN(numericId) || numericId <= 0) {
                 setOperatorLookupError('Invalid ID format.'); setFetchedOperatorName(null); setFormData(prev => ({ ...prev, operator: null }));
                 return;
            }
             if (numericId === formData.operator && fetchedOperatorName) { return; }

            setOperatorLookupLoading(true); setOperatorLookupError(''); setFetchedOperatorName(null);
            try {
                const userRes = await getUserDetail(numericId); const userData = userRes?.data;
                if (userData && userData.id) {
                    setFetchedOperatorName(userData.name || userData.username || `User ID ${userData.id}`);
                    setFormData(prev => ({ ...prev, operator: numericId })); setOperatorLookupError('');
                } else {
                     setOperatorLookupError('User not found.'); setFetchedOperatorName(null); setFormData(prev => ({ ...prev, operator: null }));
                }
            } catch (err) {
                 if (err.response?.status === 404) { setOperatorLookupError('User not found.'); }
                 else { setOperatorLookupError('Lookup failed.'); }
                 setFetchedOperatorName(null); setFormData(prev => ({ ...prev, operator: null }));
            } finally { setOperatorLookupLoading(false); }
        };
        lookupOperator(debouncedOperatorInput);
    }, [debouncedOperatorInput, formData.operator, fetchedOperatorName]);

    // --- Handlers (Keep as is) ---
    const handleChange = (e) => { // Handles non-operator fields
        const { name, value, type } = e.target; if (error) setError('');
        if (type === 'date') { setFormData(prev => ({ ...prev, [name]: value || null })); }
        else if (name === 'workshop') { setFormData(prev => ({ ...prev, [name]: value ? parseInt(value, 10) : '' })); }
        else { setFormData(prev => ({ ...prev, [name]: value })); }
    };
    const handleOperatorInputChange = (e) => { // Handles operator text input
         const value = e.target.value; setOperatorInput(value);
         if (value === '') {
             setOperatorLookupLoading(false); setOperatorLookupError(''); setFetchedOperatorName(null);
             setFormData(prev => ({...prev, operator: null}));
         }
    };
    const handleSubmit = async (e) => { // Form Submission Logic (Keep as is)
        e.preventDefault();
        if (operatorLookupLoading) { setError('Please wait for operator verification.'); return; }
        if (operatorInput && operatorLookupError) { setError(`Operator ID is invalid: ${operatorLookupError}`); return; }
        if (operatorInput && formData.operator === null && !operatorLookupError) { setError('Operator verification pending/failed.'); return; }
        if (!operatorInput && formData.operator !== null) { setFormData(prev => ({...prev, operator: null})); }

        setLoading(true); setError('');
        if (!formData.workshop) { setError('Workshop selection is required.'); setLoading(false); return; }
        if (!formData.name) { setError('Machine name is required.'); setLoading(false); return; }
        const payload = { ...formData };

        try {
            if (isEditing) { await updateMachine(id, payload); } else { await createMachine(payload); }
            navigate('/machines');
        } catch (err) {
            // Error parsing logic (Keep as is)
             console.error("Failed to save machine:", err.response?.data || err.message || err);
             const backendErrors = err.response?.data;
              if (typeof backendErrors === 'object' && backendErrors !== null) {
                 const errorMessages = Object.entries(backendErrors)
                     .map(([field, messages]) => {
                         const formattedField = field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                         return `${formattedField}: ${Array.isArray(messages) ? messages.join(' ') : messages}`;
                     })
                     .join(' \n');
                 setError(errorMessages || 'Failed to save machine. Please check the fields.');
             } else {
                 setError(backendErrors?.detail || err.message || 'An unknown error occurred.');
             }
        } finally { setLoading(false); }
    };

    // --- Render Logic ---

    if (dataLoading) { // Initial page load spinner
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="ml-3 text-gray-600">Loading form data...</p>
            </div>
        );
    }

    // --- Apply CreateNewDepartment Styling ---
    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Button - Styled like CreateNewDepartment */}
            <Link
                to="/machines" // Correct link for machines
                className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 mb-4 group"
            >
                <ArrowLeft className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" />
                Back to Machines
            </Link>

             {/* Main Card - Styled like CreateNewDepartment */}
             <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                 {/* Card Header - Styled like CreateNewDepartment */}
                 <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Cog className="h-6 w-6 mr-2 text-blue-600"/> {/* Machine Icon */}
                         {isEditing ? 'Edit Machine' : 'Add New Machine'}
                     </h2>
                 </div>

                 {/* Card Body - Form - Adopt single-column layout and styling */}
                 <form onSubmit={handleSubmit} className="p-6 space-y-5 "> {/* Using space-y-5 like target */}
                     {/* Form Error Display - Styled like CreateNewDepartment */}
                     {error && (
                         <div className="p-3 rounded-md bg-red-50 border border-red-200">
                             <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p> {/* Use pre-wrap for multi-line errors */}
                         </div>
                      )}

                      {/* Name */}
                     <div>
                         <label htmlFor="machine-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Cog className="h-4 w-4 mr-1 text-gray-400"/> Machine Name <span className="text-red-500 ml-1">*</span>
                         </label>
                         <input
                             type="text" id="machine-name" name="name"
                             value={formData.name} onChange={handleChange} required
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                             placeholder="e.g., CNC Mill X1"
                         />
                     </div>

                     {/* Model Number */}
                      <div>
                          <label htmlFor="machine-model" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Cog className="h-4 w-4 mr-1 text-gray-400 opacity-70"/> Model Number
                          </label>
                          <input
                              type="text" id="machine-model" name="model_number"
                              value={formData.model_number} onChange={handleChange}
                              disabled={loading}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                              placeholder="e.g., XM-5000"
                          />
                      </div>

                     {/* Workshop Dropdown */}
                      <div>
                          <label htmlFor="machine-workshop" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Building className="h-4 w-4 mr-1 text-gray-400"/> Workshop <span className="text-red-500 ml-1">*</span>
                          </label>
                          <select
                              id="machine-workshop" name="workshop"
                              value={formData.workshop} onChange={handleChange} required
                              disabled={loading || workshops.length === 0}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                          >
                              <option value="">-- Select Workshop --</option>
                              {workshops.map(ws => <option key={ws.id} value={ws.id}>{ws.name || `Workshop ID ${ws.id}`}</option>)}
                          </select>
                          {workshops.length === 0 && !dataLoading && <p className="mt-1 text-xs text-yellow-600">No workshops available.</p>}
                      </div>

                      {/* Status Dropdown */}
                      <div>
                           <label htmlFor="machine-status" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <ListChecks className="h-4 w-4 mr-1 text-gray-400"/> Status <span className="text-red-500 ml-1">*</span>
                           </label>
                           <select
                               id="machine-status" name="status"
                               value={formData.status} onChange={handleChange} required
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                           >
                               {STATUS_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                           </select>
                      </div>

                     {/* Operator ID Input and Display */}
                      <div>
                         <label htmlFor="machine-operator-id" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <User className="h-4 w-4 mr-1 text-gray-400"/> Operator ID (Optional)
                         </label>
                         <div className="flex items-center space-x-3"> {/* Keep flex container for input + status */}
                             <input
                                 type="number" id="machine-operator-id" name="operatorInput"
                                 value={operatorInput} onChange={handleOperatorInputChange}
                                 min="1" step="1"
                                 disabled={loading}
                                 className="shadow-sm block w-full max-w-xs border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500" // Apply style
                                 placeholder="Enter User ID or leave blank"
                             />
                             {/* Operator Lookup Status Display (Keep functional part) */}
                             <div className="flex items-center text-sm h-9">
                                 {operatorLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                 {!operatorLookupLoading && operatorLookupError && (
                                     <span className="flex items-center text-red-600">
                                         <XCircle className="h-4 w-4 mr-1 text-red-500" /> {operatorLookupError}
                                     </span>
                                 )}
                                 {!operatorLookupLoading && !operatorLookupError && fetchedOperatorName && (
                                     <span className="flex items-center text-green-600">
                                         <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> {fetchedOperatorName}
                                     </span>
                                 )}
                                 {!operatorLookupLoading && !fetchedOperatorName && !operatorLookupError && operatorInput && (
                                     <span className="text-gray-500 italic">Verifying...</span>
                                 )}
                             </div>
                         </div>
                      </div>

                     {/* Purchase Date */}
                      <div>
                          <label htmlFor="machine-purchase-date" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-gray-400"/> Purchase Date
                          </label>
                          <input
                              type="date" id="machine-purchase-date" name="purchase_date"
                              value={formData.purchase_date || ''} onChange={handleChange}
                              disabled={loading}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                          />
                      </div>

                      {/* Last Maintenance Date */}
                       <div>
                           <label htmlFor="machine-last-maint" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                               <Calendar className="h-4 w-4 mr-1 text-gray-400 opacity-70"/> Last Maintenance Date
                           </label>
                           <input
                               type="date" id="machine-last-maint" name="last_maintenance_date"
                               value={formData.last_maintenance_date || ''} onChange={handleChange}
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                           />
                       </div>

                       {/* Next Maintenance Date */}
                        <div>
                            <label htmlFor="machine-next-maint" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <Calendar className="h-4 w-4 mr-1 text-gray-400 opacity-70"/> Next Maintenance Date
                            </label>
                            <input
                                type="date" id="machine-next-maint" name="next_maintenance_date"
                                value={formData.next_maintenance_date || ''} onChange={handleChange}
                                disabled={loading}
                                className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                            />
                        </div>


                     {/* Action Buttons - Styled like CreateNewDepartment */}
                     <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200">
                         <Link
                             to="/machines" // Correct link
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
                             // Disable button if form is submitting OR operator lookup is active
                             disabled={loading || operatorLookupLoading}
                         >
                             {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5" />}
                             {loading ? 'Saving...' : (isEditing ? 'Update Machine' : 'Create Machine')}
                         </button>
                     </div>
                 </form>
             </div>
        </div>
    );
}

export default MachineFormPage;