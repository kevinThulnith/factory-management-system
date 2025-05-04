// src/pages/workshops/WorkshopListPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your project structure
import { listWorkshops, deleteWorkshop, listDepartments, getUserDetail } from '../../services/api'; // Added listDepartments, getUserDetail
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react
import {
    Building, Briefcase, UserCheck, Activity, Plus, Trash2, Edit2, Search,
    AlertTriangle, Loader2, CheckCircle, AlertCircle, Info, HelpCircle, Wrench // Added more status icons
} from 'lucide-react';

// --- Status Badge Component (Adapted from MachineListPage/DetailPage) ---
const StatusBadge = ({ status }) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    let bgColor = 'bg-gray-100'; let textColor = 'text-gray-800'; let Icon = HelpCircle;

    switch (lowerStatus) {
        case 'active': case 'operational': // Common statuses for operational
            bgColor = 'bg-green-100'; textColor = 'text-green-800'; Icon = CheckCircle; break;
        case 'inactive': case 'idle': // Common statuses for inactive/idle
             bgColor = 'bg-sky-100'; textColor = 'text-sky-800'; Icon = Info; break;
        case 'under maintenance': case 'maintenance':
             bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; Icon = Wrench; break;
        // Add other specific statuses if needed
        default: /* Keep defaults */ break;
    }
     // Simple capitalization, replace underscores if necessary
     const capitalizedStatus = status ? status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : 'Unknown';

    return (
        <span title={`Status: ${capitalizedStatus}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} whitespace-nowrap`}>
            <Icon aria-hidden="true" className={`h-3.5 w-3.5 mr-1.5 -ml-0.5 ${textColor}`} />
            {capitalizedStatus}
        </span>
    );
};
// --- End Status Badge ---

