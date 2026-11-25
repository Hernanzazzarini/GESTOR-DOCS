import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Verifica el token que manda Angular (el mismo login de Firebase que en el PCC4).
 * Solo necesita el ID del proyecto: Firebase publica las claves para comprobar los tokens,
 * así que no hace falta otra clave secreta ni el plan pago.
 */
export function crearVerificadorToken(projectId) {
  const app = initializeApp({ projectId }, 'verificador-tokens');
  const auth = getAuth(app);
  return async (token) => {
    const datos = await auth.verifyIdToken(token);
    return { uid: datos.uid, email: datos.email ?? '' };
  };
}

/**
 * Lee el rol y las pantallas de users/{uid} en Firestore usando el token del propio usuario.
 * Las reglas de Firestore ya le permiten leer su documento, así que el servidor no necesita
 * permisos extra sobre Firebase. Se guarda 1 minuto para no consultar en cada pedido.
 */
export function crearLectorPerfil(projectId) {
  const cache = new Map();
  const DURACION_MS = 60 * 1000;

  return async (uid, token) => {
    const guardado = cache.get(uid);
    if (guardado && Date.now() < guardado.vence) return guardado.perfil;

    const url =
      `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore respondió ${res.status} al leer el perfil.`);

    const { fields = {} } = await res.json();
    const valores = fields.pantallas?.arrayValue?.values;
    const perfil = {
      rol: fields.role?.stringValue ?? null,
      pantallas: valores ? valores.map((v) => v.stringValue) : undefined,
    };
    cache.set(uid, { perfil, vence: Date.now() + DURACION_MS });
    return perfil;
  };
}
