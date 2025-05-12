// src/pages/departments/DepartmentsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your structure
import { listDepartments, deleteDepartment, getUserDetail } from '../../services/api'; // Ensure getUserDetail is exported
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react
import {
    Building2, Plus, Trash2, Edit2, Search, MapPin, UserCheck, Clock, AlertTriangle,
    Info, CheckCircle, XCircle, Loader2, AlertCircle, User, ShieldAlert, Lock, Briefcase // Added Briefcase, Lock
} from 'lucide-react';

// Define Role Constants - Ensure these match your backend role names exactly
const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    SUPERVISOR: 'SUPERVISOR',
    OPERATOR: 'OPERATOR',
    TECHNICIAN: 'TECHNICIAN',
    PURCHASING: 'PURCHASING',
};


function DepartmentsPage() {
    // --- State ---
    const [departments, setDepartments] = useState([]);
    const [supervisorDetails, setSupervisorDetails] = useState({}); // { userId: { id, name, username,... }, ... }
    const [loading, setLoading] = useState(true); // Initial loading state
    const [error, setError] = useState(''); // Error for departments fetch/delete
    const [supervisorError, setSupervisorError] = useState(''); // Error for supervisor fetch
    const [searchTerm, setSearchTerm] = useState('');
    const [permissionError, setPermissionError] = useState(''); // Unified permission error state
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth(); // Get user object

    // --- Permissions ---
    // Determine if the current user has permission to ADD departments
    const canAdd = useMemo(() => {
        const userRole = user?.role?.toUpperCase();
        // Example: Only ADMIN and MANAGER can add
        return userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;
    }, [user]);

    // Determine if the current user has permission to DELETE departments
    const canDelete = useMemo(() => {
        const userRole = user?.role?.toUpperCase();
        // Example: Only ADMIN and MANAGER can delete
        return userRole === ROLES.ADMIN || userRole === ROLES.MANAGER;
    }, [user]);


    // --- Data Fetching (Departments & Supervisors) ---
    const fetchData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad && departments.length === 0 && Object.keys(supervisorDetails).length === 0) {
            setLoading(true);
        }
        setError('');
        setSupervisorError(''); // Clear specific errors too

        try {
            console.log("Fetching departments...");
            const deptResponse = await listDepartments();
            const deptData = Array.isArray(deptResponse?.data) ? deptResponse.data : [];
            setDepartments(deptData);
            console.log("Departments fetched:", deptData.length);

            const existingSupervisorIds = new Set(Object.keys(supervisorDetails).map(Number));
            const supervisorIdsToFetch = [
                ...new Set(
                    deptData
                        .map(dept => dept.supervisor)
                        .filter(id => id != null && !existingSupervisorIds.has(id))
                )
            ];
            console.log("Supervisor IDs to fetch details for:", supervisorIdsToFetch);

            if (supervisorIdsToFetch.length > 0) {
                console.log(`Fetching details for ${supervisorIdsToFetch.length} new supervisors...`);
                const supervisorPromises = supervisorIdsToFetch.map(id =>
                    getUserDetail(id).catch(err => ({ error: true, id, reason: err }))
                );
                const results = await Promise.allSettled(supervisorPromises);

                const newlyFetchedDetails = {};
                let supervisorFetchFailed = false;
                results.forEach(result => {
                    if (result.status === 'fulfilled' && result.value?.data && !result.value.error) {
                        newlyFetchedDetails[result.value.data.id] = result.value.data;
                    } else {
                        supervisorFetchFailed = true;
                        const failedId = result.value?.id || result.reason?.id || 'unknown';
                        console.warn(`Failed fetch for supervisor ID ${failedId}:`, result.value?.reason || result.reason);
                    }
                });

                setSupervisorDetails(prevDetails => ({ ...prevDetails, ...newlyFetchedDetails }));

                if (supervisorFetchFailed) {
                    setSupervisorError('Warning: Could not load details for all supervisors.');
                } else {
                     setSupervisorError('');
                }
                 console.log("Supervisor details updated:", Object.keys(newlyFetchedDetails).length, "new entries.");
            } else {
                 console.log("No *new* supervisor details to fetch.");
            }

        } catch (err) {
            console.error("Department fetch failed:", err);
            const msg = err?.response?.data?.detail || err?.message || 'Failed to load departments.';
            setError(err?.response?.status === 401 || err?.response?.status === 403 ? 'Authorization failed.' : msg);
            setDepartments([]);
            setSupervisorDetails({}); // Clear related data on primary error
        } finally {
             setLoading(false);
        }
    }, [supervisorDetails]); // Keep dependency


    // --- Supervisor ID -> Name Map ---
    const supervisorMap = useMemo(() => {
        const map = new Map();
        Object.values(supervisorDetails).forEach(usr => {
            if (usr && usr.id) {
                 const displayName = usr.name || usr.username || `User ID ${usr.id}`;
                map.set(usr.id, displayName);
            }
        });
        return map;
    }, [supervisorDetails]);

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        setPermissionError(''); // Clear permission error on load/auth change
        fetchData(true);
    }, [isAuthenticated, navigate, fetchData]);


    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        if (!canDelete) {
            setPermissionError('Access Denied: You do not have permission to delete departments.');
             setTimeout(() => setPermissionError(''), 5000); // Auto-clear after 5s
            return;
        }

        const departmentIdentifier = name || `Department ID ${id}`;
        if (!window.confirm(`Are you sure you want to delete "${departmentIdentifier}"? This action cannot be undone.`)) {
            return;
        }
        setError(''); setSupervisorError(''); setPermissionError(''); // Clear errors

        try {
            console.log(`Deleting department ID: ${id}`);
            await deleteDepartment(id);
            console.log(`Department ${id} deleted successfully.`);
            // Optimistic UI update: Filter locally for responsiveness
            setDepartments(prevDepartments => prevDepartments.filter(d => d.id !== id));
        } catch (err) {
            console.error("Failed to delete department:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || 'Failed to delete department. It might be referenced elsewhere.';
            setError(errorMsg);
        }
    };

    // --- Filtering Logic ---
    const filteredDepartments = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return searchTerm
            ? departments.filter(dept => {
                const supervisorName = dept.supervisor ? supervisorMap.get(dept.supervisor) : '';
                const supervisorIdString = dept.supervisor != null ? String(dept.supervisor) : '';

                return (
                    dept.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    dept.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    dept.location?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    supervisorIdString.includes(lowerCaseSearchTerm) ||
                    (supervisorName && supervisorName.toLowerCase().includes(lowerCaseSearchTerm))
                );
            })
            : departments; // No search term, use all departments
    }, [departments, searchTerm, supervisorMap]);

    // --- Format Date Helper ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true
            });
        } catch (e) { return 'Invalid Date'; }
    };

    // --- Render Logic ---

    // Loading State
    if (loading && departments.length === 0 && Object.keys(supervisorDetails).length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="ml-3 text-gray-600">Loading data...</p>
            </div>
        );
    }

    const hasFilteredDepartments = filteredDepartments.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header: Title, Search, Add Button */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Departments</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Search className="h-5 w-5 text-gray-400" aria-hidden="true" /> </div>
                         <input type="text" name="search" id="search" className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search departments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>

                     {/* Add Department Button - Conditional */}
                     {canAdd ? (
                         <Link
                             to="/departments/add" // Ensure this route exists
                             className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0"
                         >
                             <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Department
                         </Link>
                     ) : (
                         <button
                             type="button"
                             className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-gray-50 bg-gray-400 cursor-not-allowed flex-shrink-0" // Disabled styles
                             disabled={true}
                             title="You do not have permission to add departments"
                             onClick={() => { // Show permission error on click
                                 setPermissionError('Access Denied: You cannot add departments.');
                                 setTimeout(() => setPermissionError(''), 5000); // Optional auto-clear
                                 }}
                         >
                             <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Department
                         </button>
                     )}
                 </div>
             </div>

            {/* Error Display Area */}
             {error && ( <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm"> <div className="flex items-center"> <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" /> <p className="text-sm text-red-700">{error}</p> </div> </div> )}
             {supervisorError && ( <div className="mb-6 p-4 rounded-md bg-yellow-50 border border-yellow-200 shadow-sm"> <div className="flex items-center"> <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" /> <p className="text-sm text-yellow-700">{supervisorError}</p> </div> </div> )}
             {permissionError && ( <div className="mb-6 p-4 rounded-md bg-orange-50 border border-orange-200 shadow-sm"> <div className="flex items-center"> <ShieldAlert className="h-5 w-5 text-orange-500 mr-3 flex-shrink-0" /> <p className="text-sm text-orange-700">{permissionError}</p> </div> </div> )}

            {/* --- Departments Grid --- */}
            <div className="space-y-0">
                {hasFilteredDepartments ? (
                     <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                        {filteredDepartments.map((dept) => {
                            const supervisorName = dept.supervisor ? supervisorMap.get(dept.supervisor) : null;
                            return (
                                <div key={dept.id} className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 transition-all duration-300 flex flex-col overflow-hidden">
                                    {/* Card Header */}
                                    <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center mb-1"> <Building2 className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0"/> <h3 className="text-base font-semibold text-gray-900 truncate" title={dept.name}> {dept.name} </h3> </div>
                                            </div>
                                            {/* Action Buttons */}
                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                                {/* Assuming View/Edit link goes to detail page */}
                                                <Link to={`/departments/${dept.id}`} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={`View/Edit ${dept.name}`} > <Edit2 className="h-4 w-4" /> </Link>
                                                 {/* Delete Button (Enabled/Disabled) */}
                                                 <button
                                                     onClick={canDelete ? () => handleDelete(dept.id, dept.name) : () => { setPermissionError('Access Denied: Cannot delete.'); setTimeout(() => setPermissionError(''), 5000); }}
                                                     className={`p-1.5 rounded-lg transition-colors ${ canDelete ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed' }`}
                                                     title={canDelete ? `Delete ${dept.name}` : "Delete action restricted"}
                                                     disabled={!canDelete}
                                                 >
                                                     {canDelete ? <Trash2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                  </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Card Body */}
                                    <div className="p-5 flex-grow space-y-3 text-sm">
                                         {dept.location && ( <div className="flex items-center text-gray-600"> <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" /> <span title={`Location: ${dept.location}`}>{dept.location}</span> </div> )}
                                         <div className="flex items-center text-gray-600"> <UserCheck className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" /> {supervisorName ? ( <span title={`Supervisor: ${supervisorName}`}>{supervisorName}</span> ) : dept.supervisor != null ? ( <span className="italic text-gray-500" title={`Supervisor ID: ${dept.supervisor}`}> Loading... (ID: {dept.supervisor}) </span> ) : ( <span className="italic text-gray-400">No supervisor assigned</span> )} </div>
                                         {dept.description && ( <p className="text-gray-500 pt-1 line-clamp-3" title={dept.description}> {dept.description} </p> )}
                                         {!dept.description && <p className="text-gray-400 italic text-xs pt-1">No description provided.</p>}
                                    </div>
                                    {/* Card Footer */}
                                    {dept.updated_at && ( <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between border-t border-gray-200"> <div className="flex items-center"> <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/> <span>Updated</span> </div> <span className="font-medium">{formatDate(dept.updated_at)}</span> </div> )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State */
                    !loading && !error && !supervisorError && !permissionError && (
                         <div className="text-center py-12 mt-8 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                           <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                           <h3 className="mt-2 text-sm font-medium text-gray-900"> {searchTerm ? 'No departments match search' : (departments.length === 0 ? 'No departments found' : 'No departments available')} </h3>
                           <p className="mt-1 text-sm text-gray-500"> {searchTerm ? 'Adjust search terms.' : (departments.length === 0 ? 'Add a new department.' : 'Add departments.')} </p>
                           {/* Button in empty state also checks permission */}
                           {!searchTerm && departments.length === 0 && (
                               <div className="mt-6">
                                   {canAdd ? (
                                       <Link to="/departments/add" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                           <Plus className="-ml-1 mr-2 h-5 w-5" /> Add Department
                                       </Link>
                                   ) : (
                                       <button type="button" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-400 cursor-not-allowed" disabled title="Permission denied">
                                           <Plus className="-ml-1 mr-2 h-5 w-5" /> Add Department
                                       </button>
                                   )}
                               </div>
                           )}
                         </div>
                    )
                )}
            </div>
        </div>
    );
}

export default DepartmentsPage;