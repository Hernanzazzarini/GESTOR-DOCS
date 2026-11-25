import cors from 'cors';
import express from 'express';
import { crearControladorDocumentos } from './controllers/documentos.js';
import { manejarErrores } from './middlewares/errores.js';
import { crearRutas } from './routes/index.js';
import { crearServicioDocumentos } from './servicios/documentos.js';

/**
 * Arma la aplicación Express. Recibe las dependencias desde afuera (Drive, verificador de
 * tokens, lector de perfil) para poder probarla sin conectarse a Google.
 */
export function crearApp({ drive, rootFolderId, verificarToken, leerPerfil, origenes }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render está detrás de un proxy

  app.use(
    cors({
      origin(origen, responder) {
        // Sin "origin" = no es un navegador (curl, Postman) o es el mismo sitio
        if (!origen || origenes.includes(origen)) return responder(null, true);
        responder(new Error(`Origen no permitido: ${origen}`));
      },
    }),
  );
  app.use(express.json());

  const documentos = crearServicioDocumentos(drive, rootFolderId);
  const controlador = crearControladorDocumentos(documentos);
  app.use('/api', crearRutas({ controlador, verificarToken, leerPerfil }));

  app.use((_req, res) => res.status(404).json({ mensaje: 'Ruta inexistente.' }));
  app.use(manejarErrores);
  return app;
}