function WorkshopListPage() {
    // --- State ---
    const [workshops, setWorkshops] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [managers, setManagers] = useState({}); // Store manager details: { managerId: { id, name, username,... } }
    const [loading, setLoading] = useState(true); // Initial loading state
    const [error, setError] = useState(''); // Error for workshops fetch/delete
    const [relatedError, setRelatedError] = useState(''); // Errors for departments/managers fetch
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Data Fetching (Workshops, Departments, Managers) ---
    const fetchData = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad && workshops.length === 0) { setLoading(true); }
        setError(''); setRelatedError(''); // Clear errors before fetch

        try {
            console.log("Fetching workshops, departments...");
            // Fetch workshops and departments concurrently
            const results = await Promise.allSettled([
                listWorkshops(),
                listDepartments()
            ]);

            let fetchedWorkshops = [];
            let fetchedDepts = [];
            let fetchErrors = [];

            // Process Workshops
            if (results[0].status === 'fulfilled') {
                fetchedWorkshops = Array.isArray(results[0].value?.data) ? results[0].value.data : [];
                setWorkshops(fetchedWorkshops);
                console.log("Workshops fetched:", fetchedWorkshops.length);
            } else {
                console.error("Workshop fetch failed:", results[0].reason);
                fetchErrors.push('Failed to load workshops.');
                setWorkshops([]); // Clear on error
            }

            // Process Departments
            if (results[1].status === 'fulfilled') {
                fetchedDepts = Array.isArray(results[1].value?.data) ? results[1].value.data : [];
                setDepartments(fetchedDepts);
                console.log("Departments fetched:", fetchedDepts.length);
            } else {
                console.error("Department fetch failed:", results[1].reason);
                fetchErrors.push('Failed to load departments.');
                setDepartments([]); // Clear on error
            }

            // --- Fetch Managers (similar to fetching Supervisors in DepartmentsPage) ---
            if (fetchedWorkshops.length > 0) {
                const existingManagerIds = new Set(Object.keys(managers).map(Number));
                const managerIdsToFetch = [
                    ...new Set(
                        fetchedWorkshops
                            .map(ws => ws.manager) // Assuming field is 'manager' with user ID
                            .filter(id => id != null && !existingManagerIds.has(id))
                    )
                ];

                if (managerIdsToFetch.length > 0) {
                    console.log(`Fetching details for ${managerIdsToFetch.length} new managers...`);
                    const managerPromises = managerIdsToFetch.map(id =>
                        getUserDetail(id).catch(err => ({ error: true, id, reason: err }))
                    );
                    const managerResults = await Promise.allSettled(managerPromises);

                    const newlyFetchedManagers = {};
                    let managerFetchFailed = false;
                    managerResults.forEach(result => {
                        if (result.status === 'fulfilled' && result.value?.data && !result.value.error) {
                            newlyFetchedManagers[result.value.data.id] = result.value.data;
                        } else {
                            managerFetchFailed = true;
                            const failedId = result.value?.id || result.reason?.id || 'unknown';
                            console.warn(`Failed to fetch manager details for ID ${failedId}:`, result.value?.reason || result.reason);
                        }
                    });

                    setManagers(prev => ({ ...prev, ...newlyFetchedManagers }));
                    if (managerFetchFailed) {
                        fetchErrors.push('Could not load all manager details.');
                    }
                    console.log("Managers fetched/updated:", Object.keys(newlyFetchedManagers).length, "new entries.");
                } else {
                    console.log("No new manager details to fetch.");
                }
            }
            // --- End Fetch Managers ---

            // Set combined errors
            if (fetchErrors.length > 0) {
                 // If primary workshop fetch failed, set main error, otherwise related error
                 if (results[0].status === 'rejected') {
                    setError(fetchErrors.join(' '));
                 } else {
                    setRelatedError(fetchErrors.join(' '));
                 }
            }

        } catch (err) {
            console.error("Unexpected error during data fetching setup:", err);
            setError("An unexpected error occurred while preparing to load data.");
            setWorkshops([]); setDepartments([]); setManagers({}); // Clear all on major error
        } finally {
             setLoading(false);
        }
    }, [managers]); // Depend on managers to know which IDs are already fetched

    // --- Helper Maps ---
    const departmentMap = useMemo(() => {
        const map = new Map();
        departments.forEach(dept => map.set(dept.id, dept.name || `Dept ${dept.id}`));
        return map;
    }, [departments]);

    const managerMap = useMemo(() => {
        const map = new Map();
        Object.values(managers).forEach(user => {
             if (user && user.id) {
                map.set(user.id, user.name || user.username || `User ${user.id}`);
             }
        });
        return map;
    }, [managers]);

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchData(true); // Indicate initial load
        // Removed setInterval for consistency
    }, [isAuthenticated, navigate, fetchData]);

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        const identifier = name || `Workshop ID ${id}`;
        if (!window.confirm(`Are you sure you want to delete "${identifier}"? This may affect associated machines.`)) { return; }
        setError(''); setRelatedError(''); // Clear errors on action
        try {
            console.log(`Deleting workshop ID: ${id}`);
            await deleteWorkshop(id);
            console.log(`Workshop ${id} deleted successfully.`);
            // Optimistic UI update
            setWorkshops(prev => prev.filter(ws => ws.id !== id));
            // Consider if manager/dept maps need cleanup (usually not necessary unless IDs are reused quickly)
        } catch (err) {
            console.error("Failed to delete workshop:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || `Failed to delete "${identifier}". Check associations.`;
            setError(errorMsg);
        }
    };

    // --- Filtering Logic ---
    const filteredWorkshops = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return searchTerm
            ? workshops.filter(ws => {
                const deptName = departmentMap.get(ws.department)?.toLowerCase() || '';
                const managerName = managerMap.get(ws.manager)?.toLowerCase() || '';
                const status = ws.operational_status?.toLowerCase() || '';
                const managerIdString = ws.manager != null ? String(ws.manager) : '';
                const deptIdString = ws.department != null ? String(ws.department) : '';


                return (
                    ws.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    deptName.includes(lowerCaseSearchTerm) ||
                    managerName.includes(lowerCaseSearchTerm) ||
                    status.includes(lowerCaseSearchTerm) ||
                    managerIdString.includes(lowerCaseSearchTerm) || // Search by ID too
                    deptIdString.includes(lowerCaseSearchTerm)
                );
            })
            : workshops;
    }, [workshops, searchTerm, departmentMap, managerMap]);

    // --- Render Logic ---

    if (loading && workshops.length === 0) { // Show loader only on absolute first load
        return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <p className="ml-3 text-gray-600">Loading workshops...</p> </div> );
    }

    const hasFilteredWorkshops = filteredWorkshops.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header: Title, Search, Add Button */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Workshops</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Search className="h-5 w-5 text-gray-400" aria-hidden="true" /> </div>
                         <input type="text" name="search" id="search" className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search workshops..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                     {/* Add Button */}
                     <Link to="/workshops/add" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0">
                         <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Workshop
                     </Link>
                 </div>
             </div>

            {/* Error Display Area */}
             {error && ( <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm"> <div className="flex items-center"> <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" /> <p className="text-sm text-red-700">{error}</p> </div> </div> )}
             {relatedError && ( <div className="mb-6 p-4 rounded-md bg-yellow-50 border border-yellow-200 shadow-sm"> <div className="flex items-center"> <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" /> <p className="text-sm text-yellow-700">{relatedError}</p> </div> </div> )}

            {/* --- Workshops Grid --- */}
            <div className="space-y-0">
                {hasFilteredWorkshops ? (
                     <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                        {filteredWorkshops.map((ws) => {
                            const deptName = departmentMap.get(ws.department) || `Dept ID: ${ws.department || 'N/A'}`;
                            const managerName = managerMap.get(ws.manager) || (ws.manager ? `User ID: ${ws.manager}` : 'N/A');

                            return (
                                <div key={ws.id} className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 transition-all duration-300 flex flex-col overflow-hidden">
                                    {/* Card Header */}
                                    <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                                        <div className="flex items-start justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center mb-1">
                                                    <Building className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0"/>
                                                    <h3 className="text-base font-semibold text-gray-900 truncate" title={ws.name}> {ws.name || 'Unnamed Workshop'} </h3>
                                                </div>
                                                {/* Optional sub-header info like Department */}
                                                 <p className="text-sm text-gray-600 truncate flex items-center" title={`Department: ${deptName}`}>
                                                      <Briefcase className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0"/>
                                                      {deptName}
                                                  </p>
                                            </div>
                                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                                <Link to={`/workshops/${ws.id}`} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={`Edit ${ws.name || 'Workshop'}`}> <Edit2 className="h-4 w-4" /> </Link>
                                                <button onClick={() => handleDelete(ws.id, ws.name)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={`Delete ${ws.name || 'Workshop'}`}> <Trash2 className="h-4 w-4" /> </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Card Body */}
                                    <div className="p-5 flex-grow space-y-3 text-sm">
                                        <div className="flex items-center justify-between">
                                             {/* Status Badge */}
                                             <StatusBadge status={ws.operational_status} />
                                             {/* Manager Info */}
                                             <div className="flex items-center text-gray-600" title={`Manager: ${managerName}`}>
                                                 <UserCheck className="h-4 w-4 mr-1.5 flex-shrink-0 text-gray-400" />
                                                 <span className="truncate">
                                                    {managerName === 'N/A' ? <i className="text-gray-400">No manager</i> : managerName}
                                                    {!managerMap.has(ws.manager) && ws.manager && relatedError.includes('manager') && <span className="text-xs text-red-500 ml-1">(?)</span>}
                                                 </span>
                                             </div>
                                        </div>
                                        {/* Optional: Add other details like # of machines etc. if available */}
                                    </div>
                                    {/* Card Footer (Optional) */}
                                     {/* {ws.updated_at && (<div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 border-t border-gray-200"> Updated: {formatDateTime(ws.updated_at)} </div>)} */}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* Empty State */
                    !loading && !error && !relatedError && (
                        <div className="text-center py-12 mt-8 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                            <Building className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                                {searchTerm ? 'No workshops match your search' : (workshops.length === 0 ? 'No workshops found' : 'No workshops available')}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search terms.' : (workshops.length === 0 ? 'Get started by adding a new workshop.' : 'Check filters or add workshops.')}
                            </p>
                             {!searchTerm && workshops.length === 0 && (
                                <div className="mt-6">
                                    <Link to="/workshops/add" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" /> Add Workshop
                                    </Link>
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

export default WorkshopListPage;