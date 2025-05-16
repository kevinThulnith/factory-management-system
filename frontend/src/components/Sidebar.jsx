import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserInfo } from '../services/api';
import { FiSettings, FiLogOut } from 'react-icons/fi';
import { Building2, LayoutDashboardIcon , Star, Cog, Factory, Truck, Box ,Package } from 'lucide-react';
 // Example import

function Sidebar() {
  const { logout, isAuthenticated } = useAuth();
  const location = useLocation();

  const [userInfo, setUserInfo] = useState(null);
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);
  const [userInfoError, setUserInfoError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoadingUserInfo(true);
      setUserInfoError('');
      getUserInfo()
        .then(response => { setUserInfo(response.data); })
        .catch(error => { console.error("Failed to fetch user info:", error); setUserInfoError("Could not load user details."); setUserInfo(null); })
        .finally(() => { setIsLoadingUserInfo(false); });
    } else {
      setUserInfo(null); setIsLoadingUserInfo(false); setUserInfoError('');
    }
  }, [isAuthenticated]);

  // --- Determine Admin Status ---
  const isAdmin = !!(userInfo?.is_staff || userInfo?.is_superuser || userInfo?.role === 'ADMIN'); // Ensure boolean

  // --- Define Color Themes ---
  // Define base classes and theme-specific classes
  const baseClasses = "w-64 text-white flex flex-col h-full shadow-xl flex-shrink-0";
  const adminTheme = {
    gradient: "bg-gradient-to-b from-red-900 to-red-800",
    border: "border-red-700",
    activeBg: "bg-red-700",
    hoverBg: "hover:bg-red-700/60",
    iconText: "text-red-300",
    skeletonBg: "bg-red-700/30",
    logoutHover: "hover:bg-gray-600/80", // Keep logout distinct, maybe neutral/darker hover
    registerHover: "hover:bg-red-700/60",
  };
  const userTheme = {
    gradient: "bg-gradient-to-b from-blue-900 to-blue-800",
    border: "border-blue-700",
    activeBg: "bg-blue-700",
    hoverBg: "hover:bg-blue-700/60",
    iconText: "text-blue-300",
    skeletonBg: "bg-blue-700/30",
    logoutHover: "hover:bg-red-600/80", // Keep logout danger hover
    registerHover: "hover:bg-blue-700/60",
  };

  // --- Select Theme based on Admin Status ---
  // Default to user theme while loading or if error
  const theme = !isLoadingUserInfo && isAdmin ? adminTheme : userTheme;

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', path: '/' , icon:<LayoutDashboardIcon size={20} /> },
    { id: 'departments', name: 'Departments', path: '/departments' , icon:<Building2 size={20} /> },
    { id: 'skills', name: 'Skill Matrix', path: '/skills' , icon:<Star size={20} /> },
    { id: 'workshops', name: 'Workshops', path: '/workshops' , icon:<Factory size={20} /> },
    { id: 'machines', name: 'Machines', path: '/machines' , icon:<Cog size={20} /> },
    { id: 'suppliers', name: 'Suppliers', path: '/suppliers' , icon:<Truck size={20} /> },
    { id: 'materials', name: 'Materials', path: '/materials' , icon:<Box size={20} /> },
    { id: 'products', name: 'Products', path: '/products' , icon:<Package size={20} /> },
  ];

  const renderBottomButtons = () => {
    if (isLoadingUserInfo) {
      return (
        <div className="space-y-2 animate-pulse">
           <div className={`h-[42px] ${theme.skeletonBg} rounded-md`}></div> {/* Use theme color for skeleton */}
           <div className={`h-[42px] ${theme.skeletonBg} rounded-md`}></div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {isAdmin && (
          <Link
            to="/register"
            className={`flex items-center w-full px-4 py-2.5 text-white ${theme.registerHover} rounded-md transition-all duration-150 ease-in-out group`}
          >
            <FiSettings className={`w-5 h-5 mr-3 ${theme.iconText} group-hover:text-white`} />
            <span className="text-sm font-medium">Register User</span>
          </Link>
        )}
        <button
          onClick={logout}
          // Apply base styles + specific theme hover for logout
          className={`w-full flex items-center px-4 py-2.5 text-white ${theme.logoutHover} rounded-md transition-all duration-150 ease-in-out group`}
        >
          <FiLogOut className={`w-5 h-5 mr-3 ${theme.iconText} group-hover:text-white`} />
          <span className="text-sm font-medium">Logout</span>
        </button>
         {userInfoError && (
            <p className="text-xs text-red-300 px-4 py-1">{userInfoError}</p> // Keep error text color consistent
         )}
      </div>
    );
  };

  return (
    // Apply dynamic gradient and base classes
    <div className={`${baseClasses} ${theme.gradient}`}>
      {/* Apply dynamic border */}
      <div className={`p-5 ${theme.border} flex justify-center items-center border-b`}>
        <span className="text-xl font-bold tracking-wide">Factory OS</span>
      </div>

      <div className="flex-grow overflow-y-auto py-8">
        <nav className="space-y-1 px-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.id}
                to={item.path}
                // Apply dynamic active/hover backgrounds
                className={`flex items-center px-4 py-2.5 rounded-md transition-all duration-150 ease-in-out group ${
                  isActive
                    ? `${theme.activeBg} text-white font-semibold shadow-inner`
                    : `text-white ${theme.hoverBg} hover:text-white` // Ensure text is white for non-active
                }`}
              >
                {/* Apply dynamic icon text color */}
                <span className={`mr-3 group-hover:scale-110 transition-transform duration-150 ${isActive ? 'text-white' : theme.iconText}`}>
                    {item.icon}
                </span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Apply dynamic border */}
      <div className={`p-4 ${theme.border} mt-auto border-t`}>
        {renderBottomButtons()}
      </div>
    </div>
  );
}

export default Sidebar;