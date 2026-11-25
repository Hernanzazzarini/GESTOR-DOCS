import multer from 'multer';
import { ErrorHttp } from '../servicios/errores.js';

export const TAMANIO_MAXIMO = 20 * 1024 * 1024; // 20 MB (RNF)

// El archivo queda en memoria (no en el disco del servidor) y se manda directo a Drive
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANIO_MAXIMO, files: 1 },
  fileFilter: (_req, archivo, aceptar) => {
    if (archivo.mimetype !== 'application/pdf') {
      return aceptar(new ErrorHttp(400, 'Solo se aceptan archivos PDF.'));
    }
    aceptar(null, true);
  },
});

/** Recibe el campo "archivo" del formulario y comprueba que de verdad sea un PDF (RF-08). */
export function recibirPdf(req, res, next) {
  subida.single('archivo')(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(new ErrorHttp(400, 'No llegó ningún archivo.'));

    // La extensión o el tipo los puede falsear cualquiera: todo PDF empieza con "%PDF-"
    if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return next(new ErrorHttp(400, 'El archivo no es un PDF válido.'));
    }
    // multer lee el nombre como latin1: lo pasamos a UTF-8 para que los acentos se vean bien
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    next();
  });
}
