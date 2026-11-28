import { Router } from 'express';
import { MODULOS_API } from '../config/permisos.js';
import { autenticar, requiereModulo, requierePermisoEliminar } from '../middlewares/autenticacion.js';
import { recibirArchivo } from '../middlewares/subida.js';

export function crearRutas({ controlador, verificarToken, leerPerfil }) {
  const rutas = Router();

  // Sin login: sirve para "despertar" el servidor de Render y saber si está vivo
  rutas.get('/salud', (_req, res) => res.json({ ok: true }));

  // Todo lo demás exige sesión y al menos un módulo (Documentación o Procedimientos generales).
  // El de cada categoría lo controla el controlador.
  rutas.use(autenticar({ verificarToken, leerPerfil }), requiereModulo(MODULOS_API));

  rutas.get('/categorias', controlador.categorias);
  rutas.post('/categorias/:categoria/tipos', controlador.agregarTipo);
  rutas.get('/documentos', controlador.listar);
  rutas.post('/documentos', recibirArchivo, controlador.subir);
  rutas.patch('/documentos/:id', controlador.actualizar);
  rutas.get('/documentos/:id/archivo', controlador.descargar);
  rutas.delete('/documentos/:id', requierePermisoEliminar, controlador.eliminar);

  return rutas;
}
