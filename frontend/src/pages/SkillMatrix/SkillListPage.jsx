// src/pages/skills/SkillListPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Adjust path based on your project structure
import { listSkills, deleteSkill } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext'; // Adjust path
// Import necessary icons from lucide-react, aligning with other pages
import {
    Wrench, Plus, Trash2, Edit2, Search, Folder, AlertTriangle,
    Loader2, Info // Added Loader2, AlertTriangle, Info for consistency
} from 'lucide-react';

// --- Constants for Level Sorting and Colors ---
const levelSortOrder = {
    'BEGINNER': 0,
    'INTERMEDIATE': 1,
    'ADVANCED': 2,
    'EXPERT': 3,
};
const DEFAULT_LEVEL_SORT_VALUE = 4; // Place unknown/missing levels last

const getLevelColorClasses = (level) => {
    const normalizedLevel = level?.toUpperCase() || '';
    // Using Tailwind classes consistent with status badges elsewhere
    switch (normalizedLevel) {
        case 'BEGINNER':     return 'bg-green-100 text-green-800'; // Like Operational
        case 'INTERMEDIATE': return 'bg-blue-100 text-blue-800'; // New, distinct
        case 'ADVANCED':     return 'bg-purple-100 text-purple-800'; // New, distinct
        case 'EXPERT':       return 'bg-red-100 text-red-800'; // Like Broke Down (for emphasis)
        default:             return 'bg-gray-100 text-gray-800'; // Like Unknown/Idle
    }
};

// Helper to get the sort weight for a level
const getLevelWeight = (level) => {
    const normalizedLevel = level?.toUpperCase() || '';
    return levelSortOrder[normalizedLevel] ?? DEFAULT_LEVEL_SORT_VALUE;
};
// --- End Constants ---

