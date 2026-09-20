// Centralized API configuration for local and production (Amplify / ECS Fargate + ALB) deployments
const envUrl = import.meta.env.VITE_BACKEND_URL;

function resolveBackendUrl() {
  if (typeof window !== 'undefined') {
    // If running in production browser on HTTPS (e.g. AWS Amplify)
    if (window.location.protocol === 'https:') {
      // If an HTTPS backend is provided, use it
      if (envUrl && envUrl.startsWith('https://')) {
        return envUrl.replace(/\/+$/, '');
      }
      // On Amplify, we have configured reverse proxy rules so relative origin works flawlessly without CORS/mixed content
      if (window.location.hostname.includes('amplifyapp.com')) {
        return '';
      }
      // Fallback to the HTTPS API Gateway proxy
      return 'https://h1ses3prb2.execute-api.eu-north-1.amazonaws.com';
    }
  }

  const raw = envUrl || 'http://localhost:8000';
  return raw.replace(/\/+$/, '');
}

export const BACKEND_URL = resolveBackendUrl();
