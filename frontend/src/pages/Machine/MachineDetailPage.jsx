// src/pages/machines/MachineDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Adjust imports for your API service functions
import { getMachine, updateMachine, deleteMachine, getWorkshop, getUserDetail, listWorkshops } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, ArrowLeft, Edit, Trash2, Save, X, Info, CheckCircle, AlertCircle,
    Cog, Building, User, CalendarDays, Wrench, Clock, Tag, HelpCircle, ListChecks
} from 'lucide-react';

// --- Status Badge Component ---
const StatusBadge = ({ status }) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    let bgColor = 'bg-gray-100'; let textColor = 'text-gray-800'; let Icon = HelpCircle;
    switch (lowerStatus) {
        case 'operational': case 'running': case 'active': bgColor = 'bg-green-100'; textColor = 'text-green-800'; Icon = CheckCircle; break;
        case 'idle': bgColor = 'bg-sky-100'; textColor = 'text-sky-800'; Icon = Info; break;
        case 'maintenance': case 'under maintenance': bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; Icon = Wrench; break;
        case 'broken': case 'broke down': case 'stopped': case 'inactive': bgColor = 'bg-red-100'; textColor = 'text-red-800'; Icon = AlertCircle; break;
        default: break;
    }
    const capitalizedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' ') : 'Unknown';
    return (
        <span title={`Status: ${capitalizedStatus}`} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bgColor} ${textColor}`}>
            <Icon aria-hidden="true" className={`h-4 w-4 mr-1.5 ${textColor}`} /> {capitalizedStatus}
        </span>
    );
};

// --- STATUS_CHOICES for Edit Dropdown ---
const STATUS_CHOICES = [
    ['OPERATIONAL', 'Operational'],
    ['IDLE', 'Idle'],
    ['MAINTENANCE', 'Under Maintenance'],
    ['BROKEN', 'Broken Down'],
];

// --- Helper to format Date and Time ---
const formatDateTime = (dateTimeString) => {
    // 1. Handle null, undefined, or empty strings
    if (!dateTimeString) {
        // console.log("formatDateTime received invalid input:", dateTimeString);
        return 'N/A';
    }
    try {
        // 2. Attempt to create a Date object
        const date = new Date(dateTimeString);

        // 3. Check if the Date object is valid
        if (isNaN(date.getTime())) {
            console.error("formatDateTime created an Invalid Date from:", dateTimeString);
            return 'Invalid Date'; // Indicate the source string was bad
        }

        // 4. Format the valid date
        return date.toLocaleString(undefined, { // Use user's locale settings
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        });
    } catch (e) {
        // 5. Catch any unexpected errors during parsing/formatting
        console.error("Error in formatDateTime:", e, "Input:", dateTimeString);
        return 'Formatting Error';
    }
};


// --- Helper to format Date only for display ---
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString + 'T00:00:00Z'); // Assume UTC date-only string if no time part
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
    } catch (e) { return 'Invalid Date'; }
};

// --- Helper to format date for input type="date" (YYYY-MM-DD) ---
const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) { return ''; }
};

// --- Debounce Hook ---
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

function MachineDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- State ---
    const [machine, setMachine] = useState(null);
    const [workshop, setWorkshop] = useState(null);
    const [operator, setOperator] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', model_number: '', workshop: '', status: '', last_maintenance_date: null, next_maintenance_date: null, purchase_date: null, operator: null });
    const [workshops, setWorkshops] = useState([]);
    const [operatorInput, setOperatorInput] = useState('');
    const [operatorLookupLoading, setOperatorLookupLoading] = useState(false);
    const [operatorLookupError, setOperatorLookupError] = useState('');
    const [fetchedOperatorName, setFetchedOperatorName] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [relatedError, setRelatedError] = useState('');

    const debouncedOperatorInput = useDebounce(operatorInput, 500);

    // --- Fetch Initial Data ---
    const fetchMachineDetails = useCallback(async () => {
        setLoading(true); setError(''); setRelatedError(''); setFormError('');
        setMachine(null); setWorkshop(null); setOperator(null); setFetchedOperatorName(null);
        let fetchErrors = [];

        try {
            const results = await Promise.allSettled([
                getMachine(id),
                listWorkshops()
            ]);

            let machineData = null;
            let initialOperatorId = null;
            if (results[0].status === 'fulfilled') {
                machineData = results[0].value.data;
                setMachine(machineData);
                initialOperatorId = machineData.operator;
                // *** DEBUG LOG: Check the received machine data ***
                console.log("Fetched machine data:", machineData);
                console.log("Value of updated_at:", machineData?.updated_at);
                // *** END DEBUG LOG ***
            } else {
                console.error("Failed to fetch machine:", results[0].reason);
                setError(results[0].reason.response?.data?.detail || results[0].reason.message || 'Failed to load machine details.');
                setLoading(false); return;
            }

            if (results[1].status === 'fulfilled') {
                 setWorkshops(Array.isArray(results[1].value?.data) ? results[1].value.data : []);
             } else {
                 console.error("Failed to fetch workshops list:", results[1].reason);
                 fetchErrors.push('Failed to load workshop list for editing.');
             }

             if (machineData) {
                const initialEditData = {
                    name: machineData.name || '',
                    model_number: machineData.model_number || '',
                    workshop: machineData.workshop || '',
                    status: machineData.status || 'IDLE',
                    last_maintenance_date: formatDateForInput(machineData.last_maintenance_date),
                    next_maintenance_date: formatDateForInput(machineData.next_maintenance_date),
                    purchase_date: formatDateForInput(machineData.purchase_date),
                    operator: machineData.operator || null,
                };
                 setEditData(initialEditData);
                 setOperatorInput(machineData.operator ? String(machineData.operator) : '');
             }

            const relatedPromises = [];
            const workshopId = machineData?.workshop;
            if (workshopId) { relatedPromises.push(getWorkshop(workshopId).catch(err => ({ error: true, type: 'workshop', reason: err }))); }
            else { relatedPromises.push(Promise.resolve(null)); }
            if (initialOperatorId) { relatedPromises.push(getUserDetail(initialOperatorId).catch(err => ({ error: true, type: 'operator', reason: err }))); }
            else { relatedPromises.push(Promise.resolve(null)); }
            const relatedResults = await Promise.allSettled(relatedPromises);

            if (relatedResults[0].status === 'fulfilled' && relatedResults[0].value && !relatedResults[0].value.error) { setWorkshop(relatedResults[0].value.data); }
            else if (relatedResults[0].value?.error || relatedResults[0].status === 'rejected') { fetchErrors.push('Could not load workshop details.'); }
            if (relatedResults[1].status === 'fulfilled' && relatedResults[1].value && !relatedResults[1].value.error) {
                 const operatorData = relatedResults[1].value.data; setOperator(operatorData);
                 setFetchedOperatorName(operatorData.name || operatorData.username || `User ID ${operatorData.id}`);
                 setOperatorLookupError('');
             } else if (relatedResults[1].value?.error || relatedResults[1].status === 'rejected') {
                 fetchErrors.push('Could not load operator details.'); setOperatorLookupError('Initial operator not found.'); setFetchedOperatorName(null);
             }
            if (fetchErrors.length > 0) { setRelatedError(fetchErrors.join(' ')); }

        } catch (err) { setError('An unexpected error occurred while loading data.'); }
        finally { setLoading(false); }
    }, [id]); // Include id in dependency array

    // --- useEffect Hooks ---
    useEffect(() => { if (!isAuthenticated) { navigate('/login'); return; } if (id) { fetchMachineDetails(); } else { setError("Machine ID is missing."); setLoading(false); } }, [id, isAuthenticated, navigate, fetchMachineDetails]); // Added fetchMachineDetails

     useEffect(() => { if (!isEditing) return; if (!debouncedOperatorInput) { setOperatorLookupLoading(false); setOperatorLookupError(''); setFetchedOperatorName(null); if (editData.operator !== null) { setEditData(prev => ({ ...prev, operator: null })); } return; }
         const lookupOperator = async (idString) => { const numericId = parseInt(idString, 10); if (isNaN(numericId) || numericId <= 0) { setOperatorLookupError('Invalid ID format.'); setFetchedOperatorName(null); setEditData(prev => ({ ...prev, operator: null })); return; } if (numericId === editData.operator && fetchedOperatorName) { return; }
             setOperatorLookupLoading(true); setOperatorLookupError(''); setFetchedOperatorName(null);
             try { const userRes = await getUserDetail(numericId); const userData = userRes?.data; if (userData && userData.id) { setFetchedOperatorName(userData.name || userData.username || `User ID ${userData.id}`); setEditData(prev => ({ ...prev, operator: numericId })); setOperatorLookupError(''); } else { setOperatorLookupError('User not found.'); setFetchedOperatorName(null); setEditData(prev => ({ ...prev, operator: null })); } }
             catch (err) { if (err.response?.status === 404) { setOperatorLookupError('User not found.'); } else { setOperatorLookupError('Lookup failed.'); } setFetchedOperatorName(null); setEditData(prev => ({ ...prev, operator: null })); }
             finally { setOperatorLookupLoading(false); } };
         lookupOperator(debouncedOperatorInput);
     }, [debouncedOperatorInput, editData.operator, fetchedOperatorName, isEditing]);

    // --- Handlers ---
    const handleEditInputChange = (e) => { const { name, value } = e.target; setEditData(prev => ({ ...prev, [name]: value })); if (formError) setFormError(''); };
    const handleOperatorInputChange = (e) => { const value = e.target.value; setOperatorInput(value); if (value === '') { setOperatorLookupLoading(false); setOperatorLookupError(''); setFetchedOperatorName(null); setEditData(prev => ({ ...prev, operator: null })); } };
    const handleUpdate = async (e) => {
        e.preventDefault(); setFormError('');
        if (operatorLookupLoading) { setFormError('Please wait for operator verification.'); return; }
        if (operatorInput && operatorLookupError) { setFormError(`Operator ID is invalid: ${operatorLookupError}`); return; }
        if (operatorInput && editData.operator === null && !operatorLookupError) { setFormError('Operator verification pending/failed.'); return; }
        if (!operatorInput && editData.operator !== null) { setEditData(prev => ({...prev, operator: null})); }
        if (!editData.name.trim()) { setFormError('Machine name cannot be empty.'); return; }
        if (!editData.workshop) { setFormError('Workshop selection is required.'); return; }
        setIsSaving(true);
        const payload = { name: editData.name.trim(), model_number: editData.model_number.trim() || null, workshop: parseInt(editData.workshop, 10), status: editData.status, operator: editData.operator, purchase_date: editData.purchase_date || null, last_maintenance_date: editData.last_maintenance_date || null, next_maintenance_date: editData.next_maintenance_date || null, };

        try {
            const response = await updateMachine(id, payload); setMachine(response.data);
             // *** DEBUG LOG: Check updated machine data ***
             console.log("Updated machine data:", response.data);
             console.log("Value of updated_at after update:", response.data?.updated_at);
             // *** END DEBUG LOG ***
             const updatedWorkshopId = response.data.workshop; const updatedOperatorId = response.data.operator; setRelatedError('');
             const updateRelatedPromises = [];
             if (updatedWorkshopId) { updateRelatedPromises.push(getWorkshop(updatedWorkshopId).catch(err => ({ error: true, type: 'workshop', reason: err }))); }
             else { updateRelatedPromises.push(Promise.resolve(null)); setWorkshop(null); }
             if (updatedOperatorId) { updateRelatedPromises.push(getUserDetail(updatedOperatorId).catch(err => ({ error: true, type: 'operator', reason: err }))); }
             else { updateRelatedPromises.push(Promise.resolve(null)); setOperator(null); setFetchedOperatorName(null); }
             const relatedResults = await Promise.allSettled(updateRelatedPromises); let updateRelatedErrors = [];
             if (relatedResults[0].status === 'fulfilled' && relatedResults[0].value && !relatedResults[0].value.error) { setWorkshop(relatedResults[0].value.data); }
             else if (relatedResults[0].value?.error || relatedResults[0].status === 'rejected') { updateRelatedErrors.push('Could not reload updated workshop details.'); setWorkshop(null); }
             if (relatedResults[1].status === 'fulfilled' && relatedResults[1].value && !relatedResults[1].value.error) { const opData = relatedResults[1].value.data; setOperator(opData); setFetchedOperatorName(opData.name || opData.username || `User ID ${opData.id}`); }
             else if (relatedResults[1].value?.error || relatedResults[1].status === 'rejected') { updateRelatedErrors.push('Could not reload updated operator details.'); setOperator(null); setFetchedOperatorName(null); }
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
        if (machine) {
            const resetData = { name: machine.name || '', model_number: machine.model_number || '', workshop: machine.workshop || '', status: machine.status || 'IDLE', last_maintenance_date: formatDateForInput(machine.last_maintenance_date), next_maintenance_date: formatDateForInput(machine.next_maintenance_date), purchase_date: formatDateForInput(machine.purchase_date), operator: machine.operator || null, };
            setEditData(resetData); setOperatorInput(machine.operator ? String(machine.operator) : '');
            if (operator) { setFetchedOperatorName(operator.name || operator.username || `User ID ${operator.id}`); setOperatorLookupError(''); }
            else { setFetchedOperatorName(null); setOperatorLookupError(machine.operator ? 'Verification needed' : ''); }
        }
    };
    const handleDelete = async () => {
        const machineName = machine?.name || `Machine ID ${id}`;
        if (window.confirm(`Are you sure you want to delete "${machineName}"? This action cannot be undone.`)) {
            setIsDeleting(true); setError(''); setFormError('');
            try { await deleteMachine(id); navigate('/machines'); }
            catch (err) { let errorMsg = err.response?.data?.detail || 'Failed to delete machine.'; setError(errorMsg); setIsDeleting(false); }
        }
    };

    // --- Render Logic ---
    if (loading) { return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> </div> ); }
    if (error && !machine) { return ( <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center"> <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/> <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Machine</h3> <p className="text-red-700 mb-4 whitespace-pre-wrap">{error}</p> <Link to="/machines" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to Machines List </Link> </div> ); }
    if (!machine) return null;

    const displayWorkshopName = workshop?.name || (machine.workshop ? `ID: ${machine.workshop}` : '');
    const displayOperatorName = operator?.name || operator?.username || (machine.operator ? `ID: ${machine.operator}` : '');

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             <Link to="/machines" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Machines
             </Link>

             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-y-3">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center min-w-0 mr-4">
                          <Cog className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/>
                          <span className="truncate" title={isEditing ? 'Edit Machine' : machine.name}> {isEditing ? 'Edit Machine' : machine.name} </span>
                     </h2>
                      {!isEditing && (
                          <div className="flex items-center space-x-3 flex-shrink-0">
                             <button onClick={() => setIsEditing(true)} className="inline-flex items-center px-3.5 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isDeleting} > <Edit className="h-4 w-4 mr-1.5 -ml-0.5" /> Edit </button>
                             <button onClick={handleDelete} className="inline-flex items-center px-3.5 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isDeleting} > {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Trash2 className="h-4 w-4 mr-1.5 -ml-0.5" />} {isDeleting ? 'Deleting...' : 'Delete'} </button>
                          </div>
                      )}
                  </div>

                 {error && machine && ( <div className="border-b border-red-200 bg-red-50 px-6 py-3"> <p className="text-sm text-red-700 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {error} </p> </div> )}
                 {relatedError && ( <div className="border-b border-yellow-200 bg-yellow-50 px-6 py-3"> <p className="text-sm text-yellow-800 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600 flex-shrink-0" /> {relatedError} </p> </div> )}

                 <div className="p-6 md:p-8">
                     {!isEditing ? (
                         <dl className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6 text-sm">
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Tag className="h-4 w-4 mr-1.5 text-gray-400"/>Machine Name</dt> <dd className="text-gray-900">{machine.name || '-'}</dd> </div>
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Tag className="h-4 w-4 mr-1.5 text-gray-400"/>Model Number</dt> <dd className="text-gray-900">{machine.model_number || <span className="italic text-gray-500">N/A</span>}</dd> </div>
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Wrench className="h-4 w-4 mr-1.5 text-gray-400"/>Status</dt> <dd className="mt-1"><StatusBadge status={machine.status} /></dd> </div>
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Building className="h-4 w-4 mr-1.5 text-gray-400"/>Workshop</dt> <dd className="text-gray-900" title={workshop ? `ID: ${workshop.id}` : `ID: ${machine.workshop || '?'}`}> {displayWorkshopName || <span className="italic text-gray-500">Unassigned</span>} {!workshop && machine.workshop && relatedError.includes('workshop') && <span className="text-xs text-red-500 ml-1">(Error)</span>} </dd> </div>
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><User className="h-4 w-4 mr-1.5 text-gray-400"/>Operator</dt> <dd className="text-gray-900" title={operator ? `ID: ${operator.id}` : `ID: ${machine.operator || '?'}`}> {displayOperatorName || <span className="italic text-gray-500">Unassigned</span>} {!operator && machine.operator && relatedError.includes('operator') && <span className="text-xs text-red-500 ml-1">(Error)</span>} </dd> </div>
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Clock className="h-4 w-4 mr-1.5 text-gray-400"/>Operator Assigned</dt> <dd className="text-gray-900">{formatDateTime(machine.operator_assigned_at)}</dd> </div>
                             <div className="md:col-span-2 pt-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><CalendarDays className="h-4 w-4 mr-1.5 text-gray-400"/>Purchase Date</dt> <dd className="text-gray-900">{formatDateDisplay(machine.purchase_date)}</dd> </div>
                             <div className="md:col-span-2 pt-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><CalendarDays className="h-4 w-4 mr-1.5 text-gray-400"/>Last Maintenance</dt> <dd className="text-gray-900">{formatDateDisplay(machine.last_maintenance_date)}</dd> </div>
                             <div className="md:col-span-2 pt-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><CalendarDays className="h-4 w-4 mr-1.5 text-gray-400"/>Next Maintenance Due</dt> <dd className="text-gray-900 font-medium">{formatDateDisplay(machine.next_maintenance_date)}</dd> </div>
                             {/* *** Use formatDateTime for updated_at *** */}
                             <div className="md:col-span-6 border-t border-gray-200 pt-4 mt-4">
                                 <dt className="font-medium text-xs text-gray-500 uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>Last Updated</dt>
                                 <dd className="mt-1 text-gray-700 text-xs">{formatDateTime(machine.updated_at)}</dd>
                             </div>
                             {/* *** End Use formatDateTime *** */}
                         </dl>
                     ) : (
                         <form onSubmit={handleUpdate} className="space-y-6">
                             {formError && ( <div className="p-3 rounded-md bg-red-50 border border-red-200"> <p className="text-sm text-red-700 flex items-center whitespace-pre-wrap"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {formError} </p> </div> )}
                             {/* Form Inputs remain the same as previous version */}
                              <div>
                                 <label htmlFor="edit-machine-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Cog className="h-4 w-4 mr-1 text-gray-400"/>Machine Name <span className="text-red-500 ml-1">*</span> </label>
                                 <input type="text" id="edit-machine-name" name="name" value={editData.name} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter machine name" />
                             </div>
                             <div>
                                  <label htmlFor="edit-machine-model" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Tag className="h-4 w-4 mr-1 text-gray-400"/>Model Number </label>
                                  <input type="text" id="edit-machine-model" name="model_number" value={editData.model_number} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., XM-5000" />
                              </div>
                             <div>
                                  <label htmlFor="edit-machine-workshop" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Building className="h-4 w-4 mr-1 text-gray-400"/>Workshop <span className="text-red-500 ml-1">*</span> </label>
                                  <select id="edit-machine-workshop" name="workshop" value={editData.workshop} onChange={handleEditInputChange} required disabled={isSaving || workshops.length === 0} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" >
                                      <option value="">-- Select Workshop --</option> {workshops.map(ws => <option key={ws.id} value={ws.id}>{ws.name || `Workshop ID ${ws.id}`}</option>)}
                                  </select> {workshops.length === 0 && !loading && <p className="mt-1 text-xs text-yellow-600">No workshops available.</p>}
                              </div>
                             <div>
                                  <label htmlFor="edit-machine-status" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <ListChecks className="h-4 w-4 mr-1 text-gray-400"/>Status <span className="text-red-500 ml-1">*</span> </label>
                                  <select id="edit-machine-status" name="status" value={editData.status} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" >
                                      {STATUS_CHOICES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                  </select>
                              </div>
                              <div>
                                 <label htmlFor="edit-machine-operator-id" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <User className="h-4 w-4 mr-1 text-gray-400"/>Operator ID (Optional) </label>
                                 <div className="flex items-center space-x-3">
                                     <input type="number" id="edit-machine-operator-id" name="operatorInput" value={operatorInput} onChange={handleOperatorInputChange} min="1" step="1" disabled={isSaving} className="shadow-sm block w-full max-w-xs border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter User ID or leave blank" />
                                     <div className="flex items-center text-sm h-9">
                                          {operatorLookupLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400"/>}
                                          {!operatorLookupLoading && operatorLookupError && (<span className="flex items-center text-red-600"><XCircle className="h-4 w-4 mr-1 text-red-500"/> {operatorLookupError}</span>)}
                                          {!operatorLookupLoading && !operatorLookupError && fetchedOperatorName && (<span className="flex items-center text-green-600"><CheckCircle className="h-4 w-4 mr-1 text-green-500"/> {fetchedOperatorName}</span>)}
                                          {!operatorLookupLoading && !fetchedOperatorName && !operatorLookupError && operatorInput && (<span className="text-gray-500 italic">Verifying...</span>)}
                                     </div>
                                 </div>
                              </div>
                             <div>
                                  <label htmlFor="edit-machine-purchase-date" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <CalendarDays className="h-4 w-4 mr-1 text-gray-400"/>Purchase Date </label>
                                  <input type="date" id="edit-machine-purchase-date" name="purchase_date" value={editData.purchase_date || ''} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" />
                              </div>
                               <div>
                                  <label htmlFor="edit-machine-last-maint" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <CalendarDays className="h-4 w-4 mr-1 text-gray-400"/>Last Maintenance </label>
                                  <input type="date" id="edit-machine-last-maint" name="last_maintenance_date" value={editData.last_maintenance_date || ''} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" />
                              </div>
                               <div>
                                   <label htmlFor="edit-machine-next-maint" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <CalendarDays className="h-4 w-4 mr-1 text-gray-400"/>Next Maintenance </label>
                                   <input type="date" id="edit-machine-next-maint" name="next_maintenance_date" value={editData.next_maintenance_date || ''} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" />
                               </div>

                             <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200 mt-8">
                                 <button type="button" onClick={handleCancelEdit} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving} > <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel </button>
                                 <button type="submit" className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving || operatorLookupLoading} > {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />} {isSaving ? 'Saving...' : 'Save Changes'} </button>
                             </div>
                         </form>
                     )}
                 </div>
            </div>
        </div>
    );
}

export default MachineDetailPage;