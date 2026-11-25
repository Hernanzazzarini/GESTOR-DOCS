import { firebaseConfig } from './firebase';

// Configuración para producción (npm run build → firebase deploy).
// Reemplaza a environment.ts solo en el build (ver "fileReplacements" en angular.json).
export const environment = {
  production: true,
  firebase: firebaseConfig,
  // La dirección que te da Render para el back end, terminada en /api
  apiUrl: 'https://gestor-docs-api.onrender.com/api',
};
