// src/pages/machines/MachineListPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your project structure
// Ensure these API functions are correctly implemented in your services file
import { listMachines, deleteMachine, listWorkshops } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react
import {
    Wrench, Cog, Plus, Trash2, Edit2, Search, MapPin, User, Clock, AlertTriangle,
    Info, CheckCircle, XCircle, Loader2, Building, PauseCircle, AlertCircle
} from 'lucide-react';

// --- Constants ---
const UNASSIGNED_WORKSHOP_KEY = 'UNASSIGNED';

function MachineListPage() {
    // --- State ---
    const [machines, setMachines] = useState([]);
    const [workshops, setWorkshops] = useState([]);
    const [loading, setLoading] = useState(true); // Initial loading state
    const [error, setError] = useState(''); // Error for machines fetch/delete
    const [workshopError, setWorkshopError] = useState(''); // Error for workshop fetch
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Data Fetching (Machines & Workshops) ---
    const fetchData = useCallback(async () => {
        // Set loading true only on initial mount when data is empty
        if (machines.length === 0 && workshops.length === 0) {
            setLoading(true);
        }
        // Clear errors before fetching
        setError('');
        setWorkshopError('');

        try {
            console.log("Fetching machines and workshops...");
            // Use Promise.allSettled to handle potential failures in one fetch without stopping the other
            const results = await Promise.allSettled([
                listMachines(),
                listWorkshops()
            ]);

            const machineResult = results[0];
            const workshopResult = results[1];

            // Process machine data
            if (machineResult.status === 'fulfilled') {
                const machineData = Array.isArray(machineResult.value?.data) ? machineResult.value.data : [];
                setMachines(machineData);
                console.log("Machines fetched:", machineData.length);
            } else {
                console.error("Machine fetch failed:", machineResult.reason);
                const err = machineResult.reason;
                const msg = err?.response?.data?.detail || err?.message || 'Failed to load machines.';
                setError(err?.response?.status === 401 || err?.response?.status === 403 ? 'Authorization failed.' : msg);
                setMachines([]); // Clear machines on error
            }

            // Process workshop data
            if (workshopResult.status === 'fulfilled') {
                const workshopData = Array.isArray(workshopResult.value?.data) ? workshopResult.value.data : [];
                setWorkshops(workshopData);
                console.log("Workshops fetched:", workshopData.length);
            } else {
                console.error("Workshop fetch failed:", workshopResult.reason);
                const err = workshopResult.reason;
                const msg = err?.response?.data?.detail || err?.message || 'Failed to load workshops.';
                setWorkshopError(err?.response?.status === 401 || err?.response?.status === 403 ? 'Authorization failed.' : msg);
                setWorkshops([]); // Clear workshops on error
            }

        } catch (err) {
            // Catch unexpected errors (less likely with Promise.allSettled)
            console.error("Unexpected error during data fetching setup:", err);
            setError("An unexpected error occurred while preparing to load data.");
        } finally {
             setLoading(false); // Stop loading once all fetches are settled
        }
    }, [machines.length, workshops.length]); // Dependencies for initial load check

    // --- Workshop ID -> Name Map ---
    const workshopMap = useMemo(() => {
        const map = new Map();
        workshops.forEach(ws => {
            map.set(ws.id, ws.name || `Workshop ${ws.id}`); // Use name, fallback to ID string
        });
        return map;
    }, [workshops]); // Update map when workshops data changes

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return; // Stop if not authenticated
        }
        fetchData(); // Fetch data on load/auth change
    }, [isAuthenticated, navigate, fetchData]); // Dependencies

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        const machineIdentifier = name || `Machine ID ${id}`;
        if (!window.confirm(`Are you sure you want to delete "${machineIdentifier}"? This action cannot be undone.`)) {
            return;
        }
        setError(''); // Clear previous errors
        setWorkshopError(''); // Also clear workshop error on action
        try {
            console.log(`Deleting machine ID: ${id}`);
            await deleteMachine(id);
            console.log(`Machine ${id} deleted successfully.`);
            // Instead of full refetch, filter locally for responsiveness
            setMachines(prevMachines => prevMachines.filter(m => m.id !== id));
            // Optional: Show success toast/message
        } catch (err) {
            console.error("Failed to delete machine:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || 'Failed to delete machine. It might be referenced elsewhere.';
            setError(errorMsg); // Display delete error
        }
    };

    // --- Filtering Logic (Applied before grouping) ---
    const filteredMachines = useMemo(() => {
        // Ensure map is ready before filtering if searching by name relies on it
        if (searchTerm && workshopMap.size === 0 && workshops.length > 0) {
             // If searching but map isn't ready, maybe wait or filter without name?
             // For simplicity, let's filter anyway, name search might just miss initially.
        }

        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        // Filter the *original* machines list
        const baseFiltered = searchTerm
            ? machines.filter(m => {
                const workshopIdString = m.workshop != null ? String(m.workshop) : '';
                const operatorIdString = m.operator != null ? String(m.operator) : '';
                const workshopName = workshopMap.get(m.workshop) || '';

                return (
                    m.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    m.model_number?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    m.status?.toLowerCase().includes(lowerCaseSearchTerm) ||
                    workshopIdString.includes(lowerCaseSearchTerm) ||
                    operatorIdString.includes(lowerCaseSearchTerm) ||
                    workshopName.toLowerCase().includes(lowerCaseSearchTerm)
                    // TODO: Add operator name search when available
                );
            })
            : machines; // No search term, use all machines

        return baseFiltered;

    }, [machines, searchTerm, workshops, workshopMap]); // Depend on workshops because workshopMap depends on it

    // --- Grouping Logic (Groups the FILTERED machines) ---
    const groupedByWorkshop = useMemo(() => {
        console.log("[DEBUG] Grouping filtered machines...");
        return filteredMachines.reduce((acc, machine) => {
            const workshopId = machine.workshop;
            // Use the ID as key, or a constant for unassigned
            const key = workshopId != null ? workshopId : UNASSIGNED_WORKSHOP_KEY;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(machine);
            return acc;
        }, {});
    }, [filteredMachines]);

    // --- Sort Workshop Group Keys ---
    const sortedWorkshopKeys = useMemo(() => {
        const keys = Object.keys(groupedByWorkshop);
        keys.sort((a, b) => {
            if (a === UNASSIGNED_WORKSHOP_KEY) return 1; // Unassigned always last
            if (b === UNASSIGNED_WORKSHOP_KEY) return -1;
            // Sort by workshop name from the map (ensure keys are numbers for lookup)
            const nameA = workshopMap.get(parseInt(a, 10)) || `Workshop ID ${a}`; // Fallback name
            const nameB = workshopMap.get(parseInt(b, 10)) || `Workshop ID ${b}`; // Fallback name
            return nameA.localeCompare(nameB); // Alphabetical sort
        });
        // console.log("[DEBUG] Sorted workshop keys:", keys);
        return keys;
    }, [groupedByWorkshop, workshopMap]); // Depend on grouped data and the map

    // --- Status Badge Helper ---
    const getStatusBadge = (status) => {
        const lowerStatus = status?.toLowerCase() || 'unknown';
        let bgColor = 'bg-gray-100'; let textColor = 'text-gray-800'; let Icon = Info;

        switch (lowerStatus) {
            case 'operational': case 'running': case 'active':
                bgColor = 'bg-green-100'; textColor = 'text-green-800'; Icon = CheckCircle; break;
            case 'idle':
                bgColor = 'bg-sky-100'; textColor = 'text-sky-800'; Icon = PauseCircle; break;
            case 'under maintenance': case 'maintenance':
                bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; Icon = Wrench; break;
            case 'broke down': case 'stopped': case 'inactive':
                bgColor = 'bg-red-100'; textColor = 'text-red-800'; Icon = AlertCircle; break;
            default: /* Keep defaults */ break;
        }
        const capitalizedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown';
        return (
            <span title={`Status: ${capitalizedStatus}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} whitespace-nowrap`}>
                <Icon aria-hidden="true" className={`h-3.5 w-3.5 mr-1.5 -ml-0.5 ${textColor}`} />
                {capitalizedStatus}
            </span>
        );
    };

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
    if (loading && machines.length === 0 && workshops.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="ml-3 text-gray-600">Loading data...</p>
            </div>
        );
    }

    // Determine if there are any machines left *after* filtering
    const hasFilteredMachines = filteredMachines.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header: Title, Search, Add Button */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Machines</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                         </div>
                         <input
                             type="text" name="search" id="search"
                             className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                             placeholder="Search machines..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                         />
                     </div>
                     {/* Add Machine Button */}
                     <Link to="/machines/add" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0">
                         <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Machine
                     </Link>
                 </div>
             </div>

            {/* Error Display Area */}
             {error && (
                 <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm">
                     <div className="flex items-center"> <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" /> <p className="text-sm text-red-700">{error}</p> </div>
                 </div>
             )}
             {workshopError && (
                 <div className="mb-6 p-4 rounded-md bg-yellow-50 border border-yellow-200 shadow-sm">
                     <div className="flex items-center"> <AlertTriangle className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0" /> <p className="text-sm text-yellow-700">{workshopError}</p> </div>
                 </div>
             )}

            {/* --- Machines Grouped by Workshop --- */}
            <div className="space-y-10">
                {/* Check if there are machines *after filtering* before rendering groups */}
                {hasFilteredMachines ? (
                    sortedWorkshopKeys.map((workshopKey) => {
                        const machinesInGroup = groupedByWorkshop[workshopKey];
                         // Check if this specific group actually has machines (it should, because of filtering first)
                         if (!machinesInGroup || machinesInGroup.length === 0) {
                            return null; // Don't render header for empty groups after filtering
                         }

                        const currentWorkshopName = workshopKey === UNASSIGNED_WORKSHOP_KEY
                            ? 'Unassigned Machines'
                            : workshopMap.get(parseInt(workshopKey, 10)) || `Workshop ID: ${workshopKey}`;

                        return (
                            <div key={workshopKey}>
                                {/* Workshop Section Header */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Building className="h-6 w-6 text-blue-600"/>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">
                                                {currentWorkshopName}
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {machinesInGroup.length} machine{machinesInGroup.length !== 1 ? 's' : ''} available
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Machines Grid */}
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 mb-12">
                                    {machinesInGroup.map((m) => {
                                        const workshopNameForCard = workshopMap.get(m.workshop);

                                        return (
                                            <div key={m.id} 
                                                className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 transition-all duration-300 flex flex-col overflow-hidden">
                                                {/* Card Header */}
                                                <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                                                    <div className="flex items-start justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center mb-1">
                                                                <Cog className="h-5 w-5 text-blue-600 mr-2"/>
                                                                <h3 className="text-base font-semibold text-gray-900 truncate" 
                                                                    title={m.name}>
                                                                    {m.name}
                                                                </h3>
                                                            </div>
                                                            {m.model_number && (
                                                                <p className="text-sm text-gray-600 truncate" 
                                                                   title={`Model: ${m.model_number}`}>
                                                                    {m.model_number}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                            <Link 
                                                                to={`/machines/${m.id}`}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title={`Edit ${m.name}`}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Link>
                                                            <button 
                                                                onClick={() => handleDelete(m.id, m.name)}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title={`Delete ${m.name}`}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-5 flex-grow space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        {getStatusBadge(m.status)}
                                                        <div className="flex items-center text-gray-600 text-sm">
                                                            <User className="h-4 w-4 mr-2 text-gray-400" />
                                                            <span title={m.operator ? `Operator ID: ${m.operator}` : 'No operator assigned'}>
                                                                {m.operator != null ? (
                                                                    `ID: ${m.operator}`
                                                                ) : (
                                                                    <span className="italic text-gray-400">Unassigned</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Footer */}
                                                {m.updated_at && (
                                                    <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between border-t border-gray-200">
                                                        <div className="flex items-center">
                                                            <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>
                                                            <span>Updated</span>
                                                        </div>
                                                        <span className="font-medium">{formatDate(m.updated_at)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    /* Empty State - Show if loading is done, no errors, but filtering resulted in zero machines */
                    !loading && !error && !workshopError && (
                        <div className="text-center py-12 mt-8 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                            <Wrench className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                                {searchTerm ? 'No machines match your search' : (machines.length === 0 ? 'No machines found' : 'No machines available')}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search terms.' : (machines.length === 0 ? 'Get started by adding a new machine.' : 'Check filter criteria or add machines.')}
                            </p>
                             {/* Show Add button only if no search term and original list was empty */}
                             {!searchTerm && machines.length === 0 && (
                                <div className="mt-6">
                                    <Link to="/machines/add" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" /> Add Machine
                                    </Link>
                                </div>
                            )}
                        </div>
                    )
                )}
            </div> {/* End Grouped Content */}
        </div> /* End Page Container */
    );
}

export default MachineListPage;