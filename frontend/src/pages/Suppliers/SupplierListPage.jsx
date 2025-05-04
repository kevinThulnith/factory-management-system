// src/pages/suppliers/SupplierListPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your project structure
// Assuming dedicated API functions like listSuppliers, deleteSupplier exist
import { listSuppliers, deleteSupplier } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react
import {
    Truck, Mail, Phone, Link as LinkIcon, // Icons for supplier info
    Plus, Trash2, Edit2, Search, Loader2, ChevronsUpDown,
    AlertTriangle as AlertIcon // Renamed for clarity
} from 'lucide-react';

function SupplierListPage() {
    // --- State ---
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' }); // Default sort
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Data Fetching ---
    const fetchSuppliers = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad && suppliers.length === 0) { setLoading(true); }
        setError('');
        try {
            console.log("Fetching suppliers...");
            const response = await listSuppliers(); // Use dedicated function
            const data = Array.isArray(response?.data) ? response.data : [];
            setSuppliers(data);
            console.log("Suppliers fetched:", data.length);
        } catch (err) {
            console.error("Failed to fetch suppliers:", err.response || err);
            const msg = err.response?.data?.detail || err.message || 'Failed to load suppliers.';
            setError(err.response?.status === 401 || err.response?.status === 403 ? 'Authorization failed.' : msg);
            setSuppliers([]);
        } finally {
            setLoading(false);
        }
    }, []); // Removed dependency on suppliers.length

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchSuppliers(true); // Indicate initial load
    }, [isAuthenticated, navigate, fetchSuppliers]);

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        const identifier = name || `Supplier ID ${id}`;
        if (!window.confirm(`Are you sure you want to delete supplier "${identifier}"? Associated orders might be affected.`)) { return; }
        setError('');
        try {
            console.log(`Deleting supplier ID: ${id}`);
            await deleteSupplier(id); // Use dedicated function
            console.log(`Supplier ${id} deleted successfully.`);
            setSuppliers(prev => prev.filter(s => s.id !== id)); // Optimistic UI update
        } catch (err) {
            console.error("Failed to delete supplier:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || `Failed to delete "${identifier}". Check associations.`;
            setError(errorMsg);
        }
    };

    // --- Filtering Logic ---
    const filteredSuppliers = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        if (!searchTerm) return suppliers;
        return suppliers.filter(s =>
            s.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
            s.email?.toLowerCase().includes(lowerCaseSearchTerm) ||
            s.phone?.replace(/\D/g, '').includes(lowerCaseSearchTerm.replace(/\D/g, '')) || // Search phone numbers numerically
            s.website?.toLowerCase().includes(lowerCaseSearchTerm) ||
            s.contact_person?.toLowerCase().includes(lowerCaseSearchTerm) || // Assuming contact_person exists
            String(s.id).includes(lowerCaseSearchTerm)
        );
    }, [suppliers, searchTerm]);

    // --- Sorting Logic ---
    const sortedSuppliers = useMemo(() => {
        let sortableItems = [...filteredSuppliers];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                const aIsNull = aValue == null;
                const bIsNull = bValue == null;
                if (aIsNull && bIsNull) return 0;
                if (aIsNull) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (bIsNull) return sortConfig.direction === 'ascending' ? 1 : -1;

                 if (sortConfig.key === 'id') { // Numeric sort for ID
                    aValue = parseInt(aValue, 10) || 0;
                    bValue = parseInt(bValue, 10) || 0;
                    if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                 } else { // String sort for others
                    aValue = String(aValue).toLowerCase();
                    bValue = String(bValue).toLowerCase();
                    return aValue.localeCompare(bValue) * (sortConfig.direction === 'ascending' ? 1 : -1);
                 }
            });
        }
        return sortableItems;
    }, [filteredSuppliers, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) {
            return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400 inline-block opacity-50 group-hover:opacity-100 transition-opacity" />;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };


    // --- Render Logic ---
    if (loading && suppliers.length === 0) {
        return ( <div className="flex justify-center items-center h-screen "> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> <p className="ml-3 text-gray-600">Loading suppliers...</p> </div> );
    }

    const hasSuppliers = sortedSuppliers.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-">
            {/* Header */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Suppliers</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64"> <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"> <Search className="h-5 w-5 text-gray-400" /> </div> <input type="text" name="search" id="search" className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" placeholder="Search suppliers..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /> </div>
                     {/* Add Button */}
                     <Link to="/suppliers/add" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0"> <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Supplier </Link>
                 </div>
             </div>

            {/* Error Display */}
             {error && ( <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm"> <div className="flex items-center"> <AlertIcon className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" /> <p className="text-sm text-red-700">{error}</p> </div> </div> )}

            {/* --- Styled Table --- */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-gray-200">
                         <thead className="bg-gray-50">
                             <tr>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"> <button onClick={() => requestSort('id')} className="flex items-center bg-white hover:text-gray-700"> ID {getSortIndicator('id')} </button> </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"> <button onClick={() => requestSort('name')} className="flex items-center bg-white hover:text-gray-700"> Name {getSortIndicator('name')} </button> </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"> <button onClick={() => requestSort('email')} className="flex items-center bg-white hover:text-gray-700"> Email {getSortIndicator('email')} </button> </th>
                                 <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"> <button onClick={() => requestSort('phone')} className="flex items-center bg-white hover:text-gray-700"> Phone {getSortIndicator('phone')} </button> </th>
                                  {/* Optional: Add Contact Person / Website if needed */}
                                 {/* <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"> <button onClick={() => requestSort('contact_person')} className="flex items-center hover:text-gray-700"> Contact {getSortIndicator('contact_person')} </button> </th> */}
                                 {/* <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"> <button onClick={() => requestSort('website')} className="flex items-center hover:text-gray-700"> Website {getSortIndicator('website')} </button> </th> */}
                                 <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"> Actions </th>
                             </tr>
                         </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
                             {hasSuppliers ? (
                                sortedSuppliers.map((s) => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition-colors duration-150">
                                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{s.id}</td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 max-w-xs truncate" title={s.name}>
                                             {/* Optional Link to Detail Page */}
                                             {/* <Link to={`/suppliers/${s.id}`} className="hover:text-blue-600">{s.name}</Link> */}
                                              {s.name || 'N/A'}
                                         </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={s.email}>
                                             {s.email ? <a href={`mailto:${s.email}`} className="hover:text-blue-600">{s.email}</a> : <span className="italic text-xs">N/A</span>}
                                         </td>
                                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                             {s.phone || <span className="italic text-xs">N/A</span>}
                                         </td>
                                         {/* Optional Cells */}
                                         {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={s.contact_person}>{s.contact_person || <span className="italic text-xs">N/A</span>}</td> */}
                                         {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={s.website}>{s.website ? <a href={s.website.startsWith('http') ? s.website : `//${s.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600"><LinkIcon className="inline h-3 w-3 mr-1"/>Link</a> : <span className="italic text-xs">N/A</span>}</td> */}
                                         <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                             <Link to={`/suppliers/${s.id}`} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center p-1 hover:bg-indigo-100 rounded-md transition-colors" title={`Edit ${s.name || 'Supplier'}`}> <span className="sr-only">Edit</span> <Edit2 className="h-4 w-4" /> </Link>
                                             <button onClick={() => handleDelete(s.id, s.name)} className="text-red-600 hover:text-red-900 inline-flex items-center p-1 hover:bg-red-100 bg-white hover:border-white rounded-md transition-colors" title={`Delete ${s.name || 'Supplier'}`}> <span className="sr-only">Delete</span> <Trash2 className="h-4 w-4" /> </button>
                                         </td>
                                    </tr>
                                ))
                             ) : (
                                 <tr>
                                     {/* Adjust colSpan based on the number of visible columns */}
                                     <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-500">
                                        <Truck className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                                        {searchTerm ? 'No suppliers match your search.' : 'No suppliers found.'}
                                         {!searchTerm && suppliers.length === 0 && ( <p className="mt-2">Get started by <Link to="/suppliers/add" className="text-blue-600 hover:underline font-medium">adding a new supplier</Link>.</p> )}
                                         {searchTerm && suppliers.length > 0 && !hasSuppliers && ( <p className="mt-2">Try different search terms.</p> )}
                                     </td>
                                 </tr>
                              )}
                         </tbody>
                     </table>
                 </div>
                 {/* Optional: Pagination Controls */}
            </div>

        </div>
    );
}

export default SupplierListPage;