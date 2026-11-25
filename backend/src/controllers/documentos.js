import { CATEGORIAS, buscarCategoriaYTipo } from '../config/categorias.js';
import { puedeEditar, puedeEliminar } from '../config/permisos.js';
import { validarDatos } from '../servicios/datos-documento.js';
import { ErrorHttp } from '../servicios/errores.js';

const ID_VALIDO = /^[\w-]{10,}$/;

/**
 * El front end solo manda los ids de categoría y tipo (nunca un ID de carpeta):
 * acá se validan contra la configuración (RNF "Validación en servidor").
 */
function validarCategoriaYTipo(categoriaId, tipoId) {
  const encontrado = buscarCategoriaYTipo(String(categoriaId ?? ''), String(tipoId ?? ''));
  if (!encontrado) throw new ErrorHttp(400, 'La categoría o el tipo no existen.');
  return encontrado;
}

function validarId(id) {
  if (!ID_VALIDO.test(id)) throw new ErrorHttp(400, 'ID de documento inválido.');
}

export function crearControladorDocumentos(documentos) {
  return {
    // GET /api/categorias
    categorias(req, res) {
      res.json({
        categorias: CATEGORIAS,
        puedeEliminar: puedeEliminar(req.usuario.perfil),
        email: req.usuario.email, // para saber qué documentos puede editar
      });
    },

    // GET /api/documentos?categoria=&tipo=
    async listar(req, res) {
      const { categoria, tipo } = validarCategoriaYTipo(req.query.categoria, req.query.tipo);
      res.json(await documentos.listar(categoria, tipo));
    },

    // POST /api/documentos
    // multipart: archivo, categoria, tipo, nombre?, area, fechaRealizacion, fechaVencimiento?,
    //            responsable (mail), diasAviso ("30,7,0"), avisar ("a@x.com,b@x.com")
    async subir(req, res) {
      const { categoria, tipo } = validarCategoriaYTipo(req.body?.categoria, req.body?.tipo);
      const { nombre, datos } = validarDatos(req.body, req.file.originalname);
      const doc = await documentos.subir(
        categoria,
        tipo,
        { nombre, contenido: req.file.buffer, datos },
        req.usuario.email,
      );
      res.status(201).json(doc);
    },

    // PATCH /api/documentos/:id  (JSON con los mismos datos que al subir)
    async actualizar(req, res) {
      validarId(req.params.id);
      const actual = await documentos.obtener(req.params.id);
      if (!puedeEditar(req.usuario.perfil, req.usuario.email, actual)) {
        throw new ErrorHttp(403, 'Solo pueden editarlo quien lo subió, el responsable, un encargado o un admin.');
      }
      res.json(await documentos.actualizar(req.params.id, validarDatos(req.body, actual.nombre)));
    },

    // GET /api/documentos/:id/archivo  → el PDF, para verlo en el navegador
    async descargar(req, res) {
      validarId(req.params.id);
      const { nombre, flujo } = await documentos.descargar(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`);
      flujo.on('error', (err) => res.destroy(err));
      flujo.pipe(res);
    },

    // DELETE /api/documentos/:id
    async eliminar(req, res) {
      validarId(req.params.id);
      await documentos.eliminar(req.params.id);
      res.status(204).end();
    },
  };
}
