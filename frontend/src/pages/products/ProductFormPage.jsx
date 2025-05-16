// src/pages/products/ProductFormPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getProductDetail, createProduct, updateProduct } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, Save, X, ArrowLeft, Package, FileText, Hash, ListChecks, Settings as ProcessIcon,
    Scale
} from 'lucide-react';

// Product Status Choices from your model
const PRODUCT_STATUS_CHOICES = [
    ['ACTIVE', 'Active'],
    ['INACTIVE', 'Inactive'],
    ['DISCONTINUED', 'Discontinued'],
];

function ProductFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        unit_of_measurement: '',
        status: 'ACTIVE',
        specifications: '{}',
    });

    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState('');

    const canManage = useMemo(() => {
        const userRole = user?.role?.toUpperCase();
        return userRole === 'ADMIN' || userRole === 'MANAGER';
    }, [user]);

    const fetchProductData = useCallback(async () => {
        let isMounted = true;
        if (!isAuthenticated) { if(isMounted) navigate('/login'); return; }

        if (!isEditing && !canManage) {
             if(isMounted) {
                setError("Access Denied: You do not have permission to create products.");
                setDataLoading(false);
             }
             return;
        }
         if (isEditing && !canManage) {
            if(isMounted) {
                setError("Access Denied: You do not have permission to edit this product.");
                setDataLoading(false);
            }
            return;
         }

        if (!isEditing) { if(isMounted) setDataLoading(false); return; }

        setDataLoading(true); setError('');
        try {
            const response = await getProductDetail(id);
            if (!isMounted) return;
            const productData = response.data;
            setFormData({
                name: productData.name || '',
                code: productData.code || '',
                description: productData.description || '',
                unit_of_measurement: productData.unit_of_measurement || '',
                status: productData.status || 'ACTIVE',
                specifications: JSON.stringify(productData.specifications || {}),
            });
        } catch (err) {
            if (!isMounted) return;
            setError(err.response?.data?.detail || err.message || 'Failed to load product data.');
        } finally {
            if (isMounted) setDataLoading(false);
        }
        return () => { isMounted = false; };
    }, [id, isEditing, isAuthenticated, navigate, canManage]);

    useEffect(() => {
        const cleanup = fetchProductData();
        // Ensure cleanup function from fetchProductData is returned if it's async and has one
        if (typeof cleanup === 'function') {
             return cleanup;
        }
    }, [fetchProductData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canManage) { setError("Access Denied: Cannot save product."); return; }
        setLoading(true); setError('');

        let specsObject;
        try {
            specsObject = JSON.parse(formData.specifications || '{}');
        } catch (parseError) {
            setError("Specifications JSON is invalid."); setLoading(false); return;
        }
        if (!formData.name.trim()) { setError("Product name is required."); setLoading(false); return; }
        if (!formData.code.trim()) { setError("Product code is required."); setLoading(false); return; }

        const payload = {
            ...formData,
            specifications: specsObject,
            description: formData.description.trim() || null,
            unit_of_measurement: formData.unit_of_measurement.trim() || null,
        };

        try {
            if (isEditing) await updateProduct(id, payload);
            else await createProduct(payload);
            navigate('/products');
        } catch (err) {
            const backendErrors = err.response?.data;
            if (typeof backendErrors === 'object' && backendErrors !== null) { const errorMessages = Object.entries(backendErrors).map(([field, messages]) => `${field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' \n'); setError(errorMessages || 'Save failed.'); }
            else { setError(backendErrors?.detail || err.message || 'An unknown error occurred.'); }
        } finally {
            setLoading(false);
        }
    };

    // Render loading or access denied before attempting to render the form
    if (dataLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3">Loading...</p></div>;
    if (!canManage) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link to="/products" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group"><ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform"/>Back to Products</Link>
                <div className="m-8 p-6 text-center text-red-700 bg-red-50 border border-red-200 rounded-lg shadow-md">
                    <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4"/>
                    <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
                    <p>{error || "You do not have permission to perform this action."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link to="/products" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group"><ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform"/>Back to Products</Link>
            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b"><h2 className="text-xl font-semibold text-gray-800 flex items-center"><Package className="h-6 w-6 mr-2.5 text-blue-600"/>{isEditing ? 'Edit Product' : 'Add New Product'}</h2></div>
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    {error && <div className="p-3 rounded-md bg-red-50 border-red-200"><p className="text-sm text-red-700 flex items-start whitespace-pre-wrap"><AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0"/>{error}</p></div>}
                    
                    <div>
                        <label htmlFor="prod-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <Package className="h-4 w-4 mr-1.5 text-gray-400"/>Name <span className="text-red-500 ml-1">*</span>
                        </label>
                        {/* Apply the .input-style class from your global CSS */}
                        <input type="text" id="prod-name" name="name" value={formData.name} onChange={handleChange} required disabled={loading} className="input-style" placeholder="Product Name"/>
                    </div>
                    <div>
                        <label htmlFor="prod-code" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <Hash className="h-4 w-4 mr-1.5 text-gray-400"/>Code <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input type="text" id="prod-code" name="code" value={formData.code} onChange={handleChange} required disabled={loading} className="input-style" placeholder="Unique Product Code"/>
                    </div>
                    <div>
                        <label htmlFor="prod-unit" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <Scale className="h-4 w-4 mr-1.5 text-gray-400"/>Unit of Measurement
                        </label>
                        <input type="text" id="prod-unit" name="unit_of_measurement" value={formData.unit_of_measurement} onChange={handleChange} disabled={loading} className="input-style" placeholder="e.g., piece, kg, liter"/>
                    </div>
                    <div>
                        <label htmlFor="prod-status" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <ListChecks className="h-4 w-4 mr-1.5 text-gray-400"/>Status <span className="text-red-500 ml-1">*</span>
                        </label>
                        {/* Add bg-white to select to ensure it's not transparent if input-style doesn't cover it */}
                        <select id="prod-status" name="status" value={formData.status} onChange={handleChange} required disabled={loading} className="input-style bg-white">
                            {PRODUCT_STATUS_CHOICES.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="prod-specs" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <ProcessIcon className="h-4 w-4 mr-1.5 text-gray-400"/>Specifications (JSON)
                        </label>
                        <textarea id="prod-specs" name="specifications" rows="4" value={formData.specifications} onChange={handleChange} disabled={loading} className="input-style font-mono text-xs" placeholder='e.g., {"color": "red", "size": "L"}'></textarea>
                        <p className="text-xs text-gray-500 mt-1">Enter as valid JSON object.</p>
                    </div>
                    <div>
                        <label htmlFor="prod-desc" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                            <FileText className="h-4 w-4 mr-1.5 text-gray-400"/>Description
                        </label>
                        <textarea id="prod-desc" name="description" rows="3" value={formData.description} onChange={handleChange} disabled={loading} className="input-style" placeholder="Optional product description"></textarea>
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t mt-8">
                        <Link to="/products" type="button" className="btn-secondary" aria-disabled={loading}><X className="h-4 w-4 mr-1.5"/>Cancel</Link>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>Saving...</> : <><Save className="h-4 w-4 mr-1.5"/>{isEditing ? 'Update Product' : 'Create Product'}</>}
                        </button>
                    </div>
                </form>
            </div>
            {/* The <style jsx global> block has been removed. Ensure these styles are in your global CSS. */}
        </div>
    );
}

export default ProductFormPage;