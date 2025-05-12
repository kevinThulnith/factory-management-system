// src/pages/materials/MaterialDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Adjust imports for your API service functions
// Assuming functions like getMaterialDetail, updateMaterial, deleteMaterial exist
import { getMaterialDetail, updateMaterial, deleteMaterial } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, ArrowLeft, Edit, Trash2, Save, X, Info, CheckCircle, AlertCircle,
    Box, // For Material Name
    Scale, // For Unit
    FileText, // For Description
    Hash, // For Quantity
    Repeat, // For Reorder Level
    Clock, // For Timestamps
    HelpCircle, // For N/A
    PackageCheck, PackageX, PackageMinus, PackageSearch // For Stock Status
} from 'lucide-react';

// --- Stock Level Indicator Component (Copied from MaterialListPage) ---
const StockLevelIndicator = ({ quantity, reorderLevel }) => {
    const qty = !isNaN(parseFloat(quantity)) ? parseFloat(quantity) : NaN;
    const reorder = !isNaN(parseFloat(reorderLevel)) ? parseFloat(reorderLevel) : NaN;
    let Icon = PackageCheck; let colorClass = 'text-green-600'; let text = 'In Stock'; let bgColorClass = 'bg-green-100';

    if (isNaN(qty) || isNaN(reorder)) { Icon = PackageSearch; colorClass = 'text-gray-500'; text = 'Unknown'; bgColorClass = 'bg-gray-100'; }
    else if (qty <= 0) { Icon = PackageX; colorClass = 'text-red-700'; text = 'Out of Stock'; bgColorClass = 'bg-red-100'; }
    else if (qty <= reorder) { Icon = PackageMinus; colorClass = 'text-yellow-700'; text = 'Low Stock'; bgColorClass = 'bg-yellow-100'; }

    return ( <span title={`Qty: ${isNaN(qty)?'?':qty}, Reorder: ${isNaN(reorder)?'?':reorder}`} className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${bgColorClass} ${colorClass} whitespace-nowrap`}> <Icon aria-hidden="true" className={`h-4 w-4 mr-1.5 ${colorClass}`} /> {text} </span> );
};


// --- Helper to format Date and Time (Copied from MachineDetailPage) ---
const formatDateTime = (dateTimeString) => { if (!dateTimeString) return 'N/A'; try { const date = new Date(dateTimeString); if (isNaN(date.getTime())) return 'Invalid Date'; return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { return 'Formatting Error'; } };


function MaterialDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- State ---
    const [material, setMaterial] = useState(null); // View Data
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', description: '', unit_of_measurement: '', quantity: '0.00', reorder_level: '0.00' }); // Edit Data
    const [loading, setLoading] = useState(true); // Initial page load
    const [isSaving, setIsSaving] = useState(false); // Save operation
    const [isDeleting, setIsDeleting] = useState(false); // Delete operation
    const [error, setError] = useState(''); // Primary load/delete error
    const [formError, setFormError] = useState(''); // Edit form error

    // --- Fetch Initial Data ---
    const fetchMaterialDetails = useCallback(async () => {
        setLoading(true); setError(''); setFormError('');
        setMaterial(null); // Clear previous data

        try {
            console.log(`Fetching material details for ID: ${id}`);
            const response = await getMaterialDetail(id); // Use dedicated function
            const materialData = response.data;
            setMaterial(materialData);
            console.log("Material data fetched:", materialData);

            // Initialize Edit Data *after* fetching
            setEditData({
                name: materialData.name || '',
                description: materialData.description || '',
                unit_of_measurement: materialData.unit_of_measurement || '',
                // Format numbers for controlled input
                quantity: parseFloat(materialData.quantity ?? 0).toFixed(2),
                reorder_level: parseFloat(materialData.reorder_level ?? 0).toFixed(2),
            });
            console.log("Initialized editData");

        } catch (err) {
            console.error("Failed to fetch material:", err.response || err);
            const errorMsg = err.response?.status === 404
                ? 'Material not found.'
                : (err.response?.data?.detail || err.message || 'Failed to load material details.');
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // --- Effects ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        if (id) { fetchMaterialDetails(); }
        else { setError("Material ID is missing."); setLoading(false); }
    }, [id, isAuthenticated, navigate, fetchMaterialDetails]);

    // --- Handlers ---
     const handleEditInputChange = (e) => {
         const { name, value } = e.target;
         setEditData(prev => ({ ...prev, [name]: value }));
         if (formError) setFormError(''); // Clear form error on input
     };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setFormError('');

        // Client-side Validation
        if (!editData.name.trim()) { setFormError('Material name is required.'); return; }
        if (!editData.unit_of_measurement.trim()) { setFormError('Unit of Measurement is required.'); return; }
        const quantityNum = parseFloat(editData.quantity);
        const reorderLevelNum = parseFloat(editData.reorder_level);
        if (isNaN(quantityNum) || quantityNum < 0) { setFormError("Quantity must be a valid non-negative number."); return; }
        if (isNaN(reorderLevelNum) || reorderLevelNum < 0) { setFormError("Reorder Level must be a valid non-negative number."); return; }

        setIsSaving(true);
        const payload = {
            name: editData.name.trim(),
            description: editData.description.trim() || null,
            unit_of_measurement: editData.unit_of_measurement.trim(),
            quantity: quantityNum, // Send as number
            reorder_level: reorderLevelNum, // Send as number
        };

        console.log("[DEBUG] Updating material with payload:", payload);

        try {
            const response = await updateMaterial(id, payload); // Use dedicated function
            setMaterial(response.data); // Update view state
            // Re-initialize editData to match the newly saved data
             setEditData({
                name: response.data.name || '',
                description: response.data.description || '',
                unit_of_measurement: response.data.unit_of_measurement || '',
                quantity: parseFloat(response.data.quantity ?? 0).toFixed(2),
                reorder_level: parseFloat(response.data.reorder_level ?? 0).toFixed(2),
            });
            setIsEditing(false); // Exit edit mode
        } catch (err) {
             console.error("Failed to update material:", err.response || err);
             // Parse and set formError
             const backendErrors = err.response?.data;
             if (typeof backendErrors === 'object' && backendErrors !== null) {
                 const errorMessages = Object.entries(backendErrors).map(([field, messages]) => `${field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' \n');
                 setFormError(errorMessages || 'Update failed. Check fields.');
             } else { setFormError(backendErrors?.detail || err.message || 'An unknown error occurred during update.'); }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setFormError('');
        // Reset editData to match current view state
        if (material) {
            setEditData({
                name: material.name || '',
                description: material.description || '',
                unit_of_measurement: material.unit_of_measurement || '',
                quantity: parseFloat(material.quantity ?? 0).toFixed(2),
                reorder_level: parseFloat(material.reorder_level ?? 0).toFixed(2),
            });
        }
    };

    const handleDelete = async () => {
        const materialName = material?.name || `Material ID ${id}`;
        if (window.confirm(`Are you sure you want to delete "${materialName}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            setError(''); setFormError(''); // Clear errors
            try {
                await deleteMaterial(id); // Use dedicated function
                navigate('/materials'); // Go back to list
            } catch (err) {
                console.error("Failed to delete material:", err.response || err);
                let errorMsg = err.response?.data?.detail || 'Failed to delete material.';
                setError(errorMsg); // Set general error
                setIsDeleting(false);
            }
        }
    };

    // --- Render Logic ---

    if (loading) { return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> </div> ); }
    if (error && !material) { return ( <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center"> <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/> <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Material</h3> <p className="text-red-700 mb-4 whitespace-pre-wrap">{error}</p> <Link to="/materials" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to Materials List </Link> </div> ); }
    if (!material) return null; // Should be caught by error state

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             <Link to="/materials" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Materials
             </Link>

             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                  {/* Card Header */}
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-y-3">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center min-w-0 mr-4">
                          <Box className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/>
                          <span className="truncate" title={isEditing ? 'Edit Material' : material.name}>
                              {isEditing ? 'Edit Material' : material.name}
                          </span>
                     </h2>
                      {!isEditing && (
                          <div className="flex items-center space-x-3 flex-shrink-0">
                             {/* Edit Button */}
                             <button onClick={() => setIsEditing(true)} className="inline-flex items-center px-3.5 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isDeleting} > <Edit className="h-4 w-4 mr-1.5 -ml-0.5" /> Edit </button>
                             {/* Delete Button */}
                             <button onClick={handleDelete} className="inline-flex items-center px-3.5 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isDeleting} > {isDeleting ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Trash2 className="h-4 w-4 mr-1.5 -ml-0.5" />} {isDeleting ? 'Deleting...' : 'Delete'} </button>
                          </div>
                      )}
                  </div>

                 {/* General Error Display (for Delete or Load errors if material is present) */}
                 {error && material && ( <div className="border-b border-red-200 bg-red-50 px-6 py-3"> <p className="text-sm text-red-700 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {error} </p> </div> )}

                 {/* Card Body - View or Edit */}
                 <div className="p-6 md:p-8">
                     {!isEditing ? (
                        // --- View Mode ---
                         <dl className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6 text-sm">
                             {/* Name */}
                             <div className="md:col-span-6"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Box className="h-4 w-4 mr-1.5 text-gray-400"/>Material Name</dt> <dd className="text-gray-900 text-lg">{material.name || '-'}</dd> </div>

                             {/* Quantity & Stock Status */}
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Hash className="h-4 w-4 mr-1.5 text-gray-400"/>Current Quantity</dt> <dd className="text-gray-900 font-bold text-xl">{material.quantity ?? '?'}</dd> </div>
                             <div className="md:col-span-2"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Scale className="h-4 w-4 mr-1.5 text-gray-400"/>Unit</dt> <dd className="text-gray-900">{material.unit_of_measurement || <span className="italic text-gray-500">N/A</span>}</dd> </div>
                             <div className="md:col-span-2 self-center"> {/* Align badge vertically */}
                                 <dt className="font-semibold text-gray-700 mb-1 flex items-center"><PackageSearch className="h-4 w-4 mr-1.5 text-gray-400"/>Stock Status</dt>
                                 <dd className="mt-1"><StockLevelIndicator quantity={material.quantity} reorderLevel={material.reorder_level} /></dd>
                             </div>

                              {/* Reorder Level */}
                             <div className="md:col-span-6">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Repeat className="h-4 w-4 mr-1.5 text-gray-400"/>Reorder Level</dt>
                                 <dd className="text-gray-900">{material.reorder_level ?? <span className="italic text-gray-500">Not set</span>}</dd>
                             </div>


                             {/* Description */}
                             <div className="md:col-span-6 pt-2">
                                 <dt className="font-semibold text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Description</dt>
                                 <dd className="text-gray-800 whitespace-pre-wrap leading-relaxed">{material.description || <span className="italic text-gray-500">No description provided</span>}</dd>
                             </div>

                             {/* Last Updated */}
                             <div className="md:col-span-6 border-t border-gray-200 pt-4 mt-4">
                                 <dt className="font-medium text-xs text-gray-500 uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>Last Updated</dt>
                                 <dd className="mt-1 text-gray-700 text-xs">{formatDateTime(material.updated_at)}</dd>
                             </div>
                         </dl>
                     ) : (
                        // --- Edit Mode ---
                         <form onSubmit={handleUpdate} className="space-y-6">
                             {/* Form Error Display */}
                             {formError && ( <div className="p-3 rounded-md bg-red-50 border border-red-200"> <p className="text-sm text-red-700 flex items-center whitespace-pre-wrap"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {formError} </p> </div> )}

                             {/* Name Input */}
                              <div>
                                 <label htmlFor="edit-mat-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Box className="h-4 w-4 mr-1.5 text-gray-400"/> Material Name <span className="text-red-500 ml-1">*</span></label>
                                 <input type="text" id="edit-mat-name" name="name" value={editData.name} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., Steel Rod 10mm"/>
                             </div>
                             {/* Unit Input */}
                             <div>
                                 <label htmlFor="edit-mat-unit" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Scale className="h-4 w-4 mr-1.5 text-gray-400"/> Unit of Measurement <span className="text-red-500 ml-1">*</span></label>
                                 <input type="text" id="edit-mat-unit" name="unit_of_measurement" value={editData.unit_of_measurement} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., kg, meter, piece"/>
                             </div>
                             {/* Quantity Input */}
                             <div>
                                  <label htmlFor="edit-mat-quantity" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Hash className="h-4 w-4 mr-1.5 text-gray-400"/> Current Quantity <span className="text-red-500 ml-1">*</span></label>
                                  <input type="number" id="edit-mat-quantity" name="quantity" value={editData.quantity} onChange={handleEditInputChange} min="0" step="0.01" required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., 150.50"/>
                              </div>
                             {/* Reorder Level Input */}
                              <div>
                                   <label htmlFor="edit-mat-reorder" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"> <Repeat className="h-4 w-4 mr-1.5 text-gray-400"/> Reorder Level <span className="text-red-500 ml-1">*</span></label>
                                   <input type="number" id="edit-mat-reorder" name="reorder_level" value={editData.reorder_level} onChange={handleEditInputChange} min="0" step="0.01" required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., 25.00"/>
                               </div>
                             {/* Description Textarea */}
                             <div>
                                 <label htmlFor="edit-mat-description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><FileText className="h-4 w-4 mr-1.5 text-gray-400"/> Description (Optional)</label>
                                 <textarea id="edit-mat-description" name="description" rows="4" value={editData.description} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Add specifications, supplier notes, etc."></textarea>
                             </div>

                             {/* Action Buttons */}
                             <div className="flex justify-end space-x-3 pt-5 border-t border-gray-200 mt-8">
                                 <button type="button" onClick={handleCancelEdit} className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving}> <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel </button>
                                 <button type="submit" className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50" disabled={isSaving}> {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />} {isSaving ? 'Saving...' : 'Save Changes'} </button>
                             </div>
                         </form>
                     )}
                 </div>
            </div>
        </div>
    );
}

export default MaterialDetailPage;