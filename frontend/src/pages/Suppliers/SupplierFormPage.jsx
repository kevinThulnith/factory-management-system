// src/pages/suppliers/SupplierFormPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// Adjust import paths for API functions
// Assuming functions like getSupplierDetail, createSupplier, updateSupplier exist
import { getSupplierDetail, createSupplier, updateSupplier } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    Loader2, AlertTriangle, Save, X, ArrowLeft, Truck, Mail, Phone, MapPin, User, Link as LinkIcon // Added more specific icons
} from 'lucide-react';

function SupplierFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth(); // Use auth context
    const isEditing = Boolean(id);

    // --- State ---
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        email: '',
        phone: '',
        contact_person: '', // Added field
        website: '',       // Added field
    });
    const [loading, setLoading] = useState(false); // For form submission spinner/disabling
    const [dataLoading, setDataLoading] = useState(true); // Specifically for fetching initial data when editing
    const [error, setError] = useState(''); // For displaying fetch or save errors

    // --- Fetch Initial Data ---
    const fetchSupplierData = useCallback(async () => {
        if (!isEditing) {
            setDataLoading(false); // No data to fetch if adding new
            return;
        }
        setDataLoading(true);
        setError('');
        try {
            console.log(`Fetching supplier details for ID: ${id}`);
            const response = await getSupplierDetail(id); // Use dedicated function
            const supplierData = response.data;

            setFormData({
                name: supplierData.name || '',
                address: supplierData.address || '',
                email: supplierData.email || '',
                phone: supplierData.phone || '',
                contact_person: supplierData.contact_person || '', // Populate added field
                website: supplierData.website || '',             // Populate added field
            });
            console.log("Fetched and set form data based on API response");

        } catch (err) {
            console.error("Failed to fetch supplier for editing:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || 'Failed to load supplier data.';
            setError(errorMsg);
        } finally {
            setDataLoading(false);
        }
    }, [id, isEditing]);

    // --- Effects ---
    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchSupplierData();
    }, [isAuthenticated, navigate, fetchSupplierData]); // Added fetchSupplierData

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (error) setError(''); // Clear error on input change
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // --- Client-side Validation ---
        if (!formData.name.trim()) {
            setError("Supplier name is required.");
            setLoading(false);
            return;
        }
        // Basic email format check (backend should validate more thoroughly)
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            setError('Please enter a valid email address.');
            setLoading(false);
            return;
        }
         // Basic URL format check (optional)
         if (formData.website && !/^((https?:\/\/)|(www\.))?[\w-]+\.[\w-]+(\.[\w-]+)*([\/\?#]\S*)?$/i.test(formData.website)) {
             setError('Please enter a valid website URL (e.g., example.com or http://example.com).');
             setLoading(false);
             return;
         }


        // Prepare payload: Send optional fields as null if empty string
        const payload = {
            name: formData.name.trim(),
            address: formData.address.trim() || null,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            contact_person: formData.contact_person.trim() || null, // Added field
            website: formData.website.trim() || null,             // Added field
        };

        console.log("Submitting supplier with payload:", payload);

        try {
            if (isEditing) {
                await updateSupplier(id, payload); // Use dedicated function
            } else {
                await createSupplier(payload); // Use dedicated function
            }
            navigate('/suppliers'); // Redirect to list page on success
        } catch (err) {
            console.error("Failed to save supplier:", err.response?.data || err.message || err);
            const backendErrors = err.response?.data;
            // Parse backend validation errors
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
    if (dataLoading && isEditing) {
        return ( <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /><p className="ml-3 text-gray-600">Loading supplier data...</p></div> );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Back Button */}
            <Link to="/suppliers" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-700 mb-6 group transition-colors duration-150">
                 <ArrowLeft className="h-4 w-4 mr-1.5 group-hover:-translate-x-1 transition-transform duration-150 ease-in-out" /> Back to Suppliers
            </Link>

             {/* Main Card */}
             <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200/75">
                 {/* Card Header */}
                 <div className="bg-gradient-to-b from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                     <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                         <Truck className="h-6 w-6 mr-2.5 text-blue-600"/> {/* Supplier Icon */}
                         {isEditing ? 'Edit Supplier' : 'Add New Supplier'}
                     </h2>
                 </div>

                 {/* Card Body - Form */}
                 <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                     {/* General Error Display Area */}
                     {error && (
                          <div className="p-3 rounded-md bg-red-50 border border-red-200 shadow-sm">
                              <p className="text-sm text-red-700 flex items-start whitespace-pre-wrap">
                                  <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                                 {error}
                              </p>
                          </div>
                       )}

                      {/* Name */}
                     <div>
                         <label htmlFor="sup-name" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Truck className="h-4 w-4 mr-1.5 text-gray-400"/> Supplier Name <span className="text-red-500 ml-1">*</span>
                         </label>
                         <input
                             type="text" id="sup-name" name="name"
                             value={formData.name} onChange={handleChange} required
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                             placeholder="e.g., Acme Steel Co."
                         />
                     </div>

                     {/* Contact Person */}
                     <div>
                         <label htmlFor="sup-contact" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <User className="h-4 w-4 mr-1.5 text-gray-400"/> Contact Person (Optional)
                         </label>
                         <input
                             type="text" id="sup-contact" name="contact_person"
                             value={formData.contact_person} onChange={handleChange}
                             disabled={loading}
                             className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                             placeholder="e.g., Jane Doe"
                         />
                     </div>

                      {/* Email */}
                      <div>
                          <label htmlFor="sup-email" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Mail className="h-4 w-4 mr-1.5 text-gray-400"/> Email (Optional)
                          </label>
                          <input
                              type="email" id="sup-email" name="email"
                              value={formData.email} onChange={handleChange}
                              disabled={loading}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                              placeholder="e.g., contact@acmesteel.com"
                          />
                      </div>

                     {/* Phone */}
                     <div>
                          <label htmlFor="sup-phone" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                             <Phone className="h-4 w-4 mr-1.5 text-gray-400"/> Phone (Optional)
                          </label>
                          <input
                              type="tel" id="sup-phone" name="phone"
                              value={formData.phone} onChange={handleChange}
                              disabled={loading}
                              className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                              placeholder="e.g., +1-555-123-4567"
                          />
                      </div>

                       {/* Website */}
                       <div>
                           <label htmlFor="sup-website" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                              <LinkIcon className="h-4 w-4 mr-1.5 text-gray-400"/> Website (Optional)
                           </label>
                           <input
                               type="text" // Use text for easier input, rely on pattern/validation
                               id="sup-website" name="website"
                               value={formData.website} onChange={handleChange}
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                               placeholder="e.g., www.acmesteel.com"
                               // Optional pattern for basic validation
                               // pattern="^((https?:\/\/)|(www\.))?[\w-]+\.[\w-]+(\.[\w-]+)*([\/\?#]\S*)?$"
                           />
                       </div>

                     {/* Address */}
                       <div>
                           <label htmlFor="sup-address" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <MapPin className="h-4 w-4 mr-1.5 text-gray-400"/> Address (Optional)
                           </label>
                           <textarea
                               id="sup-address" name="address" rows="3" // Reduced rows
                               value={formData.address} onChange={handleChange}
                               disabled={loading}
                               className="shadow-sm block w-full border bg-slate-50 border-gray-800 rounded-md py-2 px-3 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                               placeholder="Optional: Enter full address"
                           ></textarea>
                       </div>


                     {/* Action Buttons Footer */}
                     <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-8">
                         <Link
                             to="/suppliers" type="button" // Ensure correct path
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
                             {loading ? 'Saving...' : (isEditing ? 'Update Supplier' : 'Create Supplier')}
                         </button>
                     </div>
                 </form>
             </div>
        </div>
    );
}

export default SupplierFormPage;