function SkillListPage() {
    // --- State ---
    const [skills, setSkills] = useState([]);
    const [loading, setLoading] = useState(true); // Initial loading state
    const [error, setError] = useState(''); // Error for skills fetch/delete
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // --- Data Fetching (Skills) ---
    const fetchSkills = useCallback(async (isInitialLoad = false) => {
        // Set loading true only on initial mount when data is empty
        if (isInitialLoad && skills.length === 0) {
            setLoading(true);
        }
        setError(''); // Clear error before fetching

        try {
            console.log("Fetching skills...");
            const response = await listSkills();
            const data = Array.isArray(response?.data) ? response.data : [];
            setSkills(data);
            console.log("Skills fetched:", data.length);
        } catch (err) {
            console.error("Skill fetch failed:", err);
            const msg = err?.response?.data?.detail || err?.message || 'Failed to load skills.';
            setError(err?.response?.status === 401 || err?.response?.status === 403 ? 'Authorization failed.' : msg);
            setSkills([]); // Clear skills on error
        } finally {
            // Stop loading indicator (might already be false if not initial load)
            setLoading(false);
        }
    // Keep dependencies minimal for useCallback stability
    }, [/* skills.length */]); // Dependency removed to avoid re-creating function unnecessarily

    // --- Auth Check & Initial Fetch Effect ---
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return; // Stop if not authenticated
        }
        fetchSkills(true); // Fetch data on load/auth change, indicate it's initial
        // Removed setInterval for consistency with other pages
    }, [isAuthenticated, navigate, fetchSkills]); // Dependencies

    // --- Delete Handler ---
    const handleDelete = async (id, name) => {
        const skillIdentifier = name || `Skill ID ${id}`;
        if (!window.confirm(`Are you sure you want to delete the skill "${skillIdentifier}"? This action cannot be undone.`)) {
            return;
        }
        setError(''); // Clear previous errors

        try {
            console.log(`Deleting skill ID: ${id}`);
            await deleteSkill(id);
            console.log(`Skill ${id} deleted successfully.`);
            // Optimistic UI update: Filter locally for responsiveness
            setSkills(prevSkills => prevSkills.filter(s => s.id !== id));
            // Optional: Show success toast/message
        } catch (err) {
            console.error("Failed to delete skill:", err.response || err);
            const errorMsg = err.response?.data?.detail || err.message || `Failed to delete skill "${skillIdentifier}". It might be referenced elsewhere.`;
            setError(errorMsg); // Display delete error
        }
    };

    // --- Filtering Logic ---
    const filteredSkills = useMemo(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        return searchTerm
            ? skills.filter(skill =>
                skill.name?.toLowerCase().includes(lowerCaseSearchTerm) ||
                skill.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
                skill.category?.toLowerCase().includes(lowerCaseSearchTerm) ||
                skill.level?.toLowerCase().includes(lowerCaseSearchTerm) // Also search by level
            )
            : skills; // No search term, use all skills
    }, [skills, searchTerm]);

    // --- Grouping and Sorting within Groups Logic ---
    const groupedAndSortedSkills = useMemo(() => {
        console.log("[DEBUG] Grouping and sorting filtered skills...");
        const grouped = filteredSkills.reduce((acc, skill) => {
            const categoryKey = skill.category?.trim() || 'Uncategorized'; // Group null/empty as 'Uncategorized'
            if (!acc[categoryKey]) {
                acc[categoryKey] = [];
            }
            acc[categoryKey].push(skill);
            return acc;
        }, {});

        // Sort skills within each category group by level, then name
        for (const categoryKey in grouped) {
            grouped[categoryKey].sort((a, b) => {
                const weightA = getLevelWeight(a.level);
                const weightB = getLevelWeight(b.level);
                if (weightA !== weightB) {
                    return weightA - weightB; // Ascending level (Beginner first)
                }
                // Secondary sort: alphabetically by name if levels are the same
                return (a.name || '').localeCompare(b.name || '');
            });
        }
        return grouped;
    }, [filteredSkills]); // Recalculate when filtered skills change

    // --- Sort Category Group Keys ---
    const sortedCategoryKeys = useMemo(() => {
        const keys = Object.keys(groupedAndSortedSkills);
        keys.sort((a, b) => {
            if (a === 'Uncategorized') return 1; // Uncategorized always last
            if (b === 'Uncategorized') return -1;
            return a.localeCompare(b); // Alphabetical sort for others
        });
        // console.log("[DEBUG] Sorted category keys:", keys);
        return keys;
    }, [groupedAndSortedSkills]);

    // --- Render Logic ---

    // Display loading only on the very first load attempt
    if (loading && skills.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="ml-3 text-gray-600">Loading skills...</p>
            </div>
        );
    }

    // Determine if there are any skills left *after* filtering
    const hasFilteredSkills = filteredSkills.length > 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header: Title, Search, Add Button */}
            <div className="sm:flex sm:justify-between sm:items-center mb-8 flex-wrap gap-y-4">
                 <h1 className="text-2xl font-bold text-gray-900 mr-4">Skills</h1>
                 <div className="flex items-center space-x-4 flex-wrap gap-y-4 sm:flex-nowrap">
                     {/* Search Bar */}
                     <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                             <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                         </div>
                         <input
                             type="text" name="search" id="search"
                             className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                             placeholder="Search skills..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                         />
                     </div>
                     {/* Add Skill Button */}
                     {/* Ensure this link points to your correct skill creation route */}
                     {/* <Link to="/skills/add" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex-shrink-0">
                         <Plus className="h-5 w-5 mr-2 -ml-1" /> Add Skill
                     </Link> */}
                 </div>
             </div>

            {/* Error Display Area */}
             {error && (
                 <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200 shadow-sm">
                     <div className="flex items-center">
                         <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0" />
                         <p className="text-sm text-red-700">{error}</p>
                     </div>
                 </div>
             )}

            {/* --- Skills Grouped by Category --- */}
            <div className="space-y-10">
                {/* Check if there are skills *after filtering* before rendering groups */}
                {hasFilteredSkills ? (
                    sortedCategoryKeys.map((categoryKey) => {
                        const skillsInGroup = groupedAndSortedSkills[categoryKey];
                         // This check might be redundant if filteredSkills is empty, but safe to keep
                         if (!skillsInGroup || skillsInGroup.length === 0) {
                            return null; // Don't render header for empty groups
                         }

                        return (
                            <div key={categoryKey}>
                                {/* Category Section Header (Styled like Workshop Header) */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-gray-100 rounded-lg"> {/* Using gray for category folder */}
                                            <Folder className="h-6 w-6 text-gray-600"/>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-gray-900">
                                                {categoryKey}
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {skillsInGroup.length} skill{skillsInGroup.length !== 1 ? 's' : ''} listed
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Skills Grid (Matching Machine/Department Grid) */}
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 mb-12">
                                    {skillsInGroup.map((skill) => {
                                        const levelText = skill.level ? skill.level.charAt(0).toUpperCase() + skill.level.slice(1).toLowerCase() : 'N/A';
                                        const levelColor = getLevelColorClasses(skill.level);

                                        return (
                                            <div key={skill.id}
                                                className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 transition-all duration-300 flex flex-col overflow-hidden">
                                                {/* Card Header */}
                                                <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                                                    <div className="flex items-start justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center mb-1">
                                                                <Wrench className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0"/>
                                                                <h3 className="text-base font-semibold text-gray-900 truncate"
                                                                    title={skill.name}>
                                                                    {skill.name || 'Unnamed Skill'}
                                                                </h3>
                                                            </div>
                                                            {/* Optionally show category again if needed, or other field */}
                                                            {/* <p className="text-sm text-gray-600 truncate">{skill.category || 'No Category'}</p> */}
                                                        </div>
                                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                                            {/* Ensure this link points to your correct skill edit route */}
                                                            {/* <Link
                                                                to={`/skills/${skill.id}/edit`} // Adjusted route
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title={`Edit ${skill.name || 'Skill'}`}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Link> */}
                                                            <button
                                                                onClick={() => handleDelete(skill.id, skill.name)}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title={`Delete ${skill.name || 'Skill'}`}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="p-5 flex-grow space-y-3 text-sm">
                                                    {/* Level Badge */}
                                                    <div className="flex items-center">
                                                        <span title={`Level: ${levelText}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${levelColor} whitespace-nowrap`}>
                                                            {/* Optional Icon within badge - using Info as placeholder */}
                                                            {/* <Info aria-hidden="true" className={`h-3.5 w-3.5 mr-1.5 -ml-0.5 ${levelColor.split(' ')[1]}`} /> */}
                                                            {levelText}
                                                        </span>
                                                    </div>

                                                    {/* Description */}
                                                    {skill.description && (
                                                        <p className="text-gray-500 line-clamp-3" title={skill.description}>
                                                            {skill.description}
                                                        </p>
                                                    )}
                                                    {!skill.description && (
                                                         <p className="text-gray-400 italic">No description provided.</p>
                                                    )}
                                                </div>

                                                {/* Card Footer (Optional - add if needed, e.g., for created_at/updated_at) */}
                                                {/*
                                                {skill.updated_at && (
                                                    <div className="px-5 py-3 bg-gray-50 text-xs text-gray-500 flex items-center justify-between border-t border-gray-200">
                                                        <div className="flex items-center">
                                                            <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-400"/>
                                                            <span>Updated</span>
                                                        </div>
                                                        <span className="font-medium">{formatDate(skill.updated_at)}</span>
                                                    </div>
                                                )}
                                                */}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    /* Empty State - Show if loading is done, no errors, but filtering resulted in zero skills */
                    !loading && !error && (
                        <div className="text-center py-12 mt-8 border-2 border-dashed border-gray-300 rounded-lg bg-white">
                            <Wrench className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                                {searchTerm ? 'No skills match your search' : (skills.length === 0 ? 'No skills found' : 'No skills available')}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {searchTerm ? 'Try adjusting your search terms.' : (skills.length === 0 ? 'Get started by adding a new skill.' : 'Check filter criteria or add skills.')}
                            </p>
                             {/* Show Add button only if no search term and original list was empty */}
                             {!searchTerm && skills.length === 0 && (
                                <div className="mt-6">
                                    {/* Ensure this link points to your correct skill creation route */}
                                    <Link to="/skills/add" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                        <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" /> Add Skill
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

export default SkillListPage;