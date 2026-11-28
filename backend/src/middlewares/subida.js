import multer from 'multer';
import { extensionDe, formatoPorExtension, tieneFirma } from '../config/formatos.js';
import { ErrorHttp } from '../servicios/errores.js';

export const TAMANIO_MAXIMO = 20 * 1024 * 1024; // 20 MB (RNF)

const SOLO_FORMATOS = 'Solo se aceptan archivos PDF, Word (.doc, .docx) o Excel (.xls, .xlsx).';

/** multer lee el nombre como latin1: lo pasamos a UTF-8 para que los acentos se vean bien. */
function nombreUtf8(nombre) {
  return Buffer.from(nombre, 'latin1').toString('utf8');
}

// El archivo queda en memoria (no en el disco del servidor) y se manda directo a Drive
const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANIO_MAXIMO, files: 1 },
  fileFilter: (_req, archivo, aceptar) => {
    if (!extensionDe(nombreUtf8(archivo.originalname))) return aceptar(new ErrorHttp(400, SOLO_FORMATOS));
    aceptar(null, true);
  },
});

/**
 * Recibe el campo "archivo" del formulario y comprueba que de verdad sea PDF, Word o Excel (RF-08).
 * Deja en req.file.formato el formato detectado (con el tipo MIME que se guarda en Drive).
 */
export function recibirArchivo(req, res, next) {
  subida.single('archivo')(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(new ErrorHttp(400, 'No llegó ningún archivo.'));

    req.file.originalname = nombreUtf8(req.file.originalname);
    const formato = formatoPorExtension(extensionDe(req.file.originalname));
    if (!tieneFirma(formato, req.file.buffer)) {
      return next(new ErrorHttp(400, `El archivo no es un .${formato.extension} válido.`));
    }
    req.file.formato = formato;
    next();
  });
}
