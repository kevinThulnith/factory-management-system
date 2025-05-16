// src/pages/products/ProductListPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listProducts, deleteProduct } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Package, Plus, Trash2, Edit2, Search, Loader2, ChevronsUpDown,
    AlertTriangle as AlertIcon, CheckCircle, XCircle, HelpCircle // Added status icons
} from 'lucide-react';

// --- Status Badge for Product (Example) ---
const ProductStatusBadge = ({ status }) => {
    const lowerStatus = status?.toLowerCase() || 'unknown';
    let bgColor = 'bg-gray-100'; let textColor = 'text-gray-800'; let Icon = HelpCircle; // Assuming HelpCircle exists or use a default
    switch (lowerStatus) {
        case 'active': bgColor = 'bg-green-100'; textColor = 'text-green-800'; Icon = CheckCircle; break;
        case 'inactive': bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; Icon = XCircle; break;
        case 'discontinued': bgColor = 'bg-red-100'; textColor = 'text-red-800'; Icon = XCircle; break;
        default: break;
    }
    const capitalizedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown';
    return ( <span title={`Status: ${capitalizedStatus}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} whitespace-nowrap`}> <Icon aria-hidden="true" className={`h-3.5 w-3.5 mr-1.5 -ml-0.5 ${textColor}`} /> {capitalizedStatus} </span> );
};


function ProductListPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth(); // Assuming user object has role

    // --- Permissions (Example: Admin/Manager can delete) ---
    const canManage = useMemo(() => {
        const userRole = user?.role?.toUpperCase();
        return userRole === 'ADMIN' || userRole === 'MANAGER';
    }, [user]);

    // --- Data Fetching ---
    const fetchProducts = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad && products.length === 0) setLoading(true);
        setError('');
        try {
            const response = await listProducts();
            setProducts(Array.isArray(response?.data) ? response.data : []);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to load products.');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []); // products.length removed for stability

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchProducts(true);
    }, [isAuthenticated, navigate, fetchProducts]);

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        if (!canManage) { setError("Access Denied: Cannot delete products."); return; }
        const identifier = name || `Product ID ${id}`;
        if (!window.confirm(`Delete "${identifier}"?`)) return;
        setError('');
        try {
            await deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            setError(err.response?.data?.detail || err.message || `Failed to delete "${identifier}".`);
        }
    };

    // --- Filtering & Sorting (similar to other list pages) ---
    const filteredProducts = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        if (!searchTerm) return products;
        return products.filter(p =>
            p.name?.toLowerCase().includes(lower) ||
            p.code?.toLowerCase().includes(lower) ||
            p.status?.toLowerCase().includes(lower) ||
            String(p.id).includes(lower)
        );
    }, [products, searchTerm]);

    const sortedProducts = useMemo(() => {
        let sortableItems = [...filteredProducts];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                // Basic sort logic, adapt for numbers/dates if needed
                let valA = a[sortConfig.key] || '';
                let valB = b[sortConfig.key] || '';
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredProducts, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return <ChevronsUpDown className="h-3 w-3 ml-1 text-gray-400 opacity-50 group-hover:opacity-100" />;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    if (loading && products.length === 0) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3">Loading products...</p></div>;

    const hasProducts = sortedProducts.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Products</h1>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center space-x-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                        <input type="text" placeholder="Search products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                    </div>
                    {canManage && ( // Only show Add button if user has permission
                        <Link to="/products/add" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Product
                        </Link>
                    )}
                </div>
            </div>

            {error && <div className="mb-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-md flex items-center"><AlertIcon className="h-5 w-5 mr-2" />{error}</div>}

            {/* Styled Table */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"><button onClick={() => requestSort('id')} className="flex items-center">ID {getSortIndicator('id')}</button></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"><button onClick={() => requestSort('name')} className="flex items-center">Name {getSortIndicator('name')}</button></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"><button onClick={() => requestSort('code')} className="flex items-center">Code {getSortIndicator('code')}</button></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group"><button onClick={() => requestSort('unit_of_measurement')} className="flex items-center">Unit {getSortIndicator('unit_of_measurement')}</button></th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {hasProducts ? sortedProducts.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 max-w-xs truncate" title={p.name}>
                                        <Link to={`/products/${p.id}`} className="hover:text-blue-600">{p.name}</Link>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.code || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.unit_of_measurement || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <ProductStatusBadge status={p.status} />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <Link to={`/products/${p.id}`} className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded-md" title="View/Edit"><Edit2 className="h-4 w-4" /></Link>
                                        {canManage && (
                                            <button onClick={() => handleDelete(p.id, p.name)} className="text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded-md" title="Delete"><Trash2 className="h-4 w-4" /></button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500"><Package className="mx-auto h-10 w-10 text-gray-400 mb-2" />{searchTerm ? 'No products match.' : 'No products found.'}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ProductListPage;