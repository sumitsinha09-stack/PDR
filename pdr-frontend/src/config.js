// Centralized API configuration for local and production (Amplify / ECS Fargate + ALB) deployments
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
export const BACKEND_URL = rawBackendUrl.replace(/\/+$/, '');

