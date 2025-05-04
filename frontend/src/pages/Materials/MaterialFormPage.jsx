// src/pages/materials/MaterialFormPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Adjust import paths for API functions
// Assuming functions like getMaterialDetail, createMaterial, updateMaterial exist
import { getMaterialDetail, createMaterial, updateMaterial } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, Save, X, ArrowLeft, Box, Scale, FileText, Hash, Repeat // Added icons
} from 'lucide-react';

function MaterialFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth(); // Use auth if needed
    const isEditing = Boolean(id);

    // --- State ---
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        unit_of_measurement: '',
        quantity: '0.00', // Keep as string for controlled input
        reorder_level: '0.00', // Keep as string
    });
    const [loading, setLoading] = useState(false); // For form submission
    const [dataLoading, setDataLoading] = useState(true); // Specifically for fetching initial data
    const [error, setError] = useState(''); // For displaying errors

    // --- Fetch Initial Data ---
    const fetchMaterialData = useCallback(async () => {
        if (!isEditing) {
            setDataLoading(false); // No data to fetch if adding new
            return;
        }

        setDataLoading(true);
        setError('');
        try {
            console.log(`Fetching material details for ID: ${id}`);
            const response = await getMaterialDetail(id); // Use dedicated function
            const materialData = response.data;

            setFormData({
                name: materialData.name || '',
                description: materialData.description || '',
                unit_of_measurement: materialData.unit_of_measurement || '',
                // Format numbers back to string with fixed decimal places for input control
                quantity: parseFloat(materialData.quantity ?? 0).toFixed(2),
                reorder_level: parseFloat(materialData.reorder_level ?? 0).toFixed(2),
            });
             console.log("Fetched and set form data:", formData);

        } catch (err) {
            console.error("Failed to fetch material for editing:", err.response || err);
            setError(err.response?.data?.detail || err.message || 'Failed to load material data.');
            // Optionally navigate back or show a non-editable error state
            // navigate('/materials');
        } finally {
            setDataLoading(false);
        }
    }, [id, isEditing]); // Removed formData from dependencies

    // --- Effects ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchMaterialData();
    }, [isAuthenticated, navigate, fetchMaterialData]); // Added fetchMaterialData

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        // Basic validation for numeric fields to prevent non-numeric characters (optional but helpful)
        // if ((name === 'quantity' || name === 'reorder_level') && !/^\d*\.?\d*$/.test(value)) {
        //     return; // Prevent non-numeric input
        // }
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(''); // Clear error on input change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Convert numeric fields back to numbers, validate
        const quantityNum = parseFloat(formData.quantity);
        const reorderLevelNum = parseFloat(formData.reorder_level);

        if (isNaN(quantityNum) || quantityNum < 0) {
            setError("Quantity must be a valid non-negative number.");
            setLoading(false);
            return;
        }
        if (isNaN(reorderLevelNum) || reorderLevelNum < 0) {
            setError("Reorder Level must be a valid non-negative number.");
            setLoading(false);
            return;
        }
        if (!formData.name.trim()) {
            setError("Material name is required.");
            setLoading(false);
            return;
        }
        if (!formData.unit_of_measurement.trim()) {
            setError("Unit of Measurement is required.");
            setLoading(false);
            return;
        }


        const payload = {
            name: formData.name.trim(),
            description: formData.description.trim() || null, // Send null if empty
            unit_of_measurement: formData.unit_of_measurement.trim(), // Required, so no null check
            quantity: quantityNum.toFixed(2), // Send as string with fixed decimals if backend expects that, or just quantityNum
            reorder_level: reorderLevelNum.toFixed(2), // Send as string or number based on backend decimal field handling
        };

        console.log("Submitting material with payload:", payload);

        try {
            if (isEditing) {
                await updateMaterial(id, payload); // Use dedicated function
            } else {
                await createMaterial(payload); // Use dedicated function
            }
            navigate('/materials'); // Redirect on success
        } catch (err) {
            console.error("Failed to save material:", err.response?.data || err.message || err);
            const backendErrors = err.response?.data;
            if (typeof backendErrors === 'object' && backendErrors !== null) {
                const errorMessages = Object.entries(backendErrors)
                    .map(([field, messages]) => {
                        const formattedField = field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
                        return `${formattedField}: ${Array.isArray(messages) ? messages.join(' ') : messages}`;
                    }).join(' \n');
                setError(errorMessages || 'Save failed. Please check the fields.');
            } else {
                setError(backendErrors?.detail || err.message || 'An unknown error occurred during save.');
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Render Logic ---

    // Show full page loader only during initial data fetch when editing
    if (dataLoading && isEditing) {
        return ( <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3 text-gray-600">Loading material data...</p></div> );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Button */}
            <Link to="/materials" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Materials
            </Link>

             {/* Main Card */}
             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                 {/* Card Header */}
                 <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Box className="h-6 w-6 mr-2.5 text-blue-600"/> {/* Material Icon */}
                         {isEditing ? 'Edit Material' : 'Add New Material'}
                     </h2>
                 </div>

                 {/* Card Body - Form */}
                 <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                     {/* General Error Display Area */}
                     {error && (
                          <div className="p-3 rounded-md bg-red-50 border border-red-200">
                              <p className="text-sm text-red-700 flex items-start whitespace-pre-wrap">
                                  <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                                 {error}
                              </p>
                          </div>
                       )}

                      {/* Name */}
                     <div>
                         <label htmlFor="mat-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Box className="h-4 w-4 mr-1.5 text-gray-400"/> Material Name <span className="text-red-500 ml-1">*</span>
                         </label>
                         <input
                             type="text" id="mat-name" name="name"
                             value={formData.name} onChange={handleChange} required
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                             placeholder="e.g., Steel Rod 10mm"
                         />
                     </div>

                      {/* Unit of Measurement */}
                      <div>
                          <label htmlFor="mat-unit" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Scale className="h-4 w-4 mr-1.5 text-gray-400"/> Unit of Measurement <span className="text-red-500 ml-1">*</span>
                          </label>
                          <input
                              type="text" id="mat-unit" name="unit_of_measurement"
                              value={formData.unit_of_measurement} onChange={handleChange} required
                              disabled={loading}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                              placeholder="e.g., kg, meter, piece, liter"
                          />
                      </div>

                     {/* Quantity */}
                     <div>
                          <label htmlFor="mat-quantity" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Hash className="h-4 w-4 mr-1.5 text-gray-400"/> Current Quantity <span className="text-red-500 ml-1">*</span>
                          </label>
                          <input
                              type="number" id="mat-quantity" name="quantity"
                              value={formData.quantity} onChange={handleChange}
                              min="0" // Prevent negative quantity
                              step="0.01" // Or adjust based on typical units (e.g., "1" for pieces)
                              required
                              disabled={loading}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                              placeholder="e.g., 150.50"
                          />
                      </div>

                      {/* Reorder Level */}
                       <div>
                           <label htmlFor="mat-reorder" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <Repeat className="h-4 w-4 mr-1.5 text-gray-400"/> Reorder Level <span className="text-red-500 ml-1">*</span>
                           </label>
                           <input
                               type="number" id="mat-reorder" name="reorder_level"
                               value={formData.reorder_level} onChange={handleChange}
                               min="0" // Prevent negative reorder level
                               step="0.01" // Match quantity step or adjust
                               required
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                               placeholder="e.g., 25.00"
                           />
                       </div>

                     {/* Description */}
                       <div>
                           <label htmlFor="mat-description" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <FileText className="h-4 w-4 mr-1.5 text-gray-400"/> Description (Optional)
                           </label>
                           <textarea
                               id="mat-description" name="description" rows="4"
                               value={formData.description} onChange={handleChange}
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                               placeholder="Optional: Add specifications, supplier notes, etc."
                           ></textarea>
                       </div>


                     {/* Action Buttons */}
                     <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-8">
                         <Link
                             to="/materials" type="button"
                             className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 transition duration-150 ease-in-out disabled:opacity-50"
                             onClick={(e) => { if (loading) e.preventDefault(); }}
                             aria-disabled={loading}
                         >
                             <X className="h-4 w-4 mr-1.5 -ml-0.5" /> Cancel
                         </Link>
                         <button
                             type="submit"
                             className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-50"
                             disabled={loading}
                         >
                             {loading ? <Loader2 className="h-4 w-4 mr-1.5 -ml-0.5 animate-spin"/> : <Save className="h-4 w-4 mr-1.5 -ml-0.5" />}
                             {loading ? 'Saving...' : (isEditing ? 'Update Material' : 'Create Material')}
                         </button>
                     </div>
                 </form>
             </div>
        </div>
    );
}

export default MaterialFormPage;