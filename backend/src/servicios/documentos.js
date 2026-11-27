import { Readable } from 'node:stream';
import { MIMES, formatoPorMime } from '../config/formatos.js';
import { ES_ANIO, crearServicioCarpetas } from './carpetas.js';
import { ErrorHttp, esNoEncontrado } from './errores.js';
import { aPropiedades, desdePropiedades } from './datos-documento.js';

const CAMPOS_DOC = 'id, name, mimeType, size, createdTime, properties, appProperties';
// PDF, Word o Excel (config/formatos.js)
const CONSULTA_FORMATOS = `(${MIMES.map((m) => `mimeType = '${m}'`).join(' or ')})`;

export function crearServicioDocumentos(drive, rootFolderId, carpetas = crearServicioCarpetas(drive)) {

  /** Reintenta una vez si Drive dice 404 (una carpeta guardada en memoria ya no existe). */
  async function conReintento(fn) {
    try {
      return await fn();
    } catch (err) {
      if (!esNoEncontrado(err)) throw err;
      carpetas.olvidar();
      return fn();
    }
  }

  // Los datos de cada documento (área, fechas, responsable, avisos) viajan con el PDF en Drive:
  // ver datos-documento.js
  function aDocumento(f) {
    return {
      id: f.id,
      nombre: f.name,
      formato: formatoPorMime(f.mimeType)?.extension ?? 'pdf', // "pdf", "docx", "xlsx"…
      tamanio: Number(f.size ?? 0),
      fecha: f.createdTime,
      ...desdePropiedades(f),
    };
  }

  const NINGUNA = { id: null, name: '', parents: [] };

  /** Carpeta padre de algo. Si no existe (o no se puede subir más), devuelve NINGUNA: queda "afuera". */
  async function carpeta(id) {
    if (!id) return NINGUNA;
    try {
      const { data } = await drive.files.get({ fileId: id, supportsAllDrives: true, fields: 'id, name, parents' });
      return data;
    } catch (err) {
      if (esNoEncontrado(err)) return NINGUNA;
      throw err;
    }
  }

  /**
   * Comprueba que el archivo es un PDF que está en Documentos generales / Categoría / Tipo / Año
   * (o directo en el Tipo, como se guardaban antes de separar por año).
   * Así nadie puede abrir o borrar otro archivo de la Unidad compartida adivinando su ID.
   * Devuelve { archivo, tipoId }.
   */
  async function verificarUbicacion(id) {
    try {
      const { data: archivo } = await drive.files.get({
        fileId: id,
        supportsAllDrives: true,
        fields: `${CAMPOS_DOC}, trashed, parents`,
      });
      if (archivo.trashed || !MIMES.includes(archivo.mimeType)) throw new ErrorHttp(404, 'El documento no existe.');

      const padre = await carpeta(archivo.parents?.[0]);
      const abuelo = await carpeta(padre.parents?.[0]);
      const bisabuelo = await carpeta(abuelo.parents?.[0]);
      // Sin año: padre = tipo, abuelo = categoría, bisabuelo = raíz
      if (bisabuelo.id === rootFolderId) return { archivo, tipoId: padre.id };
      // Con año: padre = año, abuelo = tipo, bisabuelo = categoría
      if (ES_ANIO.test(padre.name) && bisabuelo.parents?.[0] === rootFolderId) {
        return { archivo, tipoId: abuelo.id };
      }
      throw new ErrorHttp(403, 'Ese archivo no pertenece a Documentos generales.');
    } catch (err) {
      if (esNoEncontrado(err)) throw new ErrorHttp(404, 'El documento no existe.');
      throw err;
    }
  }

  return {
    async listar(categoria, tipo) {
      return conReintento(async () => {
        const tipoId = await carpetas.carpetaExistente(rootFolderId, categoria, tipo);
        if (!tipoId) return []; // todavía no se subió nada de este tipo
        // Los PDFs están en las carpetas de cada año (y los más viejos, sueltos en el tipo)
        const padres = [tipoId, ...(await carpetas.carpetasAnio(tipoId))];
        const res = await drive.files.list({
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: 'allDrives',
          q: `(${padres.map((id) => `'${id}' in parents`).join(' or ')}) and ${CONSULTA_FORMATOS} and trashed = false`,
          fields: `files(${CAMPOS_DOC})`,
          orderBy: 'createdTime desc',
          pageSize: 1000,
        });
        return (res.data.files ?? []).map(aDocumento);
      });
    },

    async subir(categoria, tipo, { nombre, contenido, mime, datos }, email) {
      const properties = { subidoPor: email ?? '' };
      for (const [clave, valor] of Object.entries(aPropiedades(datos))) {
        if (valor !== null) properties[clave] = valor;
      }
      return conReintento(async () => {
        const anio = datos.fechaRealizacion.slice(0, 4);
        const carpetaId = await carpetas.carpetaDestino(rootFolderId, categoria, tipo, anio);
        const res = await drive.files.create({
          supportsAllDrives: true,
          requestBody: {
            name: nombre,
            mimeType: mime, // el mismo que el archivo: así Drive no lo convierte
            parents: [carpetaId],
            properties,
          },
          media: { mimeType: mime, body: Readable.from(contenido) },
          fields: CAMPOS_DOC,
        });
        return aDocumento(res.data);
      });
    },

    /** Un documento con sus datos (comprueba que esté en Documentos generales). */
    async obtener(id) {
      return aDocumento((await verificarUbicacion(id)).archivo);
    },

    /** Cambia el nombre y los datos (no el PDF). Si cambió el año de realización, lo pasa a esa carpeta. */
    async actualizar(id, { nombre, datos }) {
      const { archivo, tipoId } = await verificarUbicacion(id);
      return conReintento(async () => {
        const destino = await carpetas.carpetaAnio(tipoId, datos.fechaRealizacion.slice(0, 4));
        const actual = archivo.parents[0];
        const res = await drive.files.update({
          fileId: id,
          supportsAllDrives: true,
          ...(destino !== actual && { addParents: destino, removeParents: actual }),
          requestBody: { name: nombre, properties: aPropiedades(datos) },
          fields: CAMPOS_DOC,
        });
        return aDocumento(res.data);
      });
    },

    /** Devuelve { nombre, mime, flujo } para mandar el archivo al navegador. */
    async descargar(id) {
      const { archivo } = await verificarUbicacion(id);
      const res = await drive.files.get(
        { fileId: id, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' },
      );
      return { nombre: archivo.name, mime: archivo.mimeType, flujo: res.data };
    },

    /**
     * Manda el documento a la papelera de la Unidad compartida (no lo borra para siempre):
     * desde Drive se puede recuperar durante 30 días (mejora sugerida "Papelera").
     */
    async eliminar(id) {
      await verificarUbicacion(id);
      await drive.files.update({ fileId: id, supportsAllDrives: true, requestBody: { trashed: true } });
    },
  };
}
