// Busca y crea las carpetas dentro de "Documentos generales" (RF-05):
// Documentos generales / Categoría / Tipo / Año (el año sale de la fecha de realización).

const TIPO_CARPETA = 'application/vnd.google-apps.folder';
export const ES_ANIO = /^\d{4}$/;
const OPCIONES_UNIDAD = { supportsAllDrives: true, includeItemsFromAllDrives: true, corpora: 'allDrives' };

/** En Drive las comillas simples del nombre se escapan con \ dentro de la consulta. */
function escapar(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function crearServicioCarpetas(drive) {
  // IDs ya encontrados: evita preguntarle a Drive en cada subida
  const cache = new Map();
  // Búsquedas/creaciones en curso: si dos usuarios suben a la vez, las dos esperan
  // la MISMA promesa y la carpeta se crea una sola vez (RNF "sin carpetas duplicadas")
  const enCurso = new Map();

  async function buscar(padreId, nombre) {
    const res = await drive.files.list({
      ...OPCIONES_UNIDAD,
      q:
        `'${escapar(padreId)}' in parents and name = '${escapar(nombre)}' ` +
        `and mimeType = '${TIPO_CARPETA}' and trashed = false`,
      fields: 'files(id, name)',
      orderBy: 'createdTime',
      pageSize: 10,
    });
    // Si ya había duplicadas de antes, se usa siempre la más vieja
    return res.data.files?.[0]?.id ?? null;
  }

  async function crear(padreId, nombre) {
    const res = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: nombre, mimeType: TIPO_CARPETA, parents: [padreId] },
      fields: 'id',
    });
    return res.data.id;
  }

  /** ID de la carpeta "nombre" dentro de "padreId". Si crearSiFalta es false y no existe, devuelve null. */
  async function obtener(padreId, nombre, crearSiFalta) {
    const clave = `${padreId}/${nombre}`;
    if (cache.has(clave)) return cache.get(clave);

    const claveEnCurso = `${clave}|${crearSiFalta}`;
    if (!enCurso.has(claveEnCurso)) {
      const promesa = (async () => {
        const id = (await buscar(padreId, nombre)) ?? (crearSiFalta ? await crear(padreId, nombre) : null);
        if (id) cache.set(clave, id);
        return id;
      })().finally(() => enCurso.delete(claveEnCurso));
      enCurso.set(claveEnCurso, promesa);
    }
    return enCurso.get(claveEnCurso);
  }

  return {
    /** Documentos generales / Categoría / Tipo / Año — crea las que falten. */
    async carpetaDestino(rootId, categoria, tipo, anio) {
      const catId = await obtener(rootId, categoria.nombre, true);
      const tipoId = await obtener(catId, tipo.nombre, true);
      return obtener(tipoId, anio, true);
    },

    /** Carpeta del año dentro de una carpeta de tipo ya conocida (al editar la fecha). */
    async carpetaAnio(tipoId, anio) {
      return obtener(tipoId, anio, true);
    },

    /** Carpetas de año que hay dentro de un tipo. */
    async carpetasAnio(tipoId) {
      const res = await drive.files.list({
        ...OPCIONES_UNIDAD,
        q: `'${escapar(tipoId)}' in parents and mimeType = '${TIPO_CARPETA}' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 1000,
      });
      return (res.data.files ?? []).filter((f) => ES_ANIO.test(f.name)).map((f) => f.id);
    },

    /** Igual que carpetaDestino pero sin crear nada (para listar). null si todavía no existe. */
    async carpetaExistente(rootId, categoria, tipo) {
      const catId = await obtener(rootId, categoria.nombre, false);
      return catId ? obtener(catId, tipo.nombre, false) : null;
    },

    /** Olvida los IDs guardados (por si alguien borró o movió carpetas a mano en Drive). */
    olvidar() {
      cache.clear();
    },
  };
}
