// src/pages/suppliers/SupplierDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
// Adjust imports for your API service functions
import { getSupplierDetail, updateSupplier, deleteSupplier } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, ArrowLeft, Edit, Trash2, Save, X,
    Truck, // For Supplier Name
    Mail, // For Email
    Phone, // For Phone
    MapPin, // For Address
    User, // For Contact Person
    Link as LinkIcon, // For Website
    Clock, // For Timestamps
    HelpCircle // For N/A
} from 'lucide-react';

// Helper to format website URL for display/linking
const formatWebsiteUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    return `//${url}`; // Add protocol-relative prefix for external links
};

// Helper to format Date and Time (Use consistent one from other detail pages)
const formatDateTime = (dateTimeString) => { if (!dateTimeString) return 'N/A'; try { const date = new Date(dateTimeString); if (isNaN(date.getTime())) return 'Invalid Date'; return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { return 'Formatting Error'; } };


function SupplierDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- State ---
    const [supplier, setSupplier] = useState(null); // View Data
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ name: '', address: '', email: '', phone: '', contact_person: '', website: '' }); // Edit Data
    const [loading, setLoading] = useState(true); // Initial page load
    const [isSaving, setIsSaving] = useState(false); // Save operation
    const [isDeleting, setIsDeleting] = useState(false); // Delete operation
    const [error, setError] = useState(''); // Primary load/delete error
    const [formError, setFormError] = useState(''); // Edit form error

    // --- Fetch Initial Data ---
    const fetchSupplierDetails = useCallback(async () => {
        setLoading(true); setError(''); setFormError('');
        setSupplier(null); // Clear previous data

        try {
            console.log(`Fetching supplier details for ID: ${id}`);
            const response = await getSupplierDetail(id); // Use dedicated function
            const supplierData = response.data;
            setSupplier(supplierData);
            console.log("Supplier data fetched:", supplierData);

            // Initialize Edit Data *after* fetching
            setEditData({
                name: supplierData.name || '',
                address: supplierData.address || '',
                email: supplierData.email || '',
                phone: supplierData.phone || '',
                contact_person: supplierData.contact_person || '',
                website: supplierData.website || '',
            });
            console.log("Initialized editData");

        } catch (err) {
            console.error("Failed to fetch supplier:", err.response || err);
            const errorMsg = err.response?.status === 404
                ? 'Supplier not found.'
                : (err.response?.data?.detail || err.message || 'Failed to load supplier details.');
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [id]);

    // --- Effects ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        if (id) { fetchSupplierDetails(); }
        else { setError("Supplier ID is missing."); setLoading(false); }
    }, [id, isAuthenticated, navigate, fetchSupplierDetails]);

    // --- Handlers ---
     const handleEditInputChange = (e) => {
         const { name, value } = e.target;
         setEditData(prev => ({ ...prev, [name]: value }));
         if (formError) setFormError('');
     };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setFormError('');

        // Client-side Validation
        if (!editData.name.trim()) { setFormError('Supplier name is required.'); return; }
        if (editData.email && !/\S+@\S+\.\S+/.test(editData.email)) { setFormError('Please enter a valid email address.'); return; }
         if (editData.website && !/^((https?:\/\/)|(www\.))?[\w-]+\.[\w-]+(\.[\w-]+)*([\/\?#]\S*)?$/i.test(editData.website)) { setFormError('Please enter a valid website URL.'); return; }

        setIsSaving(true);
        const payload = {
            name: editData.name.trim(),
            address: editData.address.trim() || null,
            email: editData.email.trim() || null,
            phone: editData.phone.trim() || null,
            contact_person: editData.contact_person.trim() || null,
            website: editData.website.trim() || null,
        };

        console.log("[DEBUG] Updating supplier with payload:", payload);

        try {
            const response = await updateSupplier(id, payload); // Use dedicated function
            setSupplier(response.data); // Update view state
            // Re-initialize editData to match saved data
            setEditData({
                name: response.data.name || '',
                address: response.data.address || '',
                email: response.data.email || '',
                phone: response.data.phone || '',
                contact_person: response.data.contact_person || '',
                website: response.data.website || '',
            });
            setIsEditing(false); // Exit edit mode
        } catch (err) {
             console.error("Failed to update supplier:", err.response || err);
             // Parse and set formError
             const backendErrors = err.response?.data;
             if (typeof backendErrors === 'object' && backendErrors !== null) { const errorMessages = Object.entries(backendErrors).map(([field, messages]) => `${field.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}: ${Array.isArray(messages) ? messages.join(' ') : messages}`).join(' \n'); setFormError(errorMessages || 'Update failed. Check fields.'); }
             else { setFormError(backendErrors?.detail || err.message || 'An unknown error occurred during update.'); }
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setFormError('');
        // Reset editData to match current view state
        if (supplier) {
            setEditData({
                name: supplier.name || '',
                address: supplier.address || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                contact_person: supplier.contact_person || '',
                website: supplier.website || '',
            });
        }
    };

    const handleDelete = async () => {
        const supplierName = supplier?.name || `Supplier ID ${id}`;
        if (window.confirm(`Are you sure you want to delete "${supplierName}"? This action cannot be undone.`)) {
            setIsDeleting(true);
            setError(''); setFormError(''); // Clear errors
            try {
                await deleteSupplier(id); // Use dedicated function
                navigate('/suppliers'); // Go back to list
            } catch (err) {
                console.error("Failed to delete supplier:", err.response || err);
                let errorMsg = err.response?.data?.detail || 'Failed to delete supplier.';
                setError(errorMsg); // Set general error
                setIsDeleting(false);
            }
        }
    };


    // --- Render Logic ---

    if (loading) { return ( <div className="flex justify-center items-center h-screen"> <Loader2 className="h-8 w-8 animate-spin text-blue-600" /> </div> ); }
    if (error && !supplier) { return ( <div className="max-w-xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg text-center"> <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4"/> <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Supplier</h3> <p className="text-red-700 mb-4 whitespace-pre-wrap">{error}</p> <Link to="/suppliers" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"> <ArrowLeft className="h-4 w-4 mr-2" /> Back to Suppliers List </Link> </div> ); }
    if (!supplier) return null;

    const websiteUrl = formatWebsiteUrl(supplier.website); // Format for linking

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
             <Link to="/suppliers" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Suppliers
             </Link>

             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                  {/* Card Header */}
                  <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-y-3">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center min-w-0 mr-4">
                          <Truck className="h-5 w-5 mr-2.5 text-blue-600 flex-shrink-0"/>
                          <span className="truncate" title={isEditing ? 'Edit Supplier' : supplier.name}>
                              {isEditing ? 'Edit Supplier' : supplier.name}
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

                 {/* General Error Display */}
                 {error && supplier && ( <div className="border-b border-red-200 bg-red-50 px-6 py-3"> <p className="text-sm text-red-700 flex items-center"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {error} </p> </div> )}

                 {/* Card Body - View or Edit */}
                 <div className="p-6 md:p-8">
                     {!isEditing ? (
                        // --- View Mode ---
                         <dl className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-6 text-sm">
                             {/* Name */}
                             <div className="md:col-span-6"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Truck className="h-4 w-4 mr-1.5 text-gray-400"/>Supplier Name</dt> <dd className="text-gray-900 text-lg">{supplier.name || '-'}</dd> </div>

                             {/* Contact Person */}
                             <div className="md:col-span-3"> <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><User className="h-4 w-4 mr-1.5 text-gray-400"/>Contact Person</dt> <dd className="text-gray-900">{supplier.contact_person || <span className="italic text-gray-500">N/A</span>}</dd> </div>
                             {/* Spacer */}
                             <div className="md:col-span-3"></div>


                             {/* Email */}
                             <div className="md:col-span-3">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Mail className="h-4 w-4 mr-1.5 text-gray-400"/>Email</dt>
                                 <dd className="text-gray-900">
                                     {supplier.email ? <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline hover:text-blue-800 break-all">{supplier.email}</a> : <span className="italic text-gray-500">N/A</span>}
                                 </dd>
                             </div>
                             {/* Phone */}
                             <div className="md:col-span-3">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><Phone className="h-4 w-4 mr-1.5 text-gray-400"/>Phone</dt>
                                 <dd className="text-gray-900">{supplier.phone || <span className="italic text-gray-500">N/A</span>}</dd>
                             </div>

                              {/* Website */}
                              <div className="md:col-span-6">
                                 <dt className="font-semibold text-gray-700 mb-0.5 flex items-center"><LinkIcon className="h-4 w-4 mr-1.5 text-gray-400"/>Website</dt>
                                 <dd className="text-gray-900">
                                     {websiteUrl ? <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 break-all">{supplier.website}</a> : <span className="italic text-gray-500">N/A</span>}
                                 </dd>
                              </div>

                             {/* Address */}
                             <div className="md:col-span-6 pt-2">
                                 <dt className="font-semibold text-gray-700 mb-1 flex items-center"><MapPin className="h-4 w-4 mr-1.5 text-gray-400 flex-shrink-0"/>Address</dt>
                                 <dd className="text-gray-800 whitespace-pre-wrap leading-relaxed">{supplier.address || <span className="italic text-gray-500">No address provided</span>}</dd>
                             </div>

                             {/* Last Updated */}
                             <div className="md:col-span-6 border-t border-gray-200 pt-4 mt-4">
                                 <dt className="font-medium text-xs text-gray-500 uppercase tracking-wider flex items-center"><Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>Last Updated</dt>
                                 {/* Assuming updated_at exists on supplier model */}
                                 <dd className="mt-1 text-gray-700 text-xs">{formatDateTime(supplier.updated_at)}</dd>
                             </div>
                         </dl>
                     ) : (
                        // --- Edit Mode ---
                         <form onSubmit={handleUpdate} className="space-y-6">
                             {/* Form Error Display */}
                             {formError && ( <div className="p-3 rounded-md bg-red-50 border border-red-200"> <p className="text-sm text-red-700 flex items-center whitespace-pre-wrap"> <AlertTriangle className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" /> {formError} </p> </div> )}

                              {/* Name Input */}
                              <div>
                                 <label htmlFor="edit-sup-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Truck className="h-4 w-4 mr-1 text-gray-400"/> Supplier Name <span className="text-red-500 ml-1">*</span></label>
                                 <input type="text" id="edit-sup-name" name="name" value={editData.name} onChange={handleEditInputChange} required disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Supplier Company Name"/>
                             </div>
                             {/* Contact Person Input */}
                              <div>
                                 <label htmlFor="edit-sup-contact" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><User className="h-4 w-4 mr-1 text-gray-400"/> Contact Person</label>
                                 <input type="text" id="edit-sup-contact" name="contact_person" value={editData.contact_person} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., John Smith"/>
                             </div>
                             {/* Email Input */}
                             <div>
                                 <label htmlFor="edit-sup-email" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Mail className="h-4 w-4 mr-1 text-gray-400"/> Email</label>
                                 <input type="email" id="edit-sup-email" name="email" value={editData.email} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., sales@supplier.com"/>
                             </div>
                             {/* Phone Input */}
                              <div>
                                  <label htmlFor="edit-sup-phone" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><Phone className="h-4 w-4 mr-1 text-gray-400"/> Phone</label>
                                  <input type="tel" id="edit-sup-phone" name="phone" value={editData.phone} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., +1-555-987-6543"/>
                              </div>
                             {/* Website Input */}
                              <div>
                                  <label htmlFor="edit-sup-website" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><LinkIcon className="h-4 w-4 mr-1 text-gray-400"/> Website</label>
                                  <input type="text" id="edit-sup-website" name="website" value={editData.website} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="e.g., www.supplier.com"/>
                              </div>
                             {/* Address Textarea */}
                             <div>
                                 <label htmlFor="edit-sup-address" className="block text-sm font-medium text-gray-700 mb-1 flex items-center"><MapPin className="h-4 w-4 mr-1 text-gray-400"/> Address</label>
                                 <textarea id="edit-sup-address" name="address" rows="3" value={editData.address} onChange={handleEditInputChange} disabled={isSaving} className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed" placeholder="Enter full address..."></textarea>
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

export default SupplierDetailPage;