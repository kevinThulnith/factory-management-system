import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Create an Axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- Request Interceptor ---
// Add Authorization header before sending requests
api.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            config.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// --- Response Interceptor ---
// Handle token expiration and refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => {
        return response; // If response is successful, just return it
    },
    async (error) => {
        const originalRequest = error.config;

        // Check if error is 401 and it's not a retry request and not the refresh token endpoint
        if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/token/refresh/') {
            if (isRefreshing) {
                // If already refreshing, queue the original request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return api(originalRequest); // Retry with new token
                }).catch(err => {
                     // Ensure queue is processed even if retrying the queued request fails
                     processQueue(err, null);
                    return Promise.reject(err); // Refresh failed or subsequent retry failed
                });
            }

            originalRequest._retry = true; // Mark as retry
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                console.error("No refresh token available.");
                 // Redirect to login or handle logout state
                 window.location.href = '/login'; // Simple redirect
                 // Ensure isRefreshing is reset and queue is processed on failure
                 isRefreshing = false;
                 processQueue(new Error("No refresh token available"), null);
                return Promise.reject(error);
            }

            try {
                console.log("Attempting token refresh...");
                const response = await axios.post(`${API_BASE_URL}/token/refresh/`, {
                    refresh: refreshToken
                });
                const newAccessToken = response.data.access;
                console.log("Token refresh successful.");
                localStorage.setItem('accessToken', newAccessToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                processQueue(null, newAccessToken);
                return api(originalRequest); // Retry original request

            } catch (refreshError) {
                console.error("Refresh token failed:", refreshError);
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                 window.location.href = '/login';
                processQueue(refreshError, null);
                return Promise.reject(refreshError); // Reject with the refresh error

            } finally {
                console.log("Resetting isRefreshing flag.");
                isRefreshing = false;
            }
        }

        // For other errors, just reject
        return Promise.reject(error);
    }
);


// --- API Functions ---

// Auth
export const registerUser = (userData) => api.post('/user/register/', userData);
export const getToken = (credentials) => api.post('/token/', credentials);
export const refreshToken = (refresh) => api.post('/token/refresh/', { refresh });
export const blacklistToken = (refresh) => api.post('/token/blacklist/', { refresh });

// User
export const getUserInfo = () => api.get('/user/'); // Gets current logged-in user
// --- ADDED listUsers function ---
// NOTE: Assumes a '/users/' endpoint exists. Verify with your backend API.
export const listUsers = () => api.get('/users/'); // Gets a list of all users (permissions may apply)
// --- End ADDED listUsers function ---
export const getUserDetail = (userId) => api.get(`/user/${userId}/`); // Gets details for a specific user

// --- Skill Matrix ---
export const listSkills = () => api.get('/skill/');
export const createSkill = (data) => api.post('/skill/', data);
export const getSkillDetail = (id) => api.get(`/skill/${id}/`);
export const updateSkill = (id, data) => api.put(`/skill/${id}/`, data);
export const deleteSkill = (id) => api.delete(`/skill/${id}/`);

// --- Department ---
export const listDepartments = () => api.get('/department/');
export const createDepartment = (data) => api.post('/department/', data);
export const getDepartmentDetail = (id) => api.get(`/department/${id}/`);
export const updateDepartment = (id, data) => api.put(`/department/${id}/`, data);
export const deleteDepartment = (id) => api.delete(`/department/${id}/`);

// --- Workshop ---
export const listWorkshops = () => api.get('/workshop/');
export const createWorkshop = (data) => api.post('/workshop/', data);
export const getWorkshop = (id) => api.get(`/workshop/${id}/`);
export const updateWorkshop = (id, data) => api.put(`/workshop/${id}/`, data);
export const deleteWorkshop = (id) => api.delete(`/workshop/${id}/`);

// --- Machine ---
export const listMachines = () => api.get('/machine/');
export const createMachine = (data) => api.post('/machine/', data);
export const getMachine = (id) => api.get(`/machine/${id}/`);
export const updateMachine = (id, data) => api.put(`/machine/${id}/`, data);
export const deleteMachine = (id) => api.delete(`/machine/${id}/`);

// --- Supplier ---
export const listSuppliers = () => api.get('/supplier/');
export const createSupplier = (data) => api.post('/supplier/', data);
export const getSupplierDetail = (id) => api.get(`/supplier/${id}/`);
export const updateSupplier = (id, data) => api.put(`/supplier/${id}/`, data);
export const deleteSupplier = (id) => api.delete(`/supplier/${id}/`);

// --- Material ---
export const listMaterials = () => api.get('/material/');
export const createMaterial = (data) => api.post('/material/', data);
export const getMaterialDetail = (id) => api.get(`/material/${id}/`);
export const updateMaterial = (id, data) => api.put(`/material/${id}/`, data);
export const deleteMaterial = (id) => api.delete(`/material/${id}/`);


export default api; // Export the configured instance for direct use if needed