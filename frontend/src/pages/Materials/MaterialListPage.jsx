// src/pages/materials/MaterialListPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your project structure
// Make sure these API functions exist and use the correct endpoints
import { listMaterials, deleteMaterial } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react
import {
    Box, Scale, AlertTriangle as AlertIcon,
    PackageCheck, PackageX, PackageMinus , PackageSearch,
    Plus, Trash2, Edit2, Search, Loader2, ChevronsUpDown,
    Info
} from 'lucide-react';

// --- Stock Level Indicator Component ---
const StockLevelIndicator = ({ quantity, reorderLevel }) => {
    // Attempt to parse values, defaulting to NaN if parsing fails or input is invalid
    const qty = !isNaN(parseFloat(quantity)) ? parseFloat(quantity) : NaN;
    const reorder = !isNaN(parseFloat(reorderLevel)) ? parseFloat(reorderLevel) : NaN;

    let Icon = PackageCheck; // Default: OK
    let colorClass = 'text-green-600';
    let text = 'In Stock';
    let bgColorClass = 'bg-green-100';

    if (isNaN(qty) || isNaN(reorder)) {
        Icon = PackageSearch; // Unknown if values are invalid numbers
        colorClass = 'text-gray-500';
        text = 'Unknown';
        bgColorClass = 'bg-gray-100';
    } else if (qty <= 0) {
        Icon = PackageX; // Out of Stock
        colorClass = 'text-red-700';
        text = 'Out of Stock';
        bgColorClass = 'bg-red-100';
    } else if (qty <= reorder) {
        Icon = PackageMinus; // Low Stock
        colorClass = 'text-yellow-700';
        text = 'Low Stock';
        bgColorClass = 'bg-yellow-100';
    }
    // Else: In Stock (defaults)

    return (
        <span title={`Qty: ${isNaN(qty)?'?':qty}, Reorder: ${isNaN(reorder)?'?':reorder}`}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColorClass} ${colorClass} whitespace-nowrap`}>
            <Icon aria-hidden="true" className={`h-3.5 w-3.5 mr-1.5 -ml-0.5 ${colorClass}`} />
            {text}
        </span>
    );
};
// --- End Stock Level Indicator ---


function MaterialListPage() {
    // --- State ---
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' }); // Default sort by name
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Data Fetching ---
    const fetchMaterials = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad && materials.length === 0) { setLoading(true); }
        setError(''); // Clear error before fetching

        try {
            console.log("Fetching materials...");
            const response = await listMaterials(); // Assumes listMaterials uses '/material/'
            const data = Array.isArray(response?.data) ? response.data : [];
            setMaterials(data);
            console.log("Materials fetched:", data.length);
        } catch (err) {
            console.error("Failed to fetch materials:", err.response || err);
            const msg = err.response?.data?.detail || err.message || 'Failed to load materials.';
            setError(err.response?.status === 401 || err.response?.status === 403 ? 'Authorization failed.' : msg);
            setMaterials([]); // Clear data on error
        } finally {
            setLoading(false);
        }
    // Prevent infinite loop if materials.length changes frequently during load
    }, []); // Removed materials.length dependency, rely on isInitialLoad flag

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchMaterials(true); // Indicate initial load
    }, [isAuthenticated, navigate, fetchMaterials]); // fetchMaterials is stable due to useCallback

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        const identifier = name || `Material ID ${id}`;
        // Use a more specific confirmation message
        if (!window.confirm(`Are you sure you want to delete the material "${identifier}"? This action cannot be undone.`)) { return; }
        setError('');
        try {
            console.log(`Deleting material ID: ${id}`);
            await deleteMaterial(id); // Assumes deleteMaterial uses '/material/<id>/'
            console.log(`Material ${id} deleted successfully.`);
            // Optimistic UI update
            setMaterials(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error("Failed to delete material:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || `Failed to delete "${identifier}". Check associations or try again.`;
            setError(errorMsg);
        }
    };


    // --- Filtering Logic ---
    const filteredMaterials = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        if (!searchTerm) {
             return materials; // Return all if no search term
        }
        return materials.filter(m =>
            m.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
            m.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
            m.unit_of_measurement?.toLowerCase().includes(lowerCaseSearchTerm) ||
            String(m.id).includes(lowerCaseSearchTerm) ||
            String(m.quantity).includes(lowerCaseSearchTerm)
        );
    }, [materials, searchTerm]);


    // --- Sorting Logic ---
    const sortedMaterials = useMemo(() => {
        let sortableItems = [...filteredMaterials]; // Create a mutable copy
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Handle potential null/undefined values consistently
                const aIsNull = aValue == null;
                const bIsNull = bValue == null;
                if (aIsNull && bIsNull) return 0; // Both null, equal
                if (aIsNull) return sortConfig.direction === 'ascending' ? -1 : 1; // Nulls first ascending, last descending
                if (bIsNull) return sortConfig.direction === 'ascending' ? 1 : -1; // Nulls first ascending, last descending

                 // Numeric sort for specific keys
                 if (['quantity', 'reorder_level', 'id'].includes(sortConfig.key)) {
                    aValue = parseFloat(aValue); // No need for `|| 0` if nulls handled above
                    bValue = parseFloat(bValue);
                    // Handle potential NaN after parseFloat
                    const aIsNaN = isNaN(aValue);
                    const bIsNaN = isNaN(bValue);
                    if (aIsNaN && bIsNaN) return 0;
                    if (aIsNaN) return 1; // Place NaN last
                    if (bIsNaN) return -1; // Place NaN last

                    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                 }
                 // String sort for others
                 else {
                    aValue = String(aValue).toLowerCase();
                    bValue = String(bValue).toLowerCase();
                    return aValue.localeCompare(bValue) * (sortConfig.direction === 'ascending' ? 1 : -1);
                 }
            });
        }
        return sortableItems;
    }, [filteredMaterials, sortConfig]);

    // Function to request sorting on a column
    const requestSort = (key) => {
        let direction = 'ascending';
        // If clicking the same key, toggle direction
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        // Otherwise, default to ascending for the new key
        setSortConfig({ key, direction });
    };

    // Helper to get sorting icon/indicator for table headers
    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) {
            // Subtle indicator for non-active sort columns
            return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400 inline-block opacity-50 group-hover:opacity-100 transition-opacity" />;
        }
        // Clear indicators for the active sort column
        return sortConfig.direction === 'ascending'
            ? <span className="ml-1">▲</span> // Up arrow for ascending
            : <span className="ml-1">▼</span>; // Down arrow for descending
    };


    // --- Render Logic ---

    // Loading state display
    if (loading && materials.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                 <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                 <p className="ml-3 text-gray-600">Loading materials...</p>
            </div>
        );
    }

    const hasMaterials = sortedMaterials.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header Section */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Materials / Inventory</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                         </div>
                         <input
                             type="text"
                             name="search"
                             id="search"
                             className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                             placeholder="Search materials..."
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                     {/* Add Material Button */}
                     <Link
                         to="/materials/add"
                         className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0">
                         <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Material
                     </Link>
                 </div>
             </div>

            {/* Error Display Area */}
             {error && (
                 <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm">
                     <div className="flex items-center">
                         <AlertIcon className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                         <p className="text-sm text-red-700">{error}</p>
                     </div>
                 </div>
             )}

            {/* --- Styled Table Container --- */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto"> {/* Enable horizontal scroll on small screens */}
                     <table className="min-w-full divide-y divide-gray-200">
                         {/* Table Header */}
                         <thead className="bg-gray-50">
                             <tr>
                                 {/* Table Headers with Sorting Buttons */}
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group">
                                     <button onClick={() => requestSort('id')} className="flex items-center bg-white hover:text-gray-700">
                                         ID {getSortIndicator('id')}
                                     </button>
                                 </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group">
                                      <button onClick={() => requestSort('name')} className="flex items-center bg-white hover:text-gray-700">
                                        Name {getSortIndicator('name')}
                                      </button>
                                  </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group">
                                      <button onClick={() => requestSort('quantity')} className="flex items-center bg-white hover:text-gray-700">
                                        Quantity {getSortIndicator('quantity')}
                                      </button>
                                  </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group">
                                      <button onClick={() => requestSort('unit_of_measurement')} className="flex items-center bg-white hover:text-gray-700">
                                        Unit {getSortIndicator('unit_of_measurement')}
                                      </button>
                                  </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group">
                                      <button onClick={() => requestSort('reorder_level')} className="flex items-center bg-white hover:text-gray-700">
                                        Reorder Lvl {getSortIndicator('reorder_level')}
                                      </button>
                                  </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Stock Status
                                  </th>
                                 <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Actions
                                  </th>
                             </tr>
                         </thead>
                         {/* Table Body */}
                         <tbody className="bg-white divide-y divide-gray-200">
                             {hasMaterials ? (
                                sortedMaterials.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50 transition-colors duration-150">
                                         {/* Table Data Cells */}
                                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{m.id}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 max-w-xs truncate" title={m.name}>
                                             {/* Optional Link to Detail Page */}
                                             {/* <Link to={`/materials/${m.id}`} className="hover:text-blue-600">{m.name}</Link> */}
                                             {m.name || 'N/A'}
                                         </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700 font-bold text-center">{m.quantity ?? '?'}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.unit_of_measurement || <span className="italic text-xs">N/A</span>}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{m.reorder_level ?? <span className="italic text-xs">N/A</span>}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                             <StockLevelIndicator quantity={m.quantity} reorderLevel={m.reorder_level} />
                                         </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                             {/* Action Buttons */}
                                             <Link
                                                 to={`/materials/${m.id}`}
                                                 className="text-indigo-600 hover:text-indigo-900 inline-flex items-center p-1 hover:bg-indigo-100 rounded-md transition-colors"
                                                 title={`Edit ${m.name || 'Material'}`}>
                                                 <span className="sr-only">Edit</span> {/* Screen reader text */}
                                                 <Edit2 className="h-4 w-4" />
                                             </Link>
                                             <button
                                                 onClick={() => handleDelete(m.id, m.name)}
                                                 className="text-red-600 hover:text-red-900 inline-flex items-center p-1 hover:bg-red-100 bg-white hover:border-white rounded-md transition-colors"
                                                 title={`Delete ${m.name || 'Material'}`}>
                                                  <span className="sr-only">Delete</span> {/* Screen reader text */}
                                                  <Trash2 className="h-4 w-4" />
                                              </button>
                                         </td>
                                    </tr>
                                ))
                             ) : (
                                 // Empty Table Row State
                                 <tr>
                                     <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                                        <Box className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                                        {searchTerm ? 'No materials match your search.' : 'No materials found.'}
                                         {!searchTerm && materials.length === 0 && (
                                            <p className="mt-2">Get started by <Link to="/materials/add" className="text-blue-600 hover:underline font-medium">adding a new material</Link>.</p>
                                         )}
                                         {searchTerm && materials.length > 0 && !hasMaterials && ( // Case where filtering yields no results but data exists
                                             <p className="mt-2">Try different search terms.</p>
                                         )}
                                     </td>
                                 </tr>
                              )}
                         </tbody>
                     </table>
                 </div>
                 {/* Optional: Add Pagination Controls Footer Here */}
                 {/* <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 sm:px-6"> Pagination... </div> */}
            </div>

        </div>
    );
}

export default MaterialListPage;