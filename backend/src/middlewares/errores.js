import multer from 'multer';
import { ErrorHttp } from '../servicios/errores.js';

/** Convierte cualquier error en una respuesta JSON { mensaje } que Angular puede mostrar. */
// eslint-disable-next-line no-unused-vars
export function manejarErrores(err, _req, res, _next) {
  if (err instanceof ErrorHttp) {
    return res.status(err.estado).json({ mensaje: err.message });
  }
  if (err instanceof multer.MulterError) {
    const mensaje =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el máximo de 20 MB.'
        : 'No se pudo recibir el archivo.';
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ mensaje });
  }
  if (err?.message?.startsWith('Origen no permitido')) {
    return res.status(403).json({ mensaje: err.message });
  }

  console.error(err);
  const deDrive = err?.response?.data?.error?.message;
  res.status(500).json({
    mensaje: deDrive
      ? `Google Drive respondió: ${deDrive}`
      : 'Ocurrió un error en el servidor. Probá de nuevo en un momento.',
  });
}
