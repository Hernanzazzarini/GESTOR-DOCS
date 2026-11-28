// Copia de las reglas de frontend/src/app/permisos.ts (igual que en el PCC4).
// Si agregás un módulo o cambiás quién lo ve, cambialo en los DOS archivos.
// El front end las usa para mostrar u ocultar; el back end, para permitir o rechazar.

/** Roles que ven cada módulo cuando el usuario no tiene permisos propios (users/{uid}.pantallas). */
const MODULOS = {
  documentos: ['admin', 'encargado', 'operador'],
  procedimientos: ['admin', 'encargado', 'operador'],
};

/** Módulos que usan la API (para dejar pasar a quien tenga al menos uno). */
export const MODULOS_API = Object.keys(MODULOS);

/** Roles que pueden eliminar documentos (RF-07 + mejora sugerida de roles). */
const ROLES_QUE_ELIMINAN = ['admin', 'encargado'];

export function puedeVerModulo(perfil, modulo) {
  if (!perfil) return false;
  if (perfil.rol === 'admin') return true;
  if (Array.isArray(perfil.pantallas)) return perfil.pantallas.includes(modulo);
  return (MODULOS[modulo] ?? []).includes(perfil.rol);
}

/** Módulo al que pertenece una categoría (config/categorias.js). Sin "modulo": Documentación. */
export function moduloDeCategoria(categoria) {
  return categoria?.modulo ?? 'documentos';
}

/** Ver, subir y editar documentos de una categoría exige tener su módulo habilitado. */
export function puedeVerCategoria(perfil, categoria) {
  return puedeVerModulo(perfil, moduloDeCategoria(categoria));
}

export function puedeEliminar(perfil) {
  return !!perfil && ROLES_QUE_ELIMINAN.includes(perfil.rol);
}

/** Editar los datos de un documento: admin/encargado, quien lo subió o su responsable. */
export function puedeEditar(perfil, email, documento) {
  if (puedeEliminar(perfil)) return true;
  const yo = String(email ?? '').toLowerCase();
  return !!yo && [documento.subidoPor, documento.responsable].some((e) => e?.toLowerCase() === yo);
}
