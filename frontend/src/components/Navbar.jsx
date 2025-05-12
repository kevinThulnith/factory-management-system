// src/components/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
// Import listMachines ALONG WITH getUserInfo
import { getUserInfo, listMachines } from '../services/api';
import { BellIcon, UserIcon, LogOut, Settings } from 'lucide-react';

function Navbar() {
    const { isAuthenticated, logout } = useAuth();

    const [userInfo, setUserInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isUserAssignedToMachine, setIsUserAssignedToMachine] = useState(false);
    const [assignedMachineDetails, setAssignedMachineDetails] = useState(null);

    useEffect(() => {
        let isMounted = true; // Prevent state updates on unmounted component

        if (isAuthenticated) {
            setIsLoading(true);
            setError('');
            setAssignedMachineDetails(null);
            setIsUserAssignedToMachine(false);
            setIsAdmin(false); // Reset admin status on fetch
            setUserInfo(null); // Reset user info

            // Fetch User Info and *ALL* Machines Concurrently
            Promise.allSettled([
                getUserInfo(),
                listMachines() // <-- !!! FETCHING ALL MACHINES !!!
            ])
            .then(([userInfoResult, machinesResult]) => {
                if (!isMounted) return; // Exit if component unmounted

                let fetchedUser = null;
                let currentUserId = null;
                let fetchErrors = [];

                // 1. Process User Info
                if (userInfoResult.status === 'fulfilled') {
                    fetchedUser = userInfoResult.value.data;
                    setUserInfo(fetchedUser);
                    currentUserId = fetchedUser?.id; // Get current user's ID
                    const isAdminUser = !!(fetchedUser?.is_staff || fetchedUser?.is_superuser || fetchedUser?.role === 'ADMIN');
                    setIsAdmin(isAdminUser);
                    console.log("Navbar: User info fetched:", fetchedUser);
                } else {
                    console.error("Navbar: Failed to fetch user info:", userInfoResult.reason);
                    fetchErrors.push("Failed to load user details.");
                    setIsAdmin(false);
                }

                // 2. Process Machine List and Check Assignment
                if (machinesResult.status === 'fulfilled') {
                    const machines = Array.isArray(machinesResult.value?.data) ? machinesResult.value.data : [];
                    console.log(`Navbar: Fetched ${machines.length} machines to check assignment.`);

                    if (currentUserId != null) { // Only check if we have the user ID
                        // Find the first machine where the operator ID matches the current user ID
                        const foundMachine = machines.find(machine => machine.operator === currentUserId);

                        if (foundMachine) {
                            console.log(`Navbar: User ${currentUserId} IS assigned to machine ${foundMachine.id}.`);
                            setIsUserAssignedToMachine(true);
                            // Store needed details (id, name)
                            setAssignedMachineDetails({
                                id: foundMachine.id,
                                name: foundMachine.name
                            });
                        } else {
                            console.log(`Navbar: User ${currentUserId} not found as operator in machine list.`);
                            setIsUserAssignedToMachine(false);
                            setAssignedMachineDetails(null);
                        }
                    } else {
                        console.warn("Navbar: Cannot check machine assignment without user ID.");
                        setIsUserAssignedToMachine(false);
                         setAssignedMachineDetails(null);
                    }
                } else {
                    console.error("Navbar: Failed to fetch machine list:", machinesResult.reason);
                    // Don't necessarily block the UI for this, but log it maybe add to error state
                    fetchErrors.push("Failed to check machine assignment.");
                     setIsUserAssignedToMachine(false);
                     setAssignedMachineDetails(null);
                }

                 if (fetchErrors.length > 0) {
                     setError(fetchErrors.join(' '));
                 }

            })
            .catch(err => { // Catch any unexpected errors during Promise.allSettled setup
                 if (!isMounted) return;
                 console.error("Navbar: Unexpected error during fetch:", err);
                 setError("An error occurred while loading data.");
                 setIsAdmin(false);
                 setIsUserAssignedToMachine(false);
                 setAssignedMachineDetails(null);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });
        } else {
            setUserInfo(null);
            setIsAdmin(false);
            setIsUserAssignedToMachine(false);
            setAssignedMachineDetails(null);
            setIsLoading(false);
            setError('');
        }

        // Cleanup function to prevent state updates after unmount
        return () => {
            isMounted = false;
        };
    }, [isAuthenticated]); // Re-run when auth status changes

    // --- Define Color Themes (remains the same) ---
    const adminTheme = { bg: "bg-red-700", text: "text-red-50", icon: "text-red-100", hoverBg: "hover:bg-red-600", profileBg: "bg-red-500", notificationPulse: "animate-pulse bg-yellow-600", logoutHoverBg: "hover:bg-red-800", };
    const userTheme = { bg: "bg-blue-800", text: "text-blue-50", icon: "text-blue-100", hoverBg: "hover:bg-blue-700", profileBg: "bg-blue-600", notificationPulse: "animate-pulse bg-red-600", logoutHoverBg: "hover:bg-blue-900", };
    const theme = !isLoading && isAdmin ? adminTheme : userTheme;

    // --- Render Helper for Right Side (remains the same logic, uses state) ---
    const renderAuthenticatedControls = () => {
        if (isLoading) {
            return ( <div className="flex items-center space-x-2 sm:space-x-4 animate-pulse"> <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full ${theme.bg === adminTheme.bg ? 'bg-red-600' : 'bg-blue-700'}`}></div> <div className="flex items-center space-x-2"> <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full ${theme.bg === adminTheme.bg ? 'bg-red-500' : 'bg-blue-600'}`}></div> <div className={`h-4 w-16 sm:w-20 rounded ${theme.bg === adminTheme.bg ? 'bg-red-500' : 'bg-blue-600'} hidden sm:block`}></div> </div> <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full ${theme.bg === adminTheme.bg ? 'bg-red-600' : 'bg-blue-700'}`}></div> </div> );
        }
        return (
             <>
                {isUserAssignedToMachine && assignedMachineDetails && (
                    <Link to={`/machines/${assignedMachineDetails.id}`} title={`Assigned to: ${assignedMachineDetails.name || 'Machine ID ' + assignedMachineDetails.id}`} className={`relative p-1.5 sm:p-2 rounded-full ${theme.hoverBg} transition-colors duration-150`} >
                        <BellIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${theme.icon}`} />
                        <span className={`absolute top-0.5 right-0.5 sm:top-1 sm:right-1 block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${theme.notificationPulse} ring-1 sm:ring-2 ${theme.bg === adminTheme.bg ? 'ring-red-700' : 'ring-blue-800'}`}></span>
                    </Link>
                )}
                 <div className="flex items-center">
                    <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full ${theme.profileBg} flex items-center justify-center text-white flex-shrink-0`}> <UserIcon size={16} className="sm:hidden" /> <UserIcon size={18} className="hidden sm:block" /> </div>
                    <span className={`ml-2 font-medium ${theme.text} hidden sm:inline truncate`} title={userInfo?.name}> {userInfo?.name || 'User'} </span>
                 </div>
                  {isAdmin && ( <Link to="/register" title="Register New User" className={`p-1.5 sm:p-2 rounded-full ${theme.hoverBg} transition-colors duration-150`} > <Settings className={`h-4 w-4 sm:h-5 sm:w-5 ${theme.icon}`} /> </Link> )}
                 <button onClick={logout} title="Logout" className={`p-1.5 sm:p-2 rounded-full ${theme.logoutHoverBg} transition-colors duration-150`} > <LogOut className={`h-4 w-4 sm:h-5 sm:w-5 ${theme.icon}`} /> </button>
                 {error && <span className="text-xs text-red-300 hidden md:inline">{error}</span>}
             </>
        );
    };

    // --- Main component render (remains the same) ---
    return (
        <header className={`shadow-md px-4 sm:px-6 py-2.5 flex items-center justify-between w-full ${theme.bg}`}>
            <div className="flex items-center"></div>
            <div className="flex items-center space-x-2 sm:space-x-4">
                {!isAuthenticated ? ( <> <Link to="/login" className={`${theme.text} ${theme.hoverBg} px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors`}>Login</Link> </> )
                : ( renderAuthenticatedControls() )}
            </div>
        </header>
    );
}

export default Navbar;