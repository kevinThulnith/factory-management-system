// src/pages/DashboardPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Adjust path
import { StatCard } from '../components/StatCard'; // Adjust path
// --- Charting ---
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';

// Register Chart.js components needed for Bar chart
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);
// --- End Charting ---

// Import API functions - Ideally use an aggregated endpoint
import {
    // getDashboardStats, // << IDEAL: Use this if available
    // Fallback (less efficient):
    listMachines,
    listMaterials,
    listWorkshops,
    listDepartments,
    // listSuppliers // Only if supplier count is needed
} from '../services/api'; // Adjust path
import {
    LayoutDashboardIcon, Building2, Star, Cog, Truck, Box, UserCheck, Wrench, AlertTriangle, PackageMinus, Users, Briefcase, PackageCheck, PackageX, TriangleAlert, Activity, ServerCrash, PauseCircle, CheckCircle // Added CheckCircle
} from 'lucide-react';

// Role Constants
const ROLES = {
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    SUPERVISOR: 'SUPERVISOR',
    OPERATOR: 'OPERATOR',
    TECHNICIAN: 'TECHNICIAN',
    PURCHASING: 'PURCHASING',
};

function DashboardPage() {
    const { user, isAuthenticated } = useAuth();

    // --- State for Dashboard Data & Loading ---
    const [stats, setStats] = useState({
        // Machine Counts
        machineTotal: 0,
        machineOperational: 0,
        machineIdle: 0,
        machineMaintenance: 0,
        machineBroken: 0,
        // Workshop Counts
        workshopTotal: 0,
        workshopActive: 0,
        workshopInactive: 0,
        workshopMaintenance: 0,
        // Department Counts
        departmentTotal: 0,
        departmentsWithoutSupervisor: 0,
        // Material Counts
        materialTotal: 0,
        materialInStock: 0,
        materialLowStock: 0,
        materialOutOfStock: 0,
        // Other Counts
        supplierCount: 0,
        maintenanceDueCount: 0, // Ensure this is also initialized
    });
    const [materialChartData, setMaterialChartData] = useState(null);
    const [assignedMachine, setAssignedMachine] = useState(null); // For Operator
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Determine user role safely
    const userRole = user?.role?.toUpperCase() || null;

    // --- Fetch Dashboard Data ---
    useEffect(() => {
        if (!isAuthenticated || !userRole) {
             setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        let isMounted = true;

        const fetchDataForRole = async () => {
            try {
                // *** IMPORTANT: Replace this section with a single API call
                // *** to your backend `getDashboardStats()` endpoint if possible!
                console.log("Fetching individual lists for dashboard stats (less efficient)...");
                const promisesToFetch = [
                    listMachines(),
                    listMaterials(),
                    listWorkshops(),
                    listDepartments(),
                    // listSuppliers(), // Uncomment if needed
                ];

                const results = await Promise.allSettled(promisesToFetch);
                 if (!isMounted) return;

                 const [
                    machineRes,
                    materialRes,
                    workshopRes,
                    departmentRes,
                    // supplierRes
                 ] = results;


                // Process results and calculate stats
                let machineCount = 0, maintenanceDueCount = 0, myMachine = null;
                let machineOperational = 0, machineIdle = 0, machineMaintenance = 0, machineBroken = 0;
                if (machineRes.status === 'fulfilled' && Array.isArray(machineRes.value?.data)) {
                    const machines = machineRes.value.data;
                    machineCount = machines.length;
                    // Calculate maintenance due count correctly
                    maintenanceDueCount = machines.filter(m => m.next_maintenance_date && new Date(m.next_maintenance_date) <= new Date()).length;
                    machines.forEach(m => {
                        const status = m.status?.toUpperCase();
                        if (status === 'OPERATIONAL') machineOperational++;
                        else if (status === 'IDLE') machineIdle++;
                        else if (status === 'MAINTENANCE' || status === 'UNDER MAINTENANCE') machineMaintenance++;
                        else if (status === 'BROKEN' || status === 'BROKE DOWN') machineBroken++;
                    });
                    if (userRole === ROLES.OPERATOR && user?.id) {
                        myMachine = machines.find(m => m.operator === user.id) || null;
                    }
                } else { console.error("Failed to fetch machines for stats", machineRes.reason); }

                let materialCount = 0, lowStockCount = 0, inStockCount = 0, outOfStockCount = 0;
                 if (materialRes.status === 'fulfilled' && Array.isArray(materialRes.value?.data)) {
                     const materials = materialRes.value.data;
                     materialCount = materials.length;
                     materials.forEach(m => {
                          const qty = parseFloat(m.quantity);
                          const reorder = parseFloat(m.reorder_level);
                          if (isNaN(qty)) return;
                          if (qty <= 0) {
                              outOfStockCount++;
                          } else if (!isNaN(reorder) && qty <= reorder) {
                              lowStockCount++;
                              inStockCount++;
                          } else {
                              inStockCount++;
                          }
                     });
                 } else { console.error("Failed to fetch materials for stats", materialRes.reason); }

                 let workshopCount = 0, workshopActive = 0, workshopInactive = 0, workshopMaintenance = 0;
                 if (workshopRes.status === 'fulfilled' && Array.isArray(workshopRes.value?.data)) {
                     const workshops = workshopRes.value.data;
                     workshopCount = workshops.length;
                     workshops.forEach(w => {
                         const status = w.operational_status?.toUpperCase();
                         if (status === 'ACTIVE' || status === 'OPERATIONAL') workshopActive++;
                         else if (status === 'INACTIVE') workshopInactive++;
                         else if (status === 'MAINTENANCE' || status === 'UNDER MAINTENANCE') workshopMaintenance++;
                     });
                 } else { console.error("Failed to fetch workshops for stats", workshopRes.reason); }

                 let departmentCount = 0, departmentsWithoutSupervisor = 0;
                  if (departmentRes.status === 'fulfilled' && Array.isArray(departmentRes.value?.data)) {
                       const departments = departmentRes.value.data;
                      departmentCount = departments.length;
                      departmentsWithoutSupervisor = departments.filter(d => d.supervisor == null).length;
                  } else { console.error("Failed to fetch departments for stats", departmentRes.reason); }

                // let supplierCount = 0;
                // if (supplierRes.status === 'fulfilled' && Array.isArray(supplierRes.value?.data)) {
                //     supplierCount = supplierRes.value.data.length;
                // } else { console.error("Failed to fetch suppliers for stats", supplierRes.reason); }


                // --- Update State ---
                setStats({
                    machineTotal: machineCount, machineOperational, machineIdle, machineMaintenance, machineBroken,
                    workshopTotal: workshopCount, workshopActive, workshopInactive, workshopMaintenance,
                    departmentTotal: departmentCount, departmentsWithoutSupervisor,
                    materialTotal: materialCount, materialInStock: inStockCount, materialLowStock: lowStockCount, materialOutOfStock: outOfStockCount,
                    // supplierCount,
                    maintenanceDueCount: maintenanceDueCount, // Make sure this is set
                });
                setAssignedMachine(myMachine);

                 // --- Prepare Chart Data ---
                 setMaterialChartData({
                     labels: ['In Stock', 'Low Stock', 'Out of Stock'],
                     datasets: [{
                         label: 'Material Stock Status',
                         data: [inStockCount, lowStockCount, outOfStockCount],
                         backgroundColor: ['rgba(34, 197, 94, 0.6)', 'rgba(249, 115, 22, 0.6)', 'rgba(239, 68, 68, 0.6)',],
                         borderColor: ['rgba(22, 163, 74, 1)', 'rgba(217, 70, 29, 1)', 'rgba(220, 38, 38, 1)',],
                         borderWidth: 1,
                     }],
                 });

                 // Check for overall fetch errors
                if (results.some(res => res.status === 'rejected')) {
                    // Check if specific essential data failed, or just show a general warning
                     if (machineRes.status === 'rejected' || materialRes.status === 'rejected') {
                         setError("Core dashboard data failed to load.");
                     } else {
                         setError("Some dashboard data failed to load.");
                     }
                }

            } catch (err) {
                 if (!isMounted) return;
                console.error("Error fetching dashboard data:", err);
                setError("Failed to load dashboard data. Please try again later.");
                // Reset stats on critical error
                setStats({ machineTotal: 0, workshopTotal: 0, departmentTotal: 0, supplierCount: 0, materialTotal: 0, lowStockCount: 0, maintenanceDueCount: 0, machineOperational: 0, machineIdle: 0, machineMaintenance: 0, machineBroken: 0, workshopActive: 0, workshopInactive: 0, workshopMaintenance: 0, departmentsWithoutSupervisor: 0, materialInStock: 0, materialOutOfStock: 0 });
                setMaterialChartData(null);
            } finally {
                 if (isMounted) setLoading(false);
            }
        };

        fetchDataForRole();

        return () => { isMounted = false; }; // Cleanup

    }, [isAuthenticated, userRole, user?.id]); // Dependencies

    // --- Loading and Error States ---
    if (!isAuthenticated) { return <div className="p-8 text-center text-gray-500">Please log in to view the dashboard.</div>; }
    if (loading) {
        // Using div-based skeletons
        return ( <div className="p-4 md:p-6 lg:p-8 animate-pulse"> <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div> <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"> {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-lg bg-gray-200"></div>)} </div> <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6"> <div className="h-24 rounded-lg bg-gray-200"></div> <div className="h-24 rounded-lg bg-gray-200"></div> </div> <div className="mt-8"> <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div> <div className="space-y-3"> <div className="h-5 w-full rounded-md bg-gray-200"></div> <div className="h-5 w-full rounded-md bg-gray-200"></div> </div> </div> </div> );
    }
     if (error && !loading) { // Show error only after loading finishes
         return <div className="m-8 p-4 text-center text-red-700 bg-red-100 border border-red-200 rounded-md shadow"><AlertTriangle className="inline-block mr-2 h-5 w-5"/> {error}</div>;
     }

    // --- Role-Based Access Control Helper ---
    const canView = (allowedRoles) => { if (!userRole) return false; const rolesToCheck = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]; return rolesToCheck.includes(userRole); };

    // --- Conditional Card Styling ---
     const machineCardClass = stats.machineBroken > 0 ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse-fast' : stats.machineMaintenance > 0 ? 'border-l-4 border-yellow-500' : 'border-l-4 border-transparent';
     const materialCardClass = stats.materialOutOfStock > 0 ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse-fast' : stats.materialLowStock > 0 ? 'ring-2 ring-orange-400 ring-offset-2 animate-pulse' : 'border-l-4 border-transparent';

    // --- Chart Options ---
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Material Stock Overview', font: { size: 16 } }, tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw}` } } },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Items' } } }
    };

    // --- Main Render ---
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8">
            <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
            <p className="text-lg text-gray-600">Welcome back, <span className="font-semibold">{user?.name || 'User'}</span>!</p>

            {/* --- Stat Cards Section (Visible to Admin/Manager) --- */}
            {canView([ROLES.ADMIN, ROLES.MANAGER]) && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                     {/* Machine Card */}
                     <StatCard title="Total Machines" value={stats.machineTotal} icon={<Cog className="text-blue-500" />} linkTo="/machines" extraClasses={machineCardClass} >
                          <div className="text-xs mt-2 space-y-0.5 text-gray-600 pt-1 border-t border-gray-200">
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><CheckCircle size={12} className="mr-1 text-green-500 flex-shrink-0"/> Operational:</span> <span className="font-medium">{stats.machineOperational}</span></p>
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><PauseCircle size={12} className="mr-1 text-sky-500 flex-shrink-0"/> Idle:</span> <span className="font-medium">{stats.machineIdle}</span></p>
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><Wrench size={12} className="mr-1 text-yellow-500 flex-shrink-0"/> Maintenance:</span> <span className="font-medium">{stats.machineMaintenance}</span></p>
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><ServerCrash size={12} className="mr-1 text-red-500 flex-shrink-0"/> Broken:</span> <span className="font-medium">{stats.machineBroken}</span></p>
                          </div>
                     </StatCard>
                     {/* Workshop Card */}
                      <StatCard title="Workshops" value={stats.workshopTotal} icon={<Building2 className="text-green-500" />} linkTo="/workshops" >
                           <div className="text-xs mt-2 space-y-0.5 text-gray-600 pt-1 border-t border-gray-200">
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><Activity size={12} className="mr-1 text-green-500 flex-shrink-0"/> Active:</span> <span className="font-medium">{stats.workshopActive}</span></p>
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><PauseCircle size={12} className="mr-1 text-gray-500 flex-shrink-0"/> Inactive:</span> <span className="font-medium">{stats.workshopInactive}</span></p>
                                {stats.workshopMaintenance > 0 && <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><Wrench size={12} className="mr-1 text-yellow-500 flex-shrink-0"/> Maintenance:</span> <span className="font-medium">{stats.workshopMaintenance}</span></p>}
                           </div>
                      </StatCard>
                     {/* Department Card */}
                     <StatCard title="Departments" value={stats.departmentTotal} icon={<Briefcase className="text-indigo-500" />} linkTo="/departments" extraClasses={stats.departmentsWithoutSupervisor > 0 ? 'border-l-4 border-orange-400' : 'border-l-4 border-transparent'} >
                          <div className="text-xs mt-2 space-y-0.5 text-gray-600 pt-1 border-t border-gray-200">
                              {stats.departmentsWithoutSupervisor > 0 ? ( <p className="flex items-center text-orange-600 text-[14px]"><AlertTriangle size={12} className="mr-1"/> Needs Supervisor: <span className="font-medium ml-auto">{stats.departmentsWithoutSupervisor}</span></p> )
                              : ( <p className="flex items-center text-green-600 text-[14px]"><UserCheck size={12} className="mr-1"/> All Assigned</p> )}
                          </div>
                     </StatCard>
                     {/* Material Card */}
                      <StatCard title="Total Materials" value={stats.materialTotal} icon={<Box className="text-purple-500" />} linkTo="/materials" extraClasses={materialCardClass} >
                          <div className="text-xs mt-2 space-y-0.5 text-gray-600 pt-1 border-t border-gray-200">
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><PackageCheck size={12} className="mr-1 text-green-500 flex-shrink-0"/> In Stock:</span> <span className="font-medium">{stats.materialInStock}</span></p>
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><TriangleAlert size={12} className="mr-1 text-orange-500 flex-shrink-0"/> Low Stock:</span> <span className="font-medium">{stats.materialLowStock}</span></p>
                               <p className="flex items-center justify-between text-[14px]"><span className="flex items-center"><PackageX size={12} className="mr-1 text-red-500 flex-shrink-0"/> Out of Stock:</span> <span className="font-medium">{stats.materialOutOfStock}</span></p>
                          </div>
                      </StatCard>
                 </div>
            )}

             {/* --- Alert Sections & Chart --- */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Maintenance Alert Box (Technician only if not Admin/Manager) */}
                 {canView(ROLES.TECHNICIAN) && !canView([ROLES.ADMIN, ROLES.MANAGER]) && (
                      <div className={`bg-white p-5 rounded-lg shadow border-l-4 ${stats.maintenanceDueCount > 0 ? 'border-yellow-500' : 'border-gray-300'}`}>
                           <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center"> <Wrench className={`mr-2 ${stats.maintenanceDueCount > 0 ? 'text-yellow-600' : 'text-gray-400'}`}/> Maintenance Alerts </h3> {stats.maintenanceDueCount > 0 ? ( <Link to="/machines?status=maintenance_due" className="text-yellow-700 hover:underline font-medium flex items-center"> <AlertTriangle className="h-4 w-4 mr-1"/> {stats.maintenanceDueCount} machine(s) need maintenance. </Link> ) : ( <p className="text-sm text-gray-500">No maintenance currently required.</p> )}
                      </div>
                 )}
                 {/* Low Stock Alert Box (Purchasing only if not Admin/Manager) */}
                  {canView(ROLES.PURCHASING) && !canView([ROLES.ADMIN, ROLES.MANAGER]) && (
                      <div className={`bg-white p-5 rounded-lg shadow border-l-4 ${stats.lowStockCount > 0 || stats.materialOutOfStock > 0 ? 'border-orange-500' : 'border-gray-300'}`}>
                            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center"> <PackageMinus className={`mr-2 ${stats.lowStockCount > 0 || stats.materialOutOfStock > 0 ? 'text-orange-600' : 'text-gray-400'}`}/> Inventory Alerts </h3>
                            {stats.lowStockCount > 0 || stats.materialOutOfStock > 0 ? (
                                <div className='space-y-1'>
                                     {stats.lowStockCount > 0 && <Link to="/materials?status=low_stock" className="text-orange-700 hover:underline font-medium flex items-center"> <TriangleAlert size={16} className="mr-1"/> {stats.lowStockCount} material(s) low on stock. </Link>}
                                     {stats.materialOutOfStock > 0 && <Link to="/materials?status=out_of_stock" className="text-red-700 hover:underline font-medium flex items-center"> <PackageX size={16} className="mr-1"/> {stats.materialOutOfStock} material(s) out of stock. </Link>}
                                </div>
                            ) : ( <p className="text-sm text-gray-500">Material stock levels are adequate.</p> )}
                      </div>
                  )}

                 {/* Material Stock Chart (Visible to Admin, Manager, Purchasing) */}
                 {canView([ROLES.ADMIN, ROLES.MANAGER, ROLES.PURCHASING]) && materialChartData && (
                     <div className="bg-white p-5 rounded-lg shadow border border-gray-200 md:col-span-2">
                         <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">Material Inventory Overview</h3>
                         <div className="relative h-64 md:h-72 w-full max-w-2xl mx-auto">
                            <Bar options={chartOptions} data={materialChartData} />
                         </div>
                     </div>
                 )}
             </div>


            {/* --- Role-Specific Quick Access / Info --- */}
            <div className="space-y-6">
                {/* Management Links Card (Admin/Manager) */}
                {canView([ROLES.ADMIN, ROLES.MANAGER]) && (
                     <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                          <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"> <LayoutDashboardIcon className="mr-2 text-gray-600"/> Management Quick Links </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
                               <Link to="/departments" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Briefcase size={16}/> Departments</Link>
                               <Link to="/workshops" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Building2 size={16}/> Workshops</Link>
                               <Link to="/machines" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Cog size={16}/> Machines</Link>
                               <Link to="/materials" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Box size={16}/> Materials</Link>
                               <Link to="/suppliers" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Truck size={16}/> Suppliers</Link>
                               <Link to="/skills" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Star size={16}/> Skills</Link>
                               {userRole === ROLES.ADMIN && <Link to="/register" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Users size={16}/> Register User</Link>}
                          </div>
                     </div>
                 )}
                 {/* Supervisor Card */}
                 {canView(ROLES.SUPERVISOR) && (
                      <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                           <h3 className="text-lg font-semibold text-gray-700 mb-3">Supervisor Area</h3>
                           <p className="text-sm text-gray-600 mb-4">Quick links for your team.</p>
                           <div className="flex flex-wrap gap-4 text-sm">
                                <Link to="/machines" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Cog size={16}/> View Machines</Link>
                                <Link to="/skills" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Star size={16}/> View Skill Matrix</Link>
                           </div>
                      </div>
                 )}
                  {/* Operator Card */}
                 {canView(ROLES.OPERATOR) && (
                      <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                           <h3 className="text-lg font-semibold text-gray-700 mb-3">Your Assigned Machine</h3>
                           {assignedMachine ? ( <div> <p className="text-sm text-gray-800"> Assigned to: <Link to={`/machines/${assignedMachine.id}`} className="font-semibold text-blue-600 hover:underline">{assignedMachine.name || `Machine ID ${assignedMachine.id}`}</Link> </p> <div className="mt-3"> <Link to={`/machines/${assignedMachine.id}`} className="text-sm text-blue-600 hover:underline font-medium">View Details</Link> </div> </div> ) : ( <p className="text-sm text-gray-500">You are not currently assigned to a specific machine.</p> )}
                      </div>
                 )}
                 {/* Technician Card (Links Only) */}
                 {canView(ROLES.TECHNICIAN) && !canView([ROLES.ADMIN, ROLES.MANAGER]) && (
                      <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                           <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center"><Wrench className="mr-2 text-gray-600"/> Technician Area</h3>
                           <p className="text-sm text-gray-600 mb-4">Quick access to maintenance information.</p>
                           <div className="flex flex-wrap gap-4 text-sm">
                               <Link to="/machines" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Cog size={16}/> View All Machines</Link>
                               {/* Link to maintenance specific view */}
                               <Link to="/machines?status=maintenance_due" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><AlertTriangle size={16} className="text-yellow-600"/> Maintenance Due ({stats.maintenanceDueCount})</Link>
                           </div>
                      </div>
                 )}
                  {/* Purchasing Card (Links Only) */}
                 {canView(ROLES.PURCHASING) && !canView([ROLES.ADMIN, ROLES.MANAGER]) &&(
                      <div className="bg-white p-5 rounded-lg shadow border border-gray-200">
                           <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center"><Box className="mr-2 text-gray-600"/> Purchasing Area</h3>
                            <p className="text-sm text-gray-600 mb-4">Manage materials and suppliers.</p>
                           <div className="flex flex-wrap gap-4 text-sm">
                                <Link to="/materials" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Box size={16}/> View Materials</Link>
                                <Link to="/suppliers" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><Truck size={16}/> View Suppliers</Link>
                                {/* Link to low stock view */}
                                <Link to="/materials?status=low_stock" className="text-blue-600 hover:underline font-medium flex items-center gap-1.5 p-2 rounded hover:bg-gray-100"><PackageMinus size={16} className="text-orange-600"/> Low Stock ({stats.lowStockCount})</Link>
                           </div>
                      </div>
                 )}
            </div>

        </div>
    );
}

export default DashboardPage;