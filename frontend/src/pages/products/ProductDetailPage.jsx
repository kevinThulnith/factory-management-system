// src/pages/products/ProductDetailPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProductDetail, updateProduct, deleteProduct /*, listManufacturingProcesses */ } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, AlertTriangle, ArrowLeft, Edit, Trash2, Save, X, Package, FileText, Hash, ListChecks, Settings as ProcessIcon, Clock, Scale,HelpCircle,CheckCircle,Lock } from 'lucide-react';

// Copied from ProductListPage for consistency
const ProductStatusBadge = ({ status }) => { const lowerStatus = status?.toLowerCase() || 'unknown'; let bgColor = 'bg-gray-100'; let textColor = 'text-gray-800'; let Icon = HelpCircle; switch (lowerStatus) { case 'active': bgColor = 'bg-green-100'; textColor = 'text-green-800'; Icon = CheckCircle; break; case 'inactive': bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; Icon = XCircle; break; case 'discontinued': bgColor = 'bg-red-100'; textColor = 'text-red-800'; Icon = XCircle; break; default: break; } const capitalizedStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Unknown'; return ( <span title={`Status: ${capitalizedStatus}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor} whitespace-nowrap`}> <Icon aria-hidden="true" className={`h-3.5 w-3.5 mr-1.5 -ml-0.5 ${textColor}`} /> {capitalizedStatus} </span> );};


// Product Status Choices for Edit Form
const PRODUCT_STATUS_CHOICES = [ ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['DISCONTINUED', 'Discontinued'], ];
const formatDateTime = (dateTimeString) => { if (!dateTimeString) return 'N/A'; try { const date = new Date(dateTimeString); if (isNaN(date.getTime())) return 'Invalid Date'; return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { return 'Formatting Error'; } };


function ProductDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    const [product, setProduct] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', code: '', description: '', unit_of_measurement: '', status: 'ACTIVE', specifications: '{}' /*, manufacturing_processes: [] */ });
    // const [allProcesses, setAllProcesses] = useState([]); // For M2M field

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');

    const canManage = useMemo(() => { const userRole = user?.role?.toUpperCase(); return userRole === 'ADMIN' || userRole === 'MANAGER'; }, [user]);

    const fetchProductDetails = useCallback(async () => {
        setLoading(true); setError(''); setFormError(''); setProduct(null);
        try {
            const response = await getProductDetail(id);
            const prodData = response.data;
            setProduct(prodData);
            setEditData({
                name: prodData.name || '', code: prodData.code || '', description: prodData.description || '',
                unit_of_measurement: prodData.unit_of_measurement || '', status: prodData.status || 'ACTIVE',
                specifications: JSON.stringify(prodData.specifications || {}),
                // manufacturing_processes: prodData.manufacturing_processes?.map(p => p.id) || [] // Assuming API returns process objects, store IDs
            });

            // if (canManage) { // Fetch processes only if user can edit
            //     const processRes = await listManufacturingProcesses();
            //     setAllProcesses(Array.isArray(processRes?.data) ? processRes.data : []);
            // }

        } catch (err) {
            setError(err.response?.status === 404 ? 'Product not found.' : (err.response?.data?.detail || err.message || 'Failed to load product.'));
        } finally { setLoading(false); }
    }, [id /*, canManage */]); // Add canManage if listManufacturingProcesses depends on it

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        if (id) fetchProductDetails();
        else { setError("Product ID missing."); setLoading(false); }
    }, [id, isAuthenticated, navigate, fetchProductDetails]);

    const handleEditInputChange = (e) => { const { name, value } = e.target; setEditData(prev => ({ ...prev, [name]: value })); if (formError) setFormError(''); };


    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!canManage) { setFormError("Access Denied."); return; }
        setFormError('');
        let specsObject;
        try { specsObject = JSON.parse(editData.specifications || '{}'); }
        catch (parseError) { setFormError("Specifications JSON is invalid."); return; }
        if (!editData.name.trim() || !editData.code.trim()) { setFormError("Name and Code are required."); return; }

        setIsSaving(true);
        const payload = { ...editData, specifications: specsObject, description: editData.description.trim() || null, unit_of_measurement: editData.unit_of_measurement.trim() || null, };
        // For M2M, ensure payload.manufacturing_processes is an array of IDs
        // payload.manufacturing_processes = editData.manufacturing_processes || [];

        try {
            const response = await updateProduct(id, payload);
            setProduct(response.data);
            // Re-initialize editData to keep it in sync
            setEditData({
                name: response.data.name || '', code: response.data.code || '', description: response.data.description || '',
                unit_of_measurement: response.data.unit_of_measurement || '', status: response.data.status || 'ACTIVE',
                specifications: JSON.stringify(response.data.specifications || {}),
                // manufacturing_processes: response.data.manufacturing_processes?.map(p => p.id) || []
            });
            setIsEditing(false);
        } catch (err) {
            // ... (standard error parsing) ...
             const backendErrors = err.response?.data; if (typeof backendErrors === 'object' && backendErrors !== null) { const errorMessages = Object.entries(backendErrors).map(([field, messages]) => `${field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' \n'); setFormError(errorMessages || 'Update failed.'); } else { setFormError(backendErrors?.detail || err.message || 'An unknown error occurred.'); }
        } finally { setIsSaving(false); }
    };

    const handleCancelEdit = () => {
        setIsEditing(false); setFormError('');
        if (product) {
            setEditData({
                name: product.name || '', code: product.code || '', description: product.description || '',
                unit_of_measurement: product.unit_of_measurement || '', status: product.status || 'ACTIVE',
                specifications: JSON.stringify(product.specifications || {}),
                // manufacturing_processes: product.manufacturing_processes?.map(p => p.id) || []
            });
        }
    };

    const handleDelete = async () => {
        if (!canManage) { setFormError("Access Denied."); return; }
        const prodName = product?.name || `Product ID ${id}`;
        if (!window.confirm(`Delete "${prodName}"?`)) return;
        setIsDeleting(true); setError(''); setFormError('');
        try {
            await deleteProduct(id);
            navigate('/products');
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to delete product.');
        } finally { setIsDeleting(false); }
    };


    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
    if (error && !product) return <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border-red-200 rounded-lg text-center"><AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/><h3 className="text-lg font-medium text-red-800 mb-2">Error</h3><p className="text-red-700 mb-4 whitespace-pre-wrap">{error}</p><Link to="/products" className="btn-primary"><ArrowLeft className="h-4 w-4 mr-2"/>Back to List</Link></div>;
    if (!product) return null;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link to="/products" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group"><ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1"/>Back to Products</Link>
            <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b flex justify-between items-center flex-wrap gap-y-3">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center min-w-0 mr-4"><Package className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/><span className="truncate" title={isEditing ? 'Edit Product' : product.name}>{isEditing ? 'Edit Product' : (product.name || 'Product Details')}</span></h2>
                    {!isEditing && (
                        <div className="flex items-center space-x-3 flex-shrink-0">
                            <button onClick={() => { if (!canManage) { setFormError("Access Denied."); return; } setIsEditing(true); setFormError(''); }} className={`btn-secondary-sm ${!canManage && 'opacity-50 cursor-not-allowed'}`} disabled={isDeleting || !canManage} title={canManage ? "Edit" : "Restricted"}><Edit className="h-4 w-4 mr-1.5"/>Edit</button>
                            <button onClick={handleDelete} className={`btn-danger-sm ${!canManage && 'opacity-50 cursor-not-allowed'}`} disabled={isDeleting || !canManage} title={canManage ? "Delete" : "Restricted"}>{isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}{isDeleting ? '' : ''}</button>
                        </div>
                    )}
                </div>
                {/* Errors for view mode */}
                {error && !isEditing && <div className="border-b bg-red-50 px-6 py-3"><p className="text-sm text-red-700 flex items-center"><AlertTriangle className="h-4 w-4 mr-2"/>{error}</p></div>}

                <div className="p-6 md:p-8">
                    {!isEditing ? (
                        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                            <div className="md:col-span-1"><dt className="dt-style"><Package className="icon-style"/>Name</dt><dd className="dd-style text-base">{product.name || '-'}</dd></div>
                            <div className="md:col-span-1"><dt className="dt-style"><Hash className="icon-style"/>Code</dt><dd className="dd-style">{product.code || '-'}</dd></div>
                            <div className="md:col-span-1"><dt className="dt-style"><Scale className="icon-style"/>Unit</dt><dd className="dd-style">{product.unit_of_measurement || <span className="italic">N/A</span>}</dd></div>
                            <div className="md:col-span-1"><dt className="dt-style"><ListChecks className="icon-style"/>Status</dt><dd className="dd-style"><ProductStatusBadge status={product.status}/></dd></div>
                            <div className="md:col-span-2"><dt className="dt-style"><FileText className="icon-style"/>Description</dt><dd className="dd-style whitespace-pre-wrap">{product.description || <span className="italic">No description.</span>}</dd></div>
                            <div className="md:col-span-2"><dt className="dt-style"><ProcessIcon className="icon-style"/>Specifications</dt><dd className="dd-style font-mono text-xs bg-gray-50 p-2 rounded overflow-x-auto">{product.specifications ? JSON.stringify(product.specifications, null, 2) : <span className="italic">None</span>}</dd></div>
                            {/* Display Manufacturing Processes if available and fetched */}
                            {/* {product.manufacturing_processes && product.manufacturing_processes.length > 0 && (
                                <div className="md:col-span-2"><dt className="dt-style"><ProcessIcon className="icon-style"/>Processes</dt><dd className="dd-style">{product.manufacturing_processes.map(p => p.name || `ID: ${p.id}`).join(', ')}</dd></div>
                            )} */}
                            <div className="md:col-span-2 border-t pt-4 mt-2"><dt className="dt-style-xs"><Clock className="icon-style-xs"/>Last Updated</dt><dd className="dd-style-xs">{formatDateTime(product.updated_at)}</dd></div>
                        </dl>
                    ) : (
                        <form onSubmit={handleUpdate} className="space-y-6">
                             {formError && <div className="p-3 rounded-md bg-red-50 border-red-200"><p className="text-sm text-red-700 flex items-start whitespace-pre-wrap"><AlertTriangle className="h-5 w-5 mr-2 mt-0.5"/>{formError}</p></div>}
                            {/* Re-use form fields from ProductFormPage, binding to editData and handleEditInputChange */}
                            <div><label htmlFor="edit-prod-name" className="label-style">Name <span className="text-red-500">*</span></label><input type="text" id="edit-prod-name" name="name" value={editData.name} onChange={handleEditInputChange} required disabled={isSaving} className="input-style"/></div>
                            <div><label htmlFor="edit-prod-code" className="label-style">Code <span className="text-red-500">*</span></label><input type="text" id="edit-prod-code" name="code" value={editData.code} onChange={handleEditInputChange} required disabled={isSaving} className="input-style"/></div>
                            <div><label htmlFor="edit-prod-unit" className="label-style">Unit of Measurement</label><input type="text" id="edit-prod-unit" name="unit_of_measurement" value={editData.unit_of_measurement} onChange={handleEditInputChange} disabled={isSaving} className="input-style"/></div>
                            <div><label htmlFor="edit-prod-status" className="label-style">Status <span className="text-red-500">*</span></label><select id="edit-prod-status" name="status" value={editData.status} onChange={handleEditInputChange} required disabled={isSaving} className="input-style bg-white">{PRODUCT_STATUS_CHOICES.map(([val, lab]) => <option key={val} value={val}>{lab}</option>)}</select></div>
                            <div><label htmlFor="edit-prod-specs" className="label-style">Specifications (JSON)</label><textarea id="edit-prod-specs" name="specifications" rows="4" value={editData.specifications} onChange={handleEditInputChange} disabled={isSaving} className="input-style font-mono text-xs"></textarea></div>
                            <div><label htmlFor="edit-prod-desc" className="label-style">Description</label><textarea id="edit-prod-desc" name="description" rows="3" value={editData.description} onChange={handleEditInputChange} disabled={isSaving} className="input-style"></textarea></div>
                            {/* M2M Field for Edit if implemented
                            <div><label htmlFor="edit-prod-processes" className="label-style">Manufacturing Processes</label>
                                <select multiple id="edit-prod-processes" name="manufacturing_processes" value={editData.manufacturing_processes} onChange={handleEditInputChange} disabled={isSaving} className="input-style h-32">
                                    {allProcesses.map(proc => <option key={proc.id} value={proc.id}>{proc.name}</option>)}
                                </select>
                            </div>
                            */}
                            <div className="flex justify-end space-x-3 pt-5 border-t mt-8"><button type="button" onClick={handleCancelEdit} className="btn-secondary" disabled={isSaving}><X className="h-4 w-4 mr-1.5"/>Cancel</button><button type="submit" className="btn-primary" disabled={isSaving}>{isSaving ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin"/>Saving...</> : <><Save className="h-4 w-4 mr-1.5"/>Save Changes</>}</button></div>
                        </form>
                    )}
                </div>
            </div>
            {/* Define utility classes if not already global */}
            <style jsx global>{`
                .dt-style { font-weight: 600; color: #4b5563; /* gray-600 */ margin-bottom: 0.125rem; display: flex; align-items: center; }
                .dd-style { color: #1f2937; /* gray-800 */ }
                .dt-style-xs { font-weight: 500; font-size: 0.75rem; line-height: 1rem; color: #6b7280; /* gray-500 */ text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; }
                .dd-style-xs { margin-top: 0.25rem; color: #374151; /* gray-700 */ font-size: 0.75rem; line-height: 1rem; }
                .icon-style { height: 1rem; width: 1rem; margin-right: 0.375rem; color: #9ca3af; /* gray-400 */ flex-shrink: 0; }
                .icon-style-xs { height: 0.875rem; width: 0.875rem; margin-right: 0.375rem; color: #9ca3af; /* gray-400 */ }
                .label-style { display: block; font-size: 0.875rem; line-height: 1.25rem; font-weight: 500; color: #374151; /* gray-700 */ margin-bottom: 0.25rem; display: flex; align-items: center; }
                .input-style { display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; color: #1f2937; background-color: #f9fafb; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
                .input-style:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 0.2rem rgba(59, 130, 246, 0.25); }
                .input-style:disabled { background-color: #f3f4f6; cursor: not-allowed; }
                .btn-primary { display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: #2563eb; color: white; font-weight: 500; font-size: 0.875rem; border-radius: 0.375rem; border: 1px solid transparent; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
                .btn-primary:hover { background-color: #1d4ed8; } .btn-primary:disabled { background-color: #9ca3af; cursor: not-allowed; }
                .btn-secondary { display: inline-flex; align-items: center; padding: 0.5rem 1rem; background-color: white; color: #374151; font-weight: 500; font-size: 0.875rem; border-radius: 0.375rem; border: 1px solid #d1d5db; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
                .btn-secondary:hover { background-color: #f3f4f6; } .btn-secondary:disabled { opacity:0.5; cursor:not-allowed; }
                .btn-secondary-sm { /* ... similar to btn-secondary but smaller padding ... */ padding: 0.375rem 0.75rem; font-size: 0.75rem; line-height: 1rem; }
                .btn-danger-sm { /* ... for delete button ... */ display: inline-flex; align-items: center; padding: 0.375rem 0.75rem; background-color: #dc2626; /* red-600 */ color: white; font-weight: 500; font-size: 0.75rem; line-height: 1rem; border-radius: 0.375rem; border: 1px solid transparent; }
                .btn-danger-sm:hover { background-color: #b91c1c; /* red-700 */ } .btn-danger-sm:disabled { background-color: #fca5a5; /* red-300 */ cursor:not-allowed; }

            `}</style>
        </div>
    );
}

export default ProductDetailPage;