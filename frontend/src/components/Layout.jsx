import React from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden w-screen"> 
      <Sidebar /> 
      <div className="flex-1 flex flex-col overflow-hidden"> 
        <Navbar /> 
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"> 
          <Outlet /> 
        </main>
      </div>
    </div>
  );
};

export default Layout;