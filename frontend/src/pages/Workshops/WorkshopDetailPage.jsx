// src/pages/workshops/WorkshopDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Adjust imports for your API service functions
import { getWorkshop, updateWorkshop, deleteWorkshop, getDepartmentDetail, getUserDetail, listDepartments } from '../../services/api'; // Added necessary API calls
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, ArrowLeft, Edit, Trash2, Save, X, Info, CheckCircle, AlertCircle,
    Building, // For Workshop Name/Department
    User, // For Manager
    Activity, // For Status
    Clock, // For Timestamps
    FileText, // For Description
    HelpCircle, // For N/A or Unknown status
    Briefcase, // Alternative for Department
    Wrench // Icon for Maintenance status
} from 'lucide-react';

// --- Status Badge Component (Copied from WorkshopListPage) ---
const StatusBadge = ({ status }) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    let bgColor = 'bg-gray-100'; let textColor = 'text-gray-800'; let Icon = HelpCircle;
    switch (lowerStatus) {
        case 'active': case 'operational': bgColor = 'bg-green-100'; textColor = 'text-green-800'; Icon = CheckCircle; break;
        case 'inactive': case 'idle': bgColor = 'bg-sky-100'; textColor = 'text-sky-800'; Icon = Info; break;
        case 'maintenance': case 'under maintenance': bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; Icon = Wrench; break;
        default: break;
    }
    const capitalizedStatus = status ? status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : 'Unknown';
    return ( <span title={`Status: ${capitalizedStatus}`} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bgColor} ${textColor}`}> <Icon aria-hidden="true" className={`h-4 w-4 mr-1.5 ${textColor}`} /> {capitalizedStatus} </span> );
};

// --- OPERATIONAL_STATUS_CHOICES for Edit Dropdown (From WorkshopFormPage) ---
const OPERATIONAL_STATUS_CHOICES = [
    ['ACTIVE', 'Active'],
    ['MAINTENANCE', 'Under Maintenance'],
    ['INACTIVE', 'Inactive'],
];

// --- Helper to format Date and Time (Copied from MachineDetailPage) ---
const formatDateTime = (dateTimeString) => { if (!dateTimeString) return 'N/A'; try { const date = new Date(dateTimeString); if (isNaN(date.getTime())) return 'Invalid Date'; return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { return 'Formatting Error'; } };

// --- Debounce Hook (Copied from WorkshopFormPage) ---
function useDebounce(value, delay) { const [debouncedValue, setDebouncedValue] = useState(value); useEffect(() => { const handler = setTimeout(() => { setDebouncedValue(value); }, delay); return () => { clearTimeout(handler); }; }, [value, delay]); return debouncedValue; }


function WorkshopDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- State ---
    const [workshop, setWorkshop] = useState(null); // Main workshop data
    const [department, setDepartment] = useState(null); // Fetched department details
    const [manager, setManager] = useState(null); // Fetched manager details

    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', department: '', manager: null, operational_status: '' });
    const [departments, setDepartments] = useState([]); // For edit dropdown
    const [managerInput, setManagerInput] = useState('');
    const [managerLookupLoading, setManagerLookupLoading] = useState(false);
    const [managerLookupError, setManagerLookupError] = useState('');
    const [fetchedManagerName, setFetchedManagerName] = useState(null);

    const [loading, setLoading] = useState(true); // Initial page load
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState(''); // Primary load error
    const [formError, setFormError] = useState(''); // Edit form error
    const [relatedError, setRelatedError] = useState(''); // Related data load error

    const debouncedManagerInput = useDebounce(managerInput, 500);

    // --- Fetch Initial Data ---
    const fetchWorkshopDetails = useCallback(async () => {
        setLoading(true); setError(''); setRelatedError(''); setFormError('');
        setWorkshop(null); setDepartment(null); setManager(null); setFetchedManagerName(null);

        let fetchErrors = [];

        try {
            console.log(`Fetching workshop details for ID: ${id}`);
            // Fetch workshop details and department list concurrently
            const results = await Promise.allSettled([
                getWorkshop(id),
                listDepartments() // Needed for edit dropdown
            ]);

            let workshopData = null;
            let initialDeptId = null;
            let initialManagerId = null;

            // Process Workshop Result
            if (results[0].status === 'fulfilled') {
                workshopData = results[0].value.data;
                setWorkshop(workshopData);
                initialDeptId = workshopData.department;
                initialManagerId = workshopData.manager;
                console.log("Workshop data fetched:", workshopData);
            } else {
                console.error("Failed to fetch workshop:", results[0].reason);
                setError(results[0].reason.response?.data?.detail || results[0].reason.message || 'Failed to load workshop details.');
                setLoading(false); return; // Exit if primary fetch fails
            }

            // Process Departments List Result
             if (results[1].status === 'fulfilled') {
                 setDepartments(Array.isArray(results[1].value?.data) ? results[1].value.data : []);
             } else {
                 console.error("Failed to fetch departments list:", results[1].reason);
                 fetchErrors.push('Failed to load department list for editing.');
             }

             // Initialize Edit Data
             if (workshopData) {
                const initialEditData = {
                    name: workshopData.name || '',
                    description: workshopData.description || '',
                    department: workshopData.department || '',
                    manager: workshopData.manager || null, // Store initial validated ID
                    operational_status: workshopData.operational_status || 'ACTIVE',
                };
                 setEditData(initialEditData);
                 setManagerInput(workshopData.manager ? String(workshopData.manager) : '');
                 console.log("Initialized editData:", initialEditData);
             }

            // Fetch related Department and Manager details
             const relatedPromises = [];
             if (initialDeptId) { relatedPromises.push(getDepartmentDetail(initialDeptId).catch(err => ({ error: true, type: 'department', reason: err }))); }
             else { relatedPromises.push(Promise.resolve(null)); }
             if (initialManagerId) { relatedPromises.push(getUserDetail(initialManagerId).catch(err => ({ error: true, type: 'manager', reason: err }))); }
             else { relatedPromises.push(Promise.resolve(null)); }
             const relatedResults = await Promise.allSettled(relatedPromises);

            // Process Related Department
            if (relatedResults[0].status === 'fulfilled' && relatedResults[0].value && !relatedResults[0].value.error) { setDepartment(relatedResults[0].value.data); }
            else if (relatedResults[0].value?.error || relatedResults[0].status === 'rejected') { fetchErrors.push('Could not load department details.'); }
            // Process Related Manager (and set fetched name for edit form)
            if (relatedResults[1].status === 'fulfilled' && relatedResults[1].value && !relatedResults[1].value.error) {
                const managerData = relatedResults[1].value.data; setManager(managerData);
                setFetchedManagerName(managerData.name || managerData.username || `User ID ${managerData.id}`); setManagerLookupError('');
             } else if (relatedResults[1].value?.error || relatedResults[1].status === 'rejected') {
                fetchErrors.push('Could not load manager details.'); setManagerLookupError('Initial manager not found.'); setFetchedManagerName(null);
             }
             if (fetchErrors.length > 0) { setRelatedError(fetchErrors.join(' ')); }

        } catch (err) { setError('An unexpected error occurred while loading data.'); }
        finally { setLoading(false); }
    }, [id]);

    // --- useEffect Hooks ---
    useEffect(() => { if (!isAuthenticated) { navigate('/login'); return; } if (id) { fetchWorkshopDetails(); } else { setError("Workshop ID is missing."); setLoading(false); } }, [id, isAuthenticated, navigate, fetchWorkshopDetails]);

     useEffect(() => { // Debounced Manager Lookup for Edit Mode
         if (!isEditing) return; if (!debouncedManagerInput) { setManagerLookupLoading(false); setManagerLookupError(''); setFetchedManagerName(null); if (editData.manager !== null) { setEditData(prev => ({ ...prev, manager: null })); } return; }
         const lookupManager = async (idString) => { const numericId = parseInt(idString, 10); if (isNaN(numericId) || numericId <= 0) { setManagerLookupError('Invalid ID format.'); setFetchedManagerName(null); setEditData(prev => ({ ...prev, manager: null })); return; } if (numericId === editData.manager && fetchedManagerName) { return; }
             setManagerLookupLoading(true); setManagerLookupError(''); setFetchedManagerName(null);
             try { const userRes = await getUserDetail(numericId); const userData = userRes?.data; if (userData && userData.id) { setFetchedManagerName(userData.name || userData.username || `User ID ${userData.id}`); setEditData(prev => ({ ...prev, manager: numericId })); setManagerLookupError(''); } else { setManagerLookupError('User not found.'); setFetchedManagerName(null); setEditData(prev => ({ ...prev, manager: null })); } }
             catch (err) { if (err.response?.status === 404) { setManagerLookupError('User not found.'); } else { setManagerLookupError('Lookup failed.'); } setFetchedManagerName(null); setEditData(prev => ({ ...prev, manager: null })); }
             finally { setManagerLookupLoading(false); } };
         lookupManager(debouncedManagerInput);
     }, [debouncedManagerInput, editData.manager, fetchedManagerName, isEditing]);

    // --- Handlers ---
     const handleEditInputChange = (e) => { const { name, value } = e.target; setEditData(prev => ({ ...prev, [name]: value })); if (formError) setFormError(''); };
     const handleManagerInputChange = (e) => { const value = e.target.value; setManagerInput(value); if (value === '') { setManagerLookupLoading(false); setManagerLookupError(''); setFetchedManagerName(null); setEditData(prev => ({ ...prev, manager: null })); } };

    const handleUpdate = async (e) => {
        e.preventDefault(); setFormError('');
        if (managerLookupLoading) { setFormError('Please wait for manager verification.'); return; }
        if (managerInput && managerLookupError) { setFormError(`Manager ID is invalid: ${managerLookupError}`); return; }
        if (managerInput && editData.manager === null && !managerLookupError) { setFormError('Manager verification pending/failed.'); return; }
        if (!managerInput && editData.manager !== null) { setEditData(prev => ({...prev, manager: null})); }
        if (!editData.name.trim()) { setFormError('Workshop name cannot be empty.'); return; }
        if (!editData.department) { setFormError('Department selection is required.'); return; }
        setIsSaving(true);
        const payload = { name: editData.name.trim(), description: editData.description.trim() || null, department: parseInt(editData.department, 10), manager: editData.manager, operational_status: editData.operational_status, };

        try {
            const response = await updateWorkshop(id, payload); setWorkshop(response.data);
             const updatedDeptId = response.data.department; const updatedManagerId = response.data.manager; setRelatedError('');
             const updateRelatedPromises = [];
             if (updatedDeptId) { updateRelatedPromises.push(getDepartmentDetail(updatedDeptId).catch(err => ({ error: true, type: 'department', reason: err }))); }
             else { updateRelatedPromises.push(Promise.resolve(null)); setDepartment(null); }
             if (updatedManagerId) { updateRelatedPromises.push(getUserDetail(updatedManagerId).catch(err => ({ error: true, type: 'manager', reason: err }))); }
             else { updateRelatedPromises.push(Promise.resolve(null)); setManager(null); setFetchedManagerName(null); }
             const relatedResults = await Promise.allSettled(updateRelatedPromises); let updateRelatedErrors = [];
             if (relatedResults[0].status === 'fulfilled' && relatedResults[0].value && !relatedResults[0].value.error) { setDepartment(relatedResults[0].value.data); }
             else if (relatedResults[0].value?.error || relatedResults[0].status === 'rejected') { updateRelatedErrors.push('Could not reload updated department details.'); setDepartment(null); }
             if (relatedResults[1].status === 'fulfilled' && relatedResults[1].value && !relatedResults[1].value.error) { const mgrData = relatedResults[1].value.data; setManager(mgrData); setFetchedManagerName(mgrData.name || mgrData.username || `User ID ${mgrData.id}`); }
             else if (relatedResults[1].value?.error || relatedResults[1].status === 'rejected') { updateRelatedErrors.push('Could not reload updated manager details.'); setManager(null); setFetchedManagerName(null); }
             if (updateRelatedErrors.length > 0) { setRelatedError(updateRelatedErrors.join(' ')); }
            setIsEditing(false);
        } catch (err) {
             const backendErrors = err.response?.data;
             if (typeof backendErrors === 'object' && backendErrors !== null) { const errorMessages = Object.entries(backendErrors).map(([field, messages]) => `${field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' \n'); setFormError(errorMessages || 'Update failed. Check fields.'); }
             else { setFormError(backendErrors?.detail || err.message || 'An unknown error occurred during update.'); }
        } finally { setIsSaving(false); }
    };

    const handleCancelEdit = () => {
        setIsEditing(false); setFormError('');
        if (workshop) {
            const resetData = { name: workshop.name || '', description: workshop.description || '', department: workshop.department || '', manager: workshop.manager || null, operational_status: workshop.operational_status || 'ACTIVE', };
            setEditData(resetData); setManagerInput(workshop.manager ? String(workshop.manager) : '');
            if (manager) { setFetchedManagerName(manager.name || manager.username || `User ID ${manager.id}`); setManagerLookupError(''); }
            else { setFetchedManagerName(null); setManagerLookupError(workshop.manager ? 'Verification needed' : ''); }
        }
    };

    const handleDelete = async () => {
        const workshopName = workshop?.name || `Workshop ID ${id}`;
        if (window.confirm(`Are you sure you want to delete "${workshopName}"? This may affect associated machines.`)) {
            setIsDeleting(true); setError(''); setFormError('');
            try { await deleteWorkshop(id); navigate('/workshops'); }
            catch (err) { let errorMsg = err.response?.data?.detail || 'Failed to delete workshop.'; setError(errorMsg); setIsDeleting(false); }
        }
    };


    // --- Render Logic ---

    if (loading) { return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> </div> ); }
    if (error && !workshop) { return ( <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center"> <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/> <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Workshop</h3> <p className="text-red-700 mb-4 whitespace-pre-wrap">{error}</p> <Link to="/workshops" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workshops List </Link> </div> ); }
    if (!workshop) return null;

    const displayDeptName = department?.name || (workshop.department ? `ID: ${workshop.department}` : '');
    const displayManagerName = manager?.name || manager?.username || (workshop.manager ? `ID: ${workshop.manager}` : '');

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             <Link to="/workshops" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Workshops
             </Link>

             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-y-3">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center min-w-0 mr-4">
                          <Building className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/>
                          <span className="truncate" title={isEditing ? 'Edit Workshop' : workshop.name}> {isEditing ? 'Edit Workshop' : workshop.name} </span>
                     </h2>
                      {!isEditing && (
                          <div className="flex items-center space-x-3 flex-shrink-0">
                             <button onClick={() => setIsEditing(true)} className="inline-flex items-center px-3.5 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isDeleting} > <Edit className="h-4 w-4 mr-1.5 -ml-0.5" /> Edit </button>
                             <button onClick={handleDelete} className="inline-flex items-center px-3.5 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isDeleting} > {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Trash2 className="h-4 w-4 mr-1.5 -ml-0.5" />} {isDeleting ? 'Deleting...' : 'Delete'} </button>
                          </div>
                      )}
                  </div>

                 {error && workshop && ( <div className="border-b border-red-200 bg-red-50 px-6 py-3"> <p className="text-sm text-red-700 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {error} </p> </div> )}
                 {relatedError && ( <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3"> <p className="text-sm text-yellow-800 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600 flex-shrink-0" /> {relatedError} </p> </div> )}

                 <div className="p-6 md:p-8">
                     {!isEditing ? (
                        // --- View Mode ---
                         <dl className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6 text-sm">
                             {/* Name */}
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Building className="h-4 w-4 mr-1.5 text-gray-400"/>Workshop Name</dt> <dd className="text-gray-900">{workshop.name || '-'}</dd> </div>
                             {/* Status */}
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Activity className="h-4 w-4 mr-1.5 text-gray-400"/>Status</dt> <dd className="mt-1"><StatusBadge status={workshop.operational_status} /></dd> </div>
                             {/* Spacer or other field */}
                              <div className="md:col-span-2"></div>

                             {/* Department */}
                             <div className="md:col-span-3">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Briefcase className="h-4 w-4 mr-1.5 text-gray-400"/>Department</dt>
                                 <dd className="text-gray-900" title={department ? `ID: ${department.id}` : `ID: ${workshop.department || '?'}`}>
                                     {displayDeptName || <span className="italic text-gray-500">Not assigned</span>}
                                     {!department && workshop.department && relatedError.includes('department') && <span className="text-xs text-red-500 ml-1">(Error)</span>}
                                 </dd>
                             </div>
                             {/* Manager */}
                             <div className="md:col-span-3">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><User className="h-4 w-4 mr-1.5 text-gray-400"/>Manager</dt>
                                 <dd className="text-gray-900" title={manager ? `ID: ${manager.id}` : `ID: ${workshop.manager || '?'}`}>
                                     {displayManagerName || <span className="italic text-gray-500">Not assigned</span>}
                                     {!manager && workshop.manager && relatedError.includes('manager') && <span className="text-xs text-red-500 ml-1">(Error)</span>}
                                 </dd>
                             </div>

                             {/* Description */}
                             <div className="md:col-span-6 pt-2">
                                 <dt className="font-semibold text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Description</dt>
                                 <dd className="text-gray-800 whitespace-pre-wrap leading-relaxed">{workshop.description || <span className="italic text-gray-500">No description provided</span>}</dd>
                             </div>
                             {/* Last Updated */}
                             <div className="md:col-span-6 border-t border-gray-200 pt-4 mt-4">
                                 <dt className="font-medium text-xs text-gray-500 uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>Last Updated</dt>
                                 <dd className="mt-1 text-gray-700 text-xs">{formatDateTime(workshop.updated_at)}</dd>
                             </div>
                         </dl>
                     ) : (
                        // --- Edit Mode ---
                         <form onSubmit={handleUpdate} className="space-y-6">
                             {formError && ( <div className="p-3 rounded-md bg-red-50 border border-red-200"> <p className="text-sm text-red-700 flex items-center whitespace-pre-wrap"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {formError} </p> </div> )}

                              {/* Name Input */}
                              <div>
                                 <label htmlFor="edit-ws-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Building className="h-4 w-4 mr-1 text-gray-400"/> Workshop Name <span className="text-red-500 ml-1">*</span></label>
                                 <input type="text" id="edit-ws-name" name="name" value={editData.name} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter workshop name"/>
                             </div>
                             {/* Department Dropdown */}
                              <div>
                                  <label htmlFor="edit-ws-department" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Briefcase className="h-4 w-4 mr-1 text-gray-400"/> Department <span className="text-red-500 ml-1">*</span></label>
                                  <select id="edit-ws-department" name="department" value={editData.department} onChange={handleEditInputChange} required disabled={isSaving || departments.length === 0} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed">
                                      <option value="">-- Select Department --</option>
                                      {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name || `Dept ID ${dept.id}`}</option>)}
                                  </select>
                                  {departments.length === 0 && !loading && <p className="mt-1 text-xs text-yellow-600">No departments available.</p>}
                              </div>
                             {/* Manager ID Input + Lookup */}
                              <div>
                                  <label htmlFor="edit-ws-manager" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><User className="h-4 w-4 mr-1 text-gray-400"/> Manager ID (Optional)</label>
                                  <div className="flex items-center space-x-3">
                                      <input type="number" id="edit-ws-manager" name="managerInput" value={managerInput} onChange={handleManagerInputChange} min="1" step="1" disabled={isSaving} className="shadow-sm block w-full max-w-xs border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter User ID"/>
                                      <div className="flex items-center text-sm h-9">
                                          {managerLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400"/>}
                                          {!managerLookupLoading && managerLookupError && (<span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1 text-red-500"/> {managerLookupError}</span>)}
                                          {!managerLookupLoading && !managerLookupError && fetchedManagerName && (<span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1 text-green-500"/> {fetchedManagerName}</span>)}
                                          {!managerLookupLoading && !fetchedManagerName && !managerLookupError && managerInput && (<span className="text-gray-500 italic">Verifying...</span>)}
                                      </div>
                                  </div>
                              </div>
                             {/* Status Dropdown */}
                              <div>
                                  <label htmlFor="edit-ws-status" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Activity className="h-4 w-4 mr-1 text-gray-400"/> Operational Status <span className="text-red-500 ml-1">*</span></label>
                                  <select id="edit-ws-status" name="operational_status" value={editData.operational_status} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed">
                                      {OPERATIONAL_STATUS_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                              </div>
                             {/* Description Textarea */}
                             <div>
                                  <label htmlFor="edit-ws-description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1 text-gray-400"/> Description</label>
                                  <textarea id="edit-ws-description" name="description" rows="4" value={editData.description} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter a brief description..."></textarea>
                             </div>

                             {/* Action Buttons */}
                             <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200 mt-8">
                                 <button type="button" onClick={handleCancelEdit} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving}> <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel </button>
                                 <button type="submit" className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving || managerLookupLoading}> {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />} {isSaving ? 'Saving...' : 'Save Changes'} </button>
                             </div>
                         </form>
                     )}
                 </div>
            </div>
        </div>
    );
}

export default WorkshopDetailPage;