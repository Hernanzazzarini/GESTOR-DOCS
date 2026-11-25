import { existsSync } from 'node:fs';
import { google } from 'googleapis';

/** Cliente de Google Drive autenticado con la Service Account (las credenciales nunca salen del servidor). */
export function crearClienteDrive(rutaCredenciales) {
  if (!existsSync(rutaCredenciales)) {
    throw new Error(
      `No se encontró la clave de la Service Account en "${rutaCredenciales}". ` +
        'Copiá el JSON que descargaste de Google Cloud a esa ruta (o cambiá GOOGLE_APPLICATION_CREDENTIALS).',
    );
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: rutaCredenciales,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}
