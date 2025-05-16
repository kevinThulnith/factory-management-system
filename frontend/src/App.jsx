// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DepartmentsPage from './pages/Department/DepartmentsPage';
import DepartmentDetailPage from './pages/Department/DepartmentDetailPage';

import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import CreateNewDepartment from './pages/Department/CreateNewDepartment';
import SkillListPage from './pages/SkillMatrix/SkillListPage';
import MachineListPage from './pages/Machine/MachineListPage';
import MachineFormPage from './pages/Machine/MachineFormPage';
import MachineDetailPage from './pages/Machine/MachineDetailPage';
import WorkshopListPage from './pages/Workshops/WorkshopListPage';
import WorkshopFormPage from './pages/Workshops/WorkshopFormPage';
import WorkshopDetailPage from './pages/Workshops/WorkshopDetailPage';
import MaterialListPage from './pages/Materials/MaterialListPage';
import MaterialFormPage from './pages/Materials/MaterialFormPage';
import MaterialDetailPage from './pages/Materials/MaterialDetailPage';
import SupplierListPage from './pages/Suppliers/SupplierListPage';
import SupplierFormPage from './pages/Suppliers/SupplierFormPage';
import SupplierDetailPage from './pages/Suppliers/SupplierDetailPage';

import ProductListPage from './pages/products/ProductListPage';
import ProductFormPage from './pages/products/ProductFormPage';
import ProductDetailPage from './pages/products/ProductDetailPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          

          {/* Protected Layout + Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              

              <Route path="/skills" element={<SkillListPage />} />

              <Route path="/departments" element={<DepartmentsPage />} />
              <Route path="/departments/:id" element={<DepartmentDetailPage />} />
              <Route path="/departments/add" element={<CreateNewDepartment />} />
            
              <Route path="/machines" element={<MachineListPage />} />
              <Route path="/machines/add" element={<MachineFormPage />} />
              <Route path="/machines/:id" element={<MachineDetailPage />} />

              <Route path="/workshops" element={<WorkshopListPage />} />
              <Route path="/workshops/add" element={<WorkshopFormPage />} />
              <Route path="/workshops/:id" element={<WorkshopDetailPage />} />

              <Route path="/materials" element={<MaterialListPage />} />
              <Route path="/materials/add" element={<MaterialFormPage/>} />
              <Route path="/materials/:id" element={<MaterialDetailPage/>} />

              <Route path="/suppliers" element={<SupplierListPage/>} />
              <Route path="/suppliers/add" element={<SupplierFormPage/>} />
              <Route path="/suppliers/:id" element={<SupplierDetailPage/>} />

              <Route path="/products" element={<ProductListPage />} />
              <Route path="/products/add" element={<ProductFormPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} /> {/* Detail page often handles edit toggle */}
              <Route path="/products/:id/edit" element={<ProductFormPage />} /> {/* Or dedicated edit route */}
              {/* Add other routes like: */}
              {/* <Route path="/skills" element={<SkillsPage />} /> */}
              {/* etc. */}
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
