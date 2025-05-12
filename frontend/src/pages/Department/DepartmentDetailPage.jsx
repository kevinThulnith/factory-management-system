// src/pages/departments/DepartmentDetailPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Adjust import paths for API functions
import { getDepartmentDetail, updateDepartment, deleteDepartment, getUserDetail } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
import {
    Building2, MapPin, Clock, Save, X, Edit, Trash2, ArrowLeft, AlertTriangle, Loader2, User, FileText,
    Lock, ShieldAlert, CheckCircle, XCircle, Briefcase // Added Lock, ShieldAlert, CheckCircle, XCircle, Briefcase
} from 'lucide-react';

// --- Role Constants ---
// Ensure these values EXACTLY match the role strings stored in your user objects/backend
const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    // Add other roles if they exist
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

function DepartmentDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth(); // Get user for role check

    // --- State ---
    const [department, setDepartment] = useState(null); // View Data
    const [supervisorDetail, setSupervisorDetail] = useState(null); // Fetched supervisor object for View Mode

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', location: '', supervisor: null }); // Edit Form Data (supervisor stores validated ID or null)
    const [supervisorInput, setSupervisorInput] = useState(''); // Raw input for supervisor ID in edit mode
    const [supervisorLookupLoading, setSupervisorLookupLoading] = useState(false);
    const [supervisorLookupError, setSupervisorLookupError] = useState('');
    const [fetchedSupervisorName, setFetchedSupervisorName] = useState(null); // Display name for supervisor lookup in edit mode

    const [loading, setLoading] = useState(true); // Initial page load
    const [isSaving, setIsSaving] = useState(false); // Save operation in progress
    const [isDeleting, setIsDeleting] = useState(false); // Delete operation in progress
    const [error, setError] = useState(''); // Primary load/delete error
    const [formError, setFormError] = useState(''); // Edit form error
    const [relatedError, setRelatedError] = useState(''); // Error fetching related supervisor details

    const debouncedSupervisorInput = useDebounce(supervisorInput, 500);

    // --- Permissions ---
    // Determine if the current user has edit/delete permissions
    const canManage = useMemo(() => {
        const userRole = user?.role?.toUpperCase();
        // Check if the user role is ADMIN or MANAGER
        return userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;
    }, [user]); // Recalculate when user object changes


    // --- Fetch Department & Related Supervisor Data ---
    const fetchDepartmentDetails = useCallback(async () => {
        setLoading(true);
        setError(''); setFormError(''); setRelatedError(''); // Clear all errors
        setDepartment(null); setSupervisorDetail(null); setFetchedSupervisorName(null); // Clear previous data

        let isMounted = true; // Flag to prevent state update if component unmounts

        try {
            console.log(`Fetching department details for ID: ${id}`);
            const response = await getDepartmentDetail(id);
            if (!isMounted) return; // Check after await

            const deptData = response.data;
            setDepartment(deptData); // Set view data
            console.log("[DEBUG] Fetched department data:", deptData);

            // Initialize Edit Data based on fetched data
            const initialSupervisorId = deptData.supervisor != null ? deptData.supervisor : null;
            const initialSupervisorInput = initialSupervisorId != null ? String(initialSupervisorId) : '';
            setEditData({
                name: deptData.name || '',
                description: deptData.description || '',
                location: deptData.location || '',
                supervisor: initialSupervisorId, // Store the initial ID (or null)
            });
            setSupervisorInput(initialSupervisorInput); // Set initial input value for edit mode
            console.log('[DEBUG] Initialized editData and supervisorInput');

            // Fetch supervisor details if an ID exists
            if (initialSupervisorId) {
                console.log(`[DEBUG] Fetching supervisor details for ID: ${initialSupervisorId}`);
                try {
                    const supervisorRes = await getUserDetail(initialSupervisorId);
                     if (!isMounted) return; // Check after await
                    const supervisorData = supervisorRes.data;
                    setSupervisorDetail(supervisorData); // Set view data for supervisor
                    setFetchedSupervisorName(supervisorData.name || supervisorData.username || `User ID ${supervisorData.id}`); // Set initial name for edit lookup display
                    setSupervisorLookupError(''); // Clear any previous lookup error
                    console.log("[DEBUG] Fetched supervisor details:", supervisorData);
                } catch (supervisorErr) {
                    if (!isMounted) return;
                    console.error("Failed to fetch supervisor details:", supervisorErr.response || supervisorErr);
                    setRelatedError('Could not load supervisor details.'); // Set specific related error
                    setSupervisorDetail(null); // Ensure no stale data
                    setFetchedSupervisorName(null);
                    setSupervisorLookupError('Initial supervisor not found.'); // Set lookup error for edit mode
                }
            } else {
                 // No supervisor assigned, clear related states
                 setSupervisorDetail(null);
                 setFetchedSupervisorName(null);
                 setSupervisorLookupError('');
                 console.log("[DEBUG] No initial supervisor ID found.");
            }

        } catch (err) {
             if (!isMounted) return;
             console.error("Failed to fetch department:", err.response || err);
             if (err.response?.status === 404) { setError('Department not found.'); }
             else if (err.response?.status === 401 || err.response?.status === 403) { setError('You are not authorized to view this department.'); }
             else { setError(`Failed to load department details: ${err.message || 'Unknown error'}`); }
            setDepartment(null); // Clear data on primary fetch failure
        }
        finally {
            if (isMounted) setLoading(false); // Stop loading indicator
        }

        // Cleanup function
        return () => { isMounted = false; }

    }, [id]); // Dependency: only refetch if ID changes

    // --- Effects ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchDepartmentDetails();
        // The dependency array correctly includes fetchDepartmentDetails
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isAuthenticated, navigate]); // Removed fetchDepartmentDetails from here as it now correctly depends on id

    // Debounced Supervisor Lookup for Edit Mode
     useEffect(() => {
         let isLookupMounted = true; // Scope lookup effect mount status
        // Don't run if not editing or input is empty or lookup already running
        if (!isEditing || !debouncedSupervisorInput || supervisorLookupLoading) {
             if (!debouncedSupervisorInput) { // Reset if input is cleared
                setSupervisorLookupLoading(false); setSupervisorLookupError(''); setFetchedSupervisorName(null);
                 if (editData.supervisor !== null) { setEditData(prev => ({ ...prev, supervisor: null })); }
             }
            return;
        }

        const lookupSupervisor = async (idString) => {
             const numericId = parseInt(idString, 10);
             if (isNaN(numericId) || numericId <= 0) { setSupervisorLookupError('Invalid ID format.'); setFetchedSupervisorName(null); setEditData(prev => ({ ...prev, supervisor: null })); return; }
             if (numericId === editData.supervisor && fetchedSupervisorName) { return; }

            setSupervisorLookupLoading(true); setSupervisorLookupError(''); setFetchedSupervisorName(null);
            try {
                const userRes = await getUserDetail(numericId);
                if (!isLookupMounted) return; // Check after await
                const userData = userRes?.data;
                if (userData && userData.id) {
                    setFetchedSupervisorName(userData.name || userData.username || `User ID ${userData.id}`);
                    setEditData(prev => ({ ...prev, supervisor: numericId })); // Store validated ID
                    setSupervisorLookupError('');
                } else { setSupervisorLookupError('User not found.'); setFetchedSupervisorName(null); setEditData(prev => ({ ...prev, supervisor: null })); }
            } catch (err) {
                 if (!isLookupMounted) return;
                console.error(`[DEBUG] Edit Mode - Failed lookup (ID: ${numericId}):`, err);
                if (err.response?.status === 404) { setSupervisorLookupError('User not found.'); } else { setSupervisorLookupError('Lookup failed.'); }
                setFetchedSupervisorName(null); setEditData(prev => ({ ...prev, supervisor: null }));
            } finally {
                 if (isLookupMounted) setSupervisorLookupLoading(false);
            }
        };
        lookupSupervisor(debouncedSupervisorInput);

        // Cleanup for lookup effect
         return () => { isLookupMounted = false; }

    }, [isEditing, debouncedSupervisorInput, editData.supervisor, fetchedSupervisorName, supervisorLookupLoading]); // Dependencies


    // --- Handlers ---
    // Handles input changes in Edit Mode
     const handleEditInputChange = (e) => {
         const { name, value } = e.target;
         setEditData(prev => ({ ...prev, [name]: value }));
         if (formError) setFormError(''); // Clear form error on input
     };

     // Specific handler for supervisor ID input in Edit Mode
     const handleSupervisorInputChange = (e) => {
         const value = e.target.value;
         setSupervisorInput(value); // Update raw input
         // Clear validation state immediately when user types or clears
         if (value === '') {
             setSupervisorLookupLoading(false); setSupervisorLookupError(''); setFetchedSupervisorName(null);
             setEditData(prev => ({...prev, supervisor: null}));
         } else {
              setSupervisorLookupError(''); setFetchedSupervisorName(null);
         }
     };

    // Handle Save Changes (Update)
    const handleUpdate = async (e) => {
        e.preventDefault();
        // Permission Check
        if (!canManage) { setFormError('Access Denied: Cannot edit.'); return; }
        setFormError(''); // Clear previous form errors

        // Validation
        if (supervisorLookupLoading) { setFormError('Wait for supervisor verification.'); return; }
        if (supervisorInput && supervisorLookupError) { setFormError(`Supervisor ID invalid: ${supervisorLookupError}`); return; }
        if (supervisorInput && editData.supervisor === null && !supervisorLookupError) { setFormError('Supervisor verification pending/failed.'); return; }
        if (!supervisorInput && editData.supervisor !== null) { setEditData(prev => ({...prev, supervisor: null})); } // Sync state
        if (!editData.name.trim()) { setFormError('Department name cannot be empty.'); return; }

        setIsSaving(true);
        const payload = {
            name: editData.name.trim(),
            description: editData.description.trim() || null,
            location: editData.location.trim() || null,
            supervisor: editData.supervisor, // Use validated ID
        };
        console.log("[DEBUG] Updating department with payload:", payload);

        try {
            const response = await updateDepartment(id, payload);
            const updatedDeptData = response.data;
            setDepartment(updatedDeptData); // Update view state

            // Update related supervisor detail state for view mode consistency
            const updatedSupervisorId = updatedDeptData.supervisor;
            setRelatedError(''); // Clear previous related errors
             if (updatedSupervisorId && updatedSupervisorId === editData.supervisor) {
                 // If supervisor didn't change or was just successfully validated, use the already fetched name if possible
                 setSupervisorDetail({ id: updatedSupervisorId, name: fetchedSupervisorName || `User ID ${updatedSupervisorId}` }); // Update view model
             } else if (updatedSupervisorId) {
                 // Supervisor ID changed or wasn't previously fetched, fetch new details
                 try {
                     const supervisorRes = await getUserDetail(updatedSupervisorId);
                     setSupervisorDetail(supervisorRes.data);
                 } catch (supErr) {
                     console.error("Failed to fetch updated supervisor details:", supErr);
                     setRelatedError('Supervisor details updated, but failed to reload name.');
                     setSupervisorDetail(null); // Clear inconsistent data
                 }
             } else {
                 setSupervisorDetail(null); // Supervisor was removed
             }

             // Reset edit form state after successful save
             setEditData({
                 name: updatedDeptData.name || '',
                 description: updatedDeptData.description || '',
                 location: updatedDeptData.location || '',
                 supervisor: updatedSupervisorId || null,
             });
             setSupervisorInput(updatedSupervisorId ? String(updatedSupervisorId) : '');
             // No need to reset fetchedSupervisorName here, handleCancelEdit does it based on new supervisorDetail

            setIsEditing(false); // Exit edit mode
            console.log("[DEBUG] Update successful");

        } catch (err) {
             console.error("Failed to update department:", err.response || err);
             // Parse and set formError (same logic as before)
              let errorMessage = 'Failed to update department.'; const backendErrors = err.response?.data; if (typeof backendErrors === 'object' && backendErrors !== null) { const errors = []; for (const key in backendErrors) { if (key === 'supervisor') { errors.push(`Supervisor: ${Array.isArray(backendErrors[key]) ? backendErrors[key].join(', ') : backendErrors[key]}`); } else { const friendlyKey = key.replace(/_/g, ' '); const messages = Array.isArray(backendErrors[key]) ? backendErrors[key].join(', ') : backendErrors[key]; errors.push(`${friendlyKey}: ${messages}`); } } if (errors.length > 0) { errorMessage = errors.join(' | '); } else if (backendErrors.detail) { errorMessage = backendErrors.detail; } } else if (err.message) { errorMessage = err.message; } setFormError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Cancel Edit
    const handleCancelEdit = () => {
        setIsEditing(false);
        setFormError('');
        // Reset editData and supervisor input/lookup state based on current VIEW state
        if (department) {
            const currentSupervisorId = department.supervisor != null ? department.supervisor : null;
            setEditData({
                name: department.name || '',
                description: department.description || '',
                location: department.location || '',
                supervisor: currentSupervisorId,
            });
            setSupervisorInput(currentSupervisorId != null ? String(currentSupervisorId) : '');
            // Reset fetched name based on current supervisorDetail state
             if (supervisorDetail) {
                setFetchedSupervisorName(supervisorDetail.name || supervisorDetail.username || `User ID ${supervisorDetail.id}`);
                setSupervisorLookupError('');
             } else {
                 setFetchedSupervisorName(null);
                 // Set error only if an ID exists but details are missing
                 setSupervisorLookupError(currentSupervisorId && !supervisorDetail ? 'Verification needed' : '');
             }
            console.log('[DEBUG] Cancelled edit, reset editData/lookup based on current view state');
        }
    };


    // Handle Delete
     const handleDelete = async () => {
         if (!canManage) { setFormError('Access Denied: Cannot delete.'); return; } // Permission Check

        const deptName = department?.name || `Department ID ${id}`;
        if (window.confirm(`Are you sure you want to delete "${deptName}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            setFormError(''); setError(''); setRelatedError(''); // Clear errors
            try {
                await deleteDepartment(id);
                navigate('/departments'); // Go back to list
            } catch (err) {
                console.error("Failed to delete department:", err.response || err);
                let errorMsg = err.response?.data?.detail || 'Failed to delete department.';
                setError(errorMsg); // Set general page error for delete failure
            } finally {
                setIsDeleting(false);
            }
        }
    };

    // --- Format Date Helper ---
    //const formatDate = (dateString) => { if (!dateString) return 'N/A'; try { const date = new Date(dateString); if (isNaN(date.getTime())) { return `Invalid Date (${dateString})`; } return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return `Error (${dateString})`; } };
    const formatDate = (dateString) => { if (!dateString) return 'N/A'; try { const date = new Date(dateString); if (isNaN(date.getTime())) { return `Invalid Date (${dateString})`; } return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return `Error (${dateString})`; } };


    // --- Render Logic ---

    // Loading State
    if (loading) { return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> </div> ); }

    // Error State (If primary fetch failed)
    if (error && !department) { return ( <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center"> <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/> <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Department</h3> <p className="text-red-700 mb-4 whitespace-pre-wrap">{error}</p> <Link to="/departments" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to Departments List </Link> </div> ); }

    // Not Found State (Should be covered by error above)
    if (!department) return null;

    // Prepare display name for supervisor in View Mode
    const displaySupervisorName = supervisorDetail?.name || supervisorDetail?.username || (department.supervisor ? `ID: ${department.supervisor}` : '');

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             {/* Back Button */}
            <Link to="/departments" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Departments
            </Link>

            {/* Main Card */}
            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                {/* Card Header */}
                 <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-y-3">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center min-w-0 mr-4">
                         <Building2 className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/>
                         <span className="truncate" title={isEditing ? 'Edit Department' : department.name}>
                            {isEditing ? 'Edit Department' : (department.name || 'Department Details')}
                         </span>
                    </h2>
                     {/* Show Edit/Delete only in View mode */}
                     {!isEditing && (
                         <div className="flex items-center space-x-3 flex-shrink-0">
                            {/* Edit Button - Conditionally Enabled/Styled */}
                            <button
                                onClick={() => {
                                    if (!canManage) { setFormError('Access Denied: Cannot edit.'); return; }
                                    setIsEditing(true); setFormError('');
                                }}
                                className={`inline-flex items-center px-3.5 py-1.5 border rounded-md shadow-sm text-sm font-medium transition duration-150 ease-in-out ${ canManage ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-blue-500' : 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed' }`}
                                disabled={isDeleting || !canManage}
                                title={canManage ? "Edit Department" : "Edit action restricted"}
                            >
                                {canManage ? <Edit className="h-4 w-4 mr-1.5 -ml-0.5" /> : <Lock className="h-4 w-4 mr-1.5 -ml-0.5"/>}
                                Edit
                            </button>
                            {/* Delete Button - Conditionally Enabled/Styled */}
                            <button
                                onClick={handleDelete} // Permission check is inside handler
                                className={`inline-flex items-center px-3.5 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium transition duration-150 ease-in-out ${ canManage ? 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'text-gray-50 bg-gray-400 cursor-not-allowed' }`}
                                disabled={isDeleting || !canManage}
                                title={canManage ? "Delete Department" : "Delete action restricted"}
                            >
                                {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : canManage ? <Trash2 className="h-4 w-4 mr-1.5 -ml-0.5" /> : <Lock className="h-4 w-4 mr-1.5 -ml-0.5"/>}
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                         </div>
                     )}
                 </div>

                 {/* General/Related Error Display (only shown in View mode) */}
                 {error && !isEditing && ( <div className="border-b border-red-200 bg-red-50 px-6 py-3"> <p className="text-sm text-red-700 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {error} </p> </div> )}
                 {relatedError && !isEditing && ( <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3"> <p className="text-sm text-yellow-800 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600 flex-shrink-0" /> {relatedError} </p> </div> )}

                 {/* Card Body - View or Edit */}
                 <div className="p-6 md:p-8">
                     {!isEditing ? (
                        // --- View Mode ---
                         <dl className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6 text-sm">
                             <div className="md:col-span-3"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Building2 className="h-4 w-4 mr-1.5 text-gray-400"/>Department Name</dt> <dd className="text-gray-900 text-base">{department.name || '-'}</dd> </div>
                             <div className="md:col-span-3"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><MapPin className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Location</dt> <dd className="text-gray-900">{department.location || <span className="italic text-gray-500">Not specified</span>}</dd> </div>
                             <div className="md:col-span-6">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><User className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Supervisor</dt>
                                 <dd className="text-gray-900" title={supervisorDetail ? `ID: ${supervisorDetail.id}` : (department.supervisor ? `ID: ${department.supervisor}` : '')}>
                                     {displaySupervisorName || <span className="italic text-gray-500">Not assigned</span>}
                                     {!supervisorDetail && department.supervisor && relatedError && <span className="text-xs text-red-500 ml-2">({relatedError})</span>}
                                 </dd>
                             </div>
                             <div className="md:col-span-6 pt-2">
                                 <dt className="font-semibold text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Description</dt>
                                 <dd className="text-gray-800 whitespace-pre-wrap leading-relaxed">{department.description || <span className="italic text-gray-500">No description provided</span>}</dd>
                             </div>
                             <div className="md:col-span-6 border-t border-gray-200 pt-4 mt-4">
                                 <dt className="font-medium text-xs text-gray-500 uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>Last Updated</dt>
                                 <dd className="mt-1 text-gray-700 text-xs">{formatDate(department.updated_at)}</dd>
                             </div>
                         </dl>
                     ) : (
                        // --- Edit Mode ---
                         <form onSubmit={handleUpdate} className="space-y-6">
                             {/* Form Error Display (for validation/save errors) */}
                             {formError && ( <div className="p-3 rounded-md bg-red-50 border border-red-200"> <div className="flex items-start"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> <p className="text-sm text-red-700 whitespace-pre-wrap">{formError}</p> </div> </div> )}

                             {/* Name Input */}
                             <div>
                                 <label htmlFor="edit-dept-name" className="block text-sm font-medium text-gray-700 mb-1">Department Name <span className="text-red-500">*</span></label>
                                 <input type="text" id="edit-dept-name" name="name" value={editData.name} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter department name"/>
                             </div>
                             {/* Location Input */}
                             <div>
                                 <label htmlFor="edit-dept-location" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><MapPin className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0"/>Location</label>
                                 <input type="text" id="edit-dept-location" name="location" value={editData.location} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., Building 5, Area B"/>
                             </div>
                             {/* Supervisor ID Input + Lookup */}
                              <div>
                                 <label htmlFor="edit-dept-supervisor" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><User className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0"/> Supervisor ID (Optional)</label>
                                  <div className="flex items-center space-x-3">
                                      <input type="number" id="edit-dept-supervisor" name="supervisorInput" value={supervisorInput} onChange={handleSupervisorInputChange} min="1" step="1" disabled={isSaving} className="shadow-sm block w-full max-w-xs border bg-white text-gray-950 border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter User ID"/>
                                      {/* Supervisor Lookup Status Display */}
                                      <div className="flex items-center text-sm h-9">
                                          {supervisorLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400"/>}
                                          {!supervisorLookupLoading && supervisorLookupError && (<span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1 text-red-500"/> {supervisorLookupError}</span>)}
                                          {!supervisorLookupLoading && !supervisorLookupError && fetchedSupervisorName && (<span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1 text-green-500"/> {fetchedSupervisorName}</span>)}
                                          {!supervisorLookupLoading && !fetchedSupervisorName && !supervisorLookupError && supervisorInput && (<span className="text-gray-500 italic">Verifying...</span>)}
                                      </div>
                                  </div>
                             </div>
                             {/* Description Textarea */}
                             <div>
                                 <label htmlFor="edit-dept-description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0"/> Description</label>
                                 <textarea id="edit-dept-description" name="description" rows="4" value={editData.description} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter a brief description..."></textarea>
                             </div>

                             {/* Action Buttons */}
                             <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200 mt-8">
                                 <button type="button" onClick={handleCancelEdit} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving}> <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel </button>
                                 <button type="submit" className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving || supervisorLookupLoading}> {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />} {isSaving ? 'Saving...' : 'Save Changes'} </button>
                             </div>
                         </form>
                     )}
                 </div>
            </div>
        </div>
    );
}

export default DepartmentDetailPage;