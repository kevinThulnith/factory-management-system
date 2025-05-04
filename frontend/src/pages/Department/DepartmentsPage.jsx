// src/pages/departments/DepartmentsPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your structure
import { listDepartments, deleteDepartment, getUserDetail } from '../../services/api'; // Ensure getUserDetail is exported
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react (similar to MachineListPage)
import {
    Building2, Plus, Trash2, Edit2, Search, MapPin, UserCheck, Clock, AlertTriangle,
    Info, CheckCircle, XCircle, Loader2, AlertCircle, User // Added User icon for fallback/loading state
} from 'lucide-react';

function DepartmentsPage() {
    // --- State ---
    const [departments, setDepartments] = useState([]);
    const [supervisorDetails, setSupervisorDetails] = useState({}); // { userId: { id, name, username,... }, ... }
    const [loading, setLoading] = useState(true); // Initial loading state
    const [error, setError] = useState(''); // Error for departments fetch/delete
    const [supervisorError, setSupervisorError] = useState(''); // Error for supervisor fetch
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Data Fetching (Departments & Supervisors) ---
    const fetchData = useCallback(async (isInitialLoad = false) => {
        // Set loading true only on initial mount when data is empty
        if (isInitialLoad && departments.length === 0 && Object.keys(supervisorDetails).length === 0) {
            setLoading(true);
        }
        // Clear errors before fetching
        setError('');
        // Don't clear supervisorError immediately, might persist from previous partial failures
        // setSupervisorError('');

        try {
            console.log("Fetching departments...");
            // 1. Fetch Departments
            const deptResponse = await listDepartments();
            const deptData = Array.isArray(deptResponse?.data) ? deptResponse.data : [];
            setDepartments(deptData);
            console.log("Departments fetched:", deptData.length);

            // 2. Extract unique, non-null supervisor IDs that need fetching
            const existingSupervisorIds = new Set(Object.keys(supervisorDetails).map(Number));
            const supervisorIdsToFetch = [
                ...new Set(
                    deptData
                        .map(dept => dept.supervisor) // Assuming the field is 'supervisor' containing the user ID
                        .filter(id => id != null && !existingSupervisorIds.has(id)) // Filter out nulls and already fetched
                )
            ];
            console.log("Supervisor IDs to fetch details for:", supervisorIdsToFetch);

            // 3. Fetch details for new supervisor IDs if any
            if (supervisorIdsToFetch.length > 0) {
                console.log(`Fetching details for ${supervisorIdsToFetch.length} new supervisors...`);
                // Use Promise.allSettled to allow partial success
                const supervisorPromises = supervisorIdsToFetch.map(id =>
                    getUserDetail(id).catch(err => {
                        console.warn(`Failed to fetch supervisor ID ${id}:`, err);
                        return { error: true, id }; // Return an error object to identify failures
                    })
                );
                const results = await Promise.allSettled(supervisorPromises);

                const newlyFetchedDetails = {};
                let supervisorFetchFailed = false;
                results.forEach(result => {
                    if (result.status === 'fulfilled') {
                        const data = result.value?.data; // API response might be nested in `data`
                        if (data && !data.error && data.id) {
                            newlyFetchedDetails[data.id] = data;
                        } else if (data?.error) {
                            // Handle errors returned from getUserDetail within a fulfilled promise (if caught)
                            supervisorFetchFailed = true;
                            console.warn(` getUserDetail promise fulfilled but contained error for ID ${data.id}`);
                        }
                    } else if (result.status === 'rejected') {
                        // Handle promises that were rejected (network error, etc.)
                        supervisorFetchFailed = true;
                         console.error(` Supervisor detail fetch rejected:`, result.reason);
                    }
                });

                // Merge new details with existing ones
                setSupervisorDetails(prevDetails => ({
                    ...prevDetails,
                    ...newlyFetchedDetails
                }));

                if (supervisorFetchFailed) {
                    setSupervisorError('Warning: Could not load details for all supervisors.');
                } else {
                     setSupervisorError(''); // Clear previous warning if all fetches succeeded this time
                }
                 console.log("Supervisor details updated:", Object.keys(newlyFetchedDetails).length, "new entries.");
            } else {
                 console.log("No *new* supervisor details to fetch.");
                 // If there were no *new* IDs, but a previous error existed, keep the error.
                 // If no new IDs and no previous error, ensure error is cleared.
                 // setSupervisorError(prev => prev ? prev : ''); // Keep existing error if present
            }

        } catch (err) {
            // Handle primary error from listDepartments
            console.error("Department fetch failed:", err);
            const msg = err?.response?.data?.detail || err?.message || 'Failed to load departments.';
            setError(err?.response?.status === 401 || err?.response?.status === 403 ? 'Authorization failed.' : msg);
            setDepartments([]); // Clear departments on error
            // Consider clearing supervisor details too if department list fails fundamentally
            // setSupervisorDetails({});
            // setSupervisorError('');
        } finally {
             setLoading(false); // Stop loading once all fetches are settled
        }
    // Only depend on auth state for re-triggering initial fetch logic, not details/counts
    }, [/* departments.length, Object.keys(supervisorDetails).length */]); // Keep dependencies minimal for useCallback stability

    // --- Supervisor ID -> Name Map ---
    const supervisorMap = useMemo(() => {
        const map = new Map();
        Object.values(supervisorDetails).forEach(user => {
            if (user && user.id) {
                 // Prioritize 'name', fallback to 'username', then construct an identifier
                 const displayName = user.name || user.username || `User ID ${user.id}`;
                map.set(user.id, displayName);
            }
        });
        return map;
    }, [supervisorDetails]); // Update map when supervisor details change

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return; // Stop if not authenticated
        }
        fetchData(true); // Fetch data on load/auth change, indicate it's initial
        // Removed setInterval for periodic refresh, implement if needed elsewhere (e.g., button)
    }, [isAuthenticated, navigate, fetchData]); // Dependencies

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        const departmentIdentifier = name || `Department ID ${id}`;
        if (!window.confirm(`Are you sure you want to delete "${departmentIdentifier}"? This action cannot be undone.`)) {
            return;
        }
        setError(''); // Clear previous errors
        setSupervisorError(''); // Also clear supervisor error on action

        try {
            console.log(`Deleting department ID: ${id}`);
            await deleteDepartment(id);
            console.log(`Department ${id} deleted successfully.`);
            // Optimistic UI update: Filter locally for responsiveness
            setDepartments(prevDepartments => prevDepartments.filter(d => d.id !== id));
            // Optional: Remove supervisor details if they are no longer referenced?
            // This might be complex if supervisors manage multiple departments.
            // A full refetch (fetchData()) might be safer if data consistency is critical,
            // but less responsive. Sticking with local filter for now.
            // Optional: Show success toast/message
        } catch (err) {
            console.error("Failed to delete department:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || 'Failed to delete department. It might be referenced elsewhere.';
            setError(errorMsg); // Display delete error
            // Optionally refetch data on error to ensure consistency
            // fetchData();
        }
    };

    // --- Filtering Logic ---
    const filteredDepartments = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return searchTerm
            ? departments.filter(dept => {
                // Get supervisor name from map using supervisor ID
                const supervisorName = dept.supervisor ? supervisorMap.get(dept.supervisor) : '';
                const supervisorIdString = dept.supervisor != null ? String(dept.supervisor) : '';

                return (
                    dept.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    dept.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    dept.location?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    supervisorIdString.includes(lowerCaseSearchTerm) || // Allow searching by ID
                    (supervisorName && supervisorName.toLowerCase().includes(lowerCaseSearchTerm)) // Search by resolved name
                );
            })
            : departments; // No search term, use all departments
    }, [departments, searchTerm, supervisorMap]); // Depend on supervisorMap

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

    // Display loading only on the very first load attempt
    if (loading && departments.length === 0 && Object.keys(supervisorDetails).length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="ml-3 text-gray-600">Loading data...</p>
            </div>
        );
    }

    // Determine if there are any departments left *after* filtering
    const hasFilteredDepartments = filteredDepartments.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header: Title, Search, Add Button */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Departments</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                         </div>
                         <input
                             type="text" name="search" id="search"
                             className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                             placeholder="Search departments..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                         />
                     </div>
                     {/* Add Department Button */}
                     {/* Ensure this link points to your correct department creation route */}
                     <Link to="/departments/add" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0">
                         <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Department
                     </Link>
                 </div>
             </div>

            {/* Error Display Area */}
             {error && (
                 <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm">
                     <div className="flex items-center">
                         <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                         <p className="text-sm text-red-700">{error}</p>
                     </div>
                 </div>
             )}
             {/* Display supervisor fetch error distinctly */}
             {supervisorError && (
                 <div className="mb-6 p-4 rounded-md bg-yellow-50 border border-yellow-200 shadow-sm">
                     <div className="flex items-center">
                         <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" />
                         <p className="text-sm text-yellow-700">{supervisorError}</p>
                      </div>
                 </div>
             )}

            {/* --- Departments Grid --- */}
            <div className="space-y-0"> {/* Remove space-y-10 if using grid */}
                {/* Check if there are departments *after filtering* before rendering grid */}
                {hasFilteredDepartments ? (
                     <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                        {filteredDepartments.map((dept) => {
                            // --- Get supervisor name using the map ---
                            const supervisorName = dept.supervisor ? supervisorMap.get(dept.supervisor) : null;
                            // --- ---

                            return (
                                <div key={dept.id}
                                    className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 transition-all duration-300 flex flex-col overflow-hidden">
                                    {/* Card Header */}
                                    <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center mb-1">
                                                    <Building2 className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0"/>
                                                    <h3 className="text-base font-semibold text-gray-900 truncate"
                                                        title={dept.name}>
                                                        {dept.name}
                                                    </h3>
                                                </div>
                                                {/* Optional: Display location in header if prominent */}
                                                {/* {dept.location && (
                                                    <p className="text-sm text-gray-600 truncate flex items-center">
                                                        <MapPin className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0" /> {dept.location}
                                                    </p>
                                                )} */}
                                            </div>
                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                                {/* Ensure this link points to your correct department edit route */}
                                                <Link
                                                    to={`/departments/${dept.id}`}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title={`Edit ${dept.name}`}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(dept.id, dept.name)}
                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title={`Delete ${dept.name}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-5 flex-grow space-y-3 text-sm">
                                        {/* Location */}
                                        {dept.location && (
                                            <div className="flex items-center text-gray-600">
                                                <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />
                                                <span title={`Location: ${dept.location}`}>{dept.location}</span>
                                            </div>
                                        )}

                                        {/* Supervisor */}
                                        <div className="flex items-center text-gray-600">
                                             <UserCheck className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />
                                            {supervisorName ? (
                                                // Name found
                                                <span title={`Supervisor: ${supervisorName}`}>{supervisorName}</span>
                                            ) : dept.supervisor != null ? (
                                                // ID exists but name not loaded/found (or fetch failed)
                                                <span className="italic text-gray-500" title={`Supervisor ID: ${dept.supervisor}`}>
                                                    Loading supervisor... (ID: {dept.supervisor})
                                                </span>
                                            ) : (
                                                // No supervisor assigned
                                                <span className="italic text-gray-400">No supervisor assigned</span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        {dept.description && (
                                            <p className="text-gray-500 pt-1 line-clamp-3" title={dept.description}>
                                                {dept.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Card Footer */}
                                    {dept.updated_at && (
                                        <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between border-t border-gray-200">
                                            <div className="flex items-center">
                                                <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>
                                                <span>Updated</span>
                                            </div>
                                            <span className="font-medium">{formatDate(dept.updated_at)}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State - Show if loading is done, no errors, but filtering resulted in zero departments */
                    !loading && !error && !supervisorError && (
                        <div className="text-center py-12 mt-8 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                            <Building2 className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                                {searchTerm ? 'No departments match your search' : (departments.length === 0 ? 'No departments found' : 'No departments available')}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search terms.' : (departments.length === 0 ? 'Get started by adding a new department.' : 'Check filter criteria or add departments.')}
                            </p>
                             {/* Show Add button only if no search term and original list was empty */}
                             {!searchTerm && departments.length === 0 && (
                                <div className="mt-6">
                                    {/* Ensure this link points to your correct department creation route */}
                                    <Link to="/departments/add" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" /> Add Department
                                    </Link>
                                </div>
                            )}
                        </div>
                    )
                )}
            </div> {/* End Grid or Empty State */}
        </div> /* End Page Container */
    );
}

export default DepartmentsPage;