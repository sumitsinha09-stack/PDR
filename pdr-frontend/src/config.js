// Centralized API configuration for local and cloud (Amplify / App Runner) deployments
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
