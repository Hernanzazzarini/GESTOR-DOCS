import { CATEGORIAS } from '../config/categorias.js';
import { puedeEditar, puedeEliminar, puedeVerCategoria } from '../config/permisos.js';
import { validarDatos } from '../servicios/datos-documento.js';
import { ErrorHttp } from '../servicios/errores.js';

const ID_VALIDO = /^[\w-]{10,}$/;

function validarId(id) {
  if (!ID_VALIDO.test(id)) throw new ErrorHttp(400, 'ID de documento inválido.');
}

function exigirCategoria(perfil, categoria) {
  if (!puedeVerCategoria(perfil, categoria)) throw new ErrorHttp(403, 'No tenés habilitado este módulo.');
}

/**
 * Para un archivo ya subido la categoría sale del nombre de su carpeta en Drive.
 * Una carpeta que no está en config/categorias.js se trata como de Documentación.
 */
function permitirPara(perfil) {
  return (nombreCategoria) => puedeVerCategoria(perfil, CATEGORIAS.find((c) => c.nombre === nombreCategoria));
}

/** En Procedimientos generales se piden más datos y el área es el área de uso (la carpeta). */
function opcionesDatos(categoria, nombreTipo) {
  return categoria?.procedimiento ? { procedimiento: true, area: nombreTipo } : {};
}

export function crearControladorDocumentos(documentos, tipos) {
  /**
   * El front end solo manda los ids de categoría y tipo (nunca un ID de carpeta):
   * acá se validan contra la configuración y los tipos agregados (RNF "Validación en servidor").
   * También se controla que el usuario tenga el módulo de esa categoría.
   */
  async function validarCategoriaYTipo(perfil, categoriaId, tipoId) {
    const encontrado = await tipos.buscar(String(categoriaId ?? ''), String(tipoId ?? ''));
    if (!encontrado) throw new ErrorHttp(400, 'La categoría o el tipo no existen.');
    exigirCategoria(perfil, encontrado.categoria);
    return encontrado;
  }

  return {
    // GET /api/categorias  (solo las de los módulos que el usuario tiene habilitados)
    async categorias(req, res) {
      const perfil = req.usuario.perfil;
      res.json({
        categorias: (await tipos.categorias()).filter((c) => puedeVerCategoria(perfil, c)),
        puedeEliminar: puedeEliminar(perfil),
        email: req.usuario.email, // para saber qué documentos puede editar
      });
    },

    // POST /api/categorias/:categoria/tipos  { nombre }  → el tipo creado (409 si el nombre ya existe)
    async agregarTipo(req, res) {
      const categoria = CATEGORIAS.find((c) => c.id === req.params.categoria);
      if (categoria) exigirCategoria(req.usuario.perfil, categoria);
      res.status(201).json(await tipos.agregar(req.params.categoria, req.body?.nombre));
    },

    // GET /api/documentos?categoria=&tipo=
    async listar(req, res) {
      const { categoria, tipo } = await validarCategoriaYTipo(req.usuario.perfil, req.query.categoria, req.query.tipo);
      res.json(await documentos.listar(categoria, tipo));
    },

    // POST /api/documentos
    // multipart: archivo, categoria, tipo, nombre?, area, fechaRealizacion, fechaVencimiento?,
    //            responsable (mail), diasAviso ("30,7,0"), avisar ("a@x.com,b@x.com")
    // Procedimientos generales, además: codigo, realizo, revision, estadoUso ("en-uso" | "obsoleto"),
    //            copias, areasImpresion ("Depósito,Planta") — el área es el área de uso (el tipo)
    async subir(req, res) {
      const { categoria, tipo } = await validarCategoriaYTipo(req.usuario.perfil, req.body?.categoria, req.body?.tipo);
      const { nombre, datos } = validarDatos(req.body, req.file.originalname, opcionesDatos(categoria, tipo.nombre));
      const doc = await documentos.subir(
        categoria,
        tipo,
        { nombre, contenido: req.file.buffer, mime: req.file.formato.mime, datos },
        req.usuario.email,
      );
      res.status(201).json(doc);
    },

    // PATCH /api/documentos/:id  (JSON con los mismos datos que al subir)
    async actualizar(req, res) {
      validarId(req.params.id);
      const permitir = permitirPara(req.usuario.perfil);
      const { ubicacion, ...actual } = await documentos.obtener(req.params.id, permitir);
      if (!puedeEditar(req.usuario.perfil, req.usuario.email, actual)) {
        throw new ErrorHttp(403, 'Solo pueden editarlo quien lo subió, el responsable, un encargado o un admin.');
      }
      const categoria = CATEGORIAS.find((c) => c.nombre === ubicacion.categoria);
      const validado = validarDatos(req.body, actual.nombre, opcionesDatos(categoria, ubicacion.tipo));
      res.json(await documentos.actualizar(req.params.id, validado, permitir));
    },

    // GET /api/documentos/:id/archivo             → el archivo, para verlo en el navegador (PDF)
    // GET /api/documentos/:id/archivo?descargar=1 → el mismo archivo, para guardarlo en la compu
    async descargar(req, res) {
      validarId(req.params.id);
      const { nombre, mime, flujo } = await documentos.descargar(req.params.id, permitirPara(req.usuario.perfil));
      const modo = req.query.descargar ? 'attachment' : 'inline';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `${modo}; filename*=UTF-8''${encodeURIComponent(nombre)}`);
      flujo.on('error', (err) => res.destroy(err));
      flujo.pipe(res);
    },

    // DELETE /api/documentos/:id
    async eliminar(req, res) {
      validarId(req.params.id);
      await documentos.eliminar(req.params.id, permitirPara(req.usuario.perfil));
      res.status(204).end();
    },
  };
}
