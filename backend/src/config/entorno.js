// Lee y valida las variables del archivo .env (en Render: "Environment").

function requerida(nombre) {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(`Falta la variable ${nombre} en el archivo .env (mirá .env.example).`);
  }
  return valor;
}

export function leerEntorno() {
  return {
    puerto: Number(process.env.PORT ?? 3000),
    // ID de la carpeta "Documentos generales" dentro de la Unidad compartida
    rootFolderId: requerida('ROOT_FOLDER_ID'),
    // Proyecto de Firebase donde están los usuarios (el mismo que usa el front end)
    firebaseProjectId: requerida('FIREBASE_PROJECT_ID'),
    // Ruta al JSON de la Service Account. Nunca se sube a GitHub.
    credenciales: process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || './service-account.json',
    // Direcciones desde las que se permite llamar a la API (separadas por coma)
    origenes: (process.env.ORIGENES_PERMITIDOS ?? 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
