import { firebaseConfig } from './firebase';

// Configuración para trabajar en tu Mac (npm start).
export const environment = {
  production: false,
  firebase: firebaseConfig,
  // En tu Mac, /api lo redirige proxy.conf.json al back end en http://localhost:3000
  apiUrl: '/api',
};
