// Tipos de cada categoría: los fijos de config/categorias.js + los que agregan los usuarios.
// Un tipo agregado es simplemente una carpeta dentro de Documentos generales / Categoría,
// así no hace falta otra base de datos y el Apps Script de avisos lo lee igual que a los demás.
//
// No se pueden repetir nombres: dos nombres son "el mismo" si coinciden sin contar mayúsculas,
// acentos, espacios ni signos ("Agua - Microbiológico" = "agua microbiologico").

import { CATEGORIAS } from '../config/categorias.js';
import { ErrorHttp } from './errores.js';

export const LARGO_MAXIMO_TIPO = 60;
const CARACTERES_VALIDOS = /^[\p{L}\p{N} .,()+-]+$/u;
const DURACION_CACHE_MS = 60_000;

/** "Agua - Microbiológico" → "agua-microbiologico" (es el id que va en la URL). */
export function idDeNombre(nombre) {
  return String(nombre)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Limpia y valida el nombre que escribió el usuario. */
export function validarNombreTipo(texto) {
  const nombre = String(texto ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre) throw new ErrorHttp(400, 'Escribí el nombre del tipo de análisis.');
  if (nombre.length > LARGO_MAXIMO_TIPO) {
    throw new ErrorHttp(400, `El nombre puede tener hasta ${LARGO_MAXIMO_TIPO} caracteres.`);
  }
  if (!CARACTERES_VALIDOS.test(nombre)) {
    throw new ErrorHttp(400, 'El nombre solo puede tener letras, números, espacios y los signos . , ( ) + -');
  }
  if (!idDeNombre(nombre)) throw new ErrorHttp(400, 'El nombre tiene que tener al menos una letra o número.');
  return nombre;
}

export function crearServicioTipos(carpetas, rootFolderId) {
  const cache = new Map(); // categoriaId → { hasta, tipos }

  /** Fijos primero (en su orden) y después los agregados, por nombre. Sin repetidos. */
  async function tipos(categoria) {
    const guardado = cache.get(categoria.id);
    if (guardado && guardado.hasta > Date.now()) return guardado.tipos;

    const lista = categoria.tipos.map((t) => ({ ...t }));
    const usados = new Set(lista.map((t) => t.id));
    const agregados = (await carpetas.nombresTipos(rootFolderId, categoria))
      .map((nombre) => ({ id: idDeNombre(nombre), nombre, agregado: true }))
      .filter((t) => t.id && !usados.has(t.id) && usados.add(t.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    const todos = [...lista, ...agregados];
    cache.set(categoria.id, { hasta: Date.now() + DURACION_CACHE_MS, tipos: todos });
    return todos;
  }

  return {
    /** Todas las categorías con sus tipos completos (para GET /api/categorias). */
    async categorias() {
      return Promise.all(CATEGORIAS.map(async (c) => ({ ...c, tipos: await tipos(c) })));
    },

    /** { categoria, tipo } o null si la combinación no existe. */
    async buscar(categoriaId, tipoId) {
      const categoria = CATEGORIAS.find((c) => c.id === categoriaId);
      if (!categoria) return null;
      const tipo = (await tipos(categoria)).find((t) => t.id === tipoId);
      return tipo ? { categoria, tipo } : null;
    },

    /** Agrega un tipo nuevo (crea su carpeta). Error 409 si ya hay uno con ese nombre. */
    async agregar(categoriaId, texto) {
      const categoria = CATEGORIAS.find((c) => c.id === categoriaId);
      if (!categoria) throw new ErrorHttp(404, 'La categoría no existe.');
      const nombre = validarNombreTipo(texto);
      const id = idDeNombre(nombre);

      cache.delete(categoria.id); // se compara con lo que hay ahora en Drive
      const repetido = (await tipos(categoria)).find((t) => t.id === id);
      if (repetido) throw new ErrorHttp(409, `Ya existe un tipo de análisis llamado "${repetido.nombre}".`);

      await carpetas.crearCarpetaTipo(rootFolderId, categoria, nombre);
      cache.delete(categoria.id);
      return { id, nombre, agregado: true };
    },
  };
}
