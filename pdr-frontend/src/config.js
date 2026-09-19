// Centralized API configuration for local and cloud (Amplify / App Runner) deployments
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

