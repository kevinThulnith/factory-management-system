import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDepartmentDetail, updateDepartment, deleteDepartment } from '../../services/api'; // Adjust paths
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
import { Building2, MapPin, Clock, Save, X, Edit, Trash2, ArrowLeft, AlertTriangle, Loader2, User, FileText } from 'lucide-react';

function DepartmentDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- State ---
    const [department, setDepartment] = useState(null);
    const [editData, setEditData] = useState({ name: '', description: '', location: '', supervisor: '' });
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');

    // --- Fetch Department Data ---
    const fetchDepartment = useCallback(async () => {
        setLoading(true); setError(''); setFormError('');
        try {
            const response = await getDepartmentDetail(id);
            const deptData = response.data;
            setDepartment(deptData);
            console.log("[DEBUG] Fetched department data:", deptData); // Log fetched data
            const initialSupervisorId = deptData.supervisor != null ? String(deptData.supervisor) : '';
            setEditData({
                name: deptData.name || '',
                description: deptData.description || '',
                location: deptData.location || '',
                supervisor: initialSupervisorId,
            });
        } catch (err) {
             console.error("Failed to fetch department:", err.response || err); // Log the full error
             if (err.response?.status === 404) { setError('Department not found.'); }
             else if (err.response?.status === 401 || err.response?.status === 403) { setError('You are not authorized to view this department.'); }
             else { setError(`Failed to load department details: ${err.message || 'Unknown error'}`); } // Include error message
            setDepartment(null);
        }
        finally { setLoading(false); }
    }, [id]);

    // --- Effects ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchDepartment();
    }, [id, isAuthenticated, navigate, fetchDepartment]);

    // --- Handlers ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        console.log(`[DEBUG] Input change: ${name} = ${value}`); // Debug log
        setEditData(prevData => {
            const newData = { ...prevData, [name]: value };
            console.log('[DEBUG] New editData state:', newData); // Debug log
            return newData;
        });
        setFormError('');
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!editData.name.trim()) { setFormError('Department name cannot be empty.'); return; }
        setIsSaving(true);

        const supervisorIdValue = editData.supervisor?.toString().trim();
        const payload = {
            name: editData.name.trim(),
            description: editData.description.trim() || null,
            location: editData.location.trim() || null,
            supervisor: supervisorIdValue ? parseInt(supervisorIdValue, 10) : null,
        };

        if (supervisorIdValue && isNaN(payload.supervisor)) {
            setFormError('Invalid Supervisor ID entered. Please enter a number.');
            setIsSaving(false);
            return;
        }

        console.log("[DEBUG] Attempting to update with payload:", payload); // Debug log

        try {
            const response = await updateDepartment(id, payload);
            setDepartment(response.data); // Update local state
             console.log("[DEBUG] Update successful, new department state:", response.data); // Debug log
            setIsEditing(false);
        } catch (err) {
             console.error("Failed to update department:", err.response || err); // Log full error
             let errorMessage = 'Failed to update department. Please check your input.';
            if (err.response?.data && typeof err.response.data === 'object') {
                const errors = [];
                for (const key in err.response.data) {
                    if (key === 'supervisor') {
                         errors.push(`Supervisor: ${Array.isArray(err.response.data[key]) ? err.response.data[key].join(', ') : err.response.data[key]}`);
                    } else {
                         const friendlyKey = key.replace(/_/g, ' ');
                         const messages = Array.isArray(err.response.data[key]) ? err.response.data[key].join(', ') : err.response.data[key];
                         errors.push(`${friendlyKey}: ${messages}`);
                    }
                }
                if (errors.length > 0) { errorMessage = errors.join(' | '); }
                else if (err.response.data.detail) { errorMessage = err.response.data.detail; }
            } else if (err.message) { errorMessage = err.message; }
             setFormError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setFormError('');
        if (department) {
            const initialSupervisorId = department.supervisor != null ? String(department.supervisor) : '';
            const resetData = {
                name: department.name || '',
                description: department.description || '',
                location: department.location || '',
                supervisor: initialSupervisorId,
            };
            setEditData(resetData);
            console.log('[DEBUG] Cancelled edit, reset editData to:', resetData); // Debug log
        }
    };

    const handleDelete = async () => {
        const deptName = department?.name || `Department ID ${id}`;
        if (window.confirm(`Are you sure you want to delete "${deptName}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            setFormError(''); setError('');
            try {
                await deleteDepartment(id);
                navigate('/departments');
            } catch (err) {
                console.error("Failed to delete department:", err.response || err);
                let errorMsg = 'Failed to delete department.';
                if (err.response?.data?.detail) { errorMsg = err.response.data.detail; }
                setError(errorMsg);
                setIsDeleting(false);
            }
        }
    };

    // --- Format Date Helper ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        // console.log(`[DEBUG] Formatting date string: "${dateString}" (Type: ${typeof dateString})`); // Log input date
        try {
            const date = new Date(dateString);
             // Check if the date object is valid
             if (isNaN(date.getTime())) {
                console.error(`[DEBUG] Invalid Date created from string: "${dateString}"`);
                return `Invalid Date (${dateString})`; // Return original string if invalid
             }
            return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (e) {
             console.error(`[DEBUG] Error formatting date string "${dateString}":`, e);
             return `Error (${dateString})`; // Indicate error and show original string
        }
    };


    // --- Render Logic ---

    if (loading) {
        return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> </div> );
    }

    if (error && !department) {
         return ( <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center"> <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/> <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Department</h3> <p className="text-red-700 mb-4">{error}</p> <Link to="/departments" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to Departments List </Link> </div> );
    }

    if (!department) return null;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             {/* Back Button */}
            <Link to="/departments" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" />
                 Back to Departments
            </Link>

            {/* Main Card */}
            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                {/* Card Header */}
                 <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Building2 className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/>
                         {isEditing ? 'Edit Department' : 'Department Details'}
                    </h2>
                     {!isEditing && (
                         <div className="flex items-center space-x-3">
                            {/* Edit Button */}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center px-3.5 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50"
                                disabled={isDeleting}
                            >
                                <Edit className="h-4 w-4 mr-1.5 -ml-0.5" /> Edit
                            </button>
                            {/* Delete Button */}
                            <button
                                onClick={handleDelete}
                                className="inline-flex items-center px-3.5 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition duration-150 ease-in-out disabled:opacity-50"
                                disabled={isDeleting}
                            >
                                {isDeleting
                                    ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/>
                                    : <Trash2 className="h-4 w-4 mr-1.5 -ml-0.5" />}
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                         </div>
                     )}
                 </div>

                 {/* General Error Display */}
                 {error && (
                    <div className="border-b border-red-200 bg-red-50 px-6 py-3">
                        <p className="text-sm text-red-700 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
                            {error}
                        </p>
                    </div>
                  )}

                 {/* Card Body - View or Edit */}
                 <div className="p-6 md:p-8">
                     {!isEditing ? (
                        // --- View Mode ---
                         <dl className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6 text-sm">
                             {/* Name */}
                             <div className="md:col-span-2">
                                 <dt className="font-semibold text-gray-700 mb-0.5">Department Name</dt>
                                 <dd className="text-gray-900">{department.name || '-'}</dd>
                             </div>
                             {/* Location */}
                             <div className="md:col-span-2">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><MapPin className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Location</dt>
                                 <dd className="text-gray-900">{department.location || <span className="italic text-gray-500">Not specified</span>}</dd>
                             </div>
                             {/* Supervisor ID */}
                             <div className="md:col-span-2">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><User className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Supervisor ID</dt>
                                 <dd className="text-gray-900">
                                     {department.supervisor != null ? department.supervisor : <span className="italic text-gray-500">None</span>}
                                 </dd>
                             </div>
                             {/* Description */}
                             <div className="md:col-span-6 pt-2">
                                 <dt className="font-semibold text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Description</dt>
                                 <dd className="text-gray-800 whitespace-pre-wrap leading-relaxed">{department.description || <span className="italic text-gray-500">No description provided</span>}</dd>
                             </div>
                             {/* Last Updated */}
                             <div className="md:col-span-6 border-t border-gray-200 pt-4 mt-4">
                                 <dt className="font-medium text-xs text-gray-500 uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>Last Updated</dt>
                                 <dd className="mt-1 text-gray-700 text-xs">{formatDate(department.updated_at)}</dd>
                             </div>
                         </dl>
                     ) : (
                        // --- Edit Mode ---
                         <form onSubmit={handleUpdate} className="space-y-6">
                             {/* Form Error Display */}
                             {formError && (
                                <div className="p-3 rounded-md bg-red-50 border border-red-200">
                                    <p className="text-sm text-red-700 flex items-center">
                                         <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />
                                        {formError}
                                    </p>
                                </div>
                              )}

                             {/* Name Input */}
                             <div>
                                 <label htmlFor="edit-dept-name" className="block text-sm font-medium text-gray-700 mb-1">Department Name <span className="text-red-500">*</span></label>
                                 <input
                                     type="text" id="edit-dept-name" name="name"
                                     value={editData.name} onChange={handleInputChange} required
                                     disabled={isSaving}
                                     className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                     placeholder="Enter department name"
                                 />
                             </div>
                             {/* Location Input */}
                             <div>
                                 <label htmlFor="edit-dept-location" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><MapPin className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0"/>Location</label>
                                 <input
                                     type="text" id="edit-dept-location" name="location"
                                     value={editData.location} onChange={handleInputChange}
                                     disabled={isSaving}
                                     className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                     placeholder="e.g., Building 5, Area B"
                                 />
                             </div>
                             {/* Supervisor ID Input */}
                              <div>
                                 <label htmlFor="edit-dept-supervisor" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><User className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0"/> Supervisor ID (Optional)</label>
                                 <input
                                     type="number" id="edit-dept-supervisor" name="supervisor"
                                     value={editData.supervisor || ''} onChange={handleInputChange}
                                     min="1" step="1"
                                     disabled={isSaving}
                                     className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                     placeholder="Enter User ID or leave blank"
                                 />
                             </div>
                             {/* Description Textarea */}
                             <div>
                                 <label htmlFor="edit-dept-description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1 text-gray-400 flex-shrink-0"/> Description</label>
                                 <textarea
                                     id="edit-dept-description" name="description" rows="4"
                                     value={editData.description} onChange={handleInputChange}
                                     disabled={isSaving}
                                     className="shadow-sm block border w-full border-gray-950 bg-white rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                     placeholder="Enter a brief description..."
                                 ></textarea>
                             </div>

                             {/* Action Buttons */}
                             <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200 mt-8">
                                 <button
                                     type="button" onClick={handleCancelEdit}
                                     className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50"
                                     disabled={isSaving}
                                 >
                                     <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel
                                 </button>
                                 <button
                                     type="submit"
                                     className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50"
                                     disabled={isSaving}
                                 >
                                     {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />}
                                     {isSaving ? 'Saving...' : 'Save Changes'}
                                 </button>
                             </div>
                         </form>
                     )}
                 </div>
            </div>
        </div>
    );
}

export default DepartmentDetailPage;