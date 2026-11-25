// ⚙️ Datos del proyecto de Firebase. Se completan UNA vez y los usan los dos entornos.
// Se copian de la consola de Firebase: ⚙️ Configuración del proyecto → General →
// Tus apps → App web → "Configuración del SDK" (opción "Config").
// No son secretos: están pensados para ir en el navegador. La seguridad la dan el login
// y las reglas de Firestore (firestore.rules), igual que en el PCC4.
export const firebaseConfig = {
  apiKey: 'AIzaSyDz2joLNuuXrMJKsOzsHnSJMHtCKYBGKDM',
  authDomain: 'gestor-documentacion.firebaseapp.com',
  projectId: 'gestor-documentacion',
  storageBucket: 'gestor-documentacion.firebasestorage.app',
  messagingSenderId: '954456684894',
  appId: '1:954456684894:web:ac75174cfb5967e93cb7cf',
};
