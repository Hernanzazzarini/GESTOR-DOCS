import { Router } from 'express';
import { autenticar, requiereModulo, requierePermisoEliminar } from '../middlewares/autenticacion.js';
import { recibirArchivo } from '../middlewares/subida.js';

export function crearRutas({ controlador, verificarToken, leerPerfil }) {
  const rutas = Router();

  // Sin login: sirve para "despertar" el servidor de Render y saber si está vivo
  rutas.get('/salud', (_req, res) => res.json({ ok: true }));

  // Todo lo demás exige sesión y el módulo Documentación habilitado
  rutas.use(autenticar({ verificarToken, leerPerfil }), requiereModulo('documentos'));

  rutas.get('/categorias', controlador.categorias);
  rutas.post('/categorias/:categoria/tipos', controlador.agregarTipo);
  rutas.get('/documentos', controlador.listar);
  rutas.post('/documentos', recibirArchivo, controlador.subir);
  rutas.patch('/documentos/:id', controlador.actualizar);
  rutas.get('/documentos/:id/archivo', controlador.descargar);
  rutas.delete('/documentos/:id', requierePermisoEliminar, controlador.eliminar);

  return rutas;
}
