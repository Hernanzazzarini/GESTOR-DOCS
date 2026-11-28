// Módulos del sistema y quién puede verlos (misma idea que el PCC4).
// El admin habilita módulos por usuario en "Gestión de Usuarios" (users/{uid}.pantallas).
// "Gestión de Usuarios" no está acá: es siempre y solo del admin.
//
// ➕ PARA AGREGAR UN MÓDULO NUEVO:
//   1. Sumá su id al tipo `Pantalla` y un objeto a `PANTALLAS` (aparece solo en Inicio,
//      en el encabezado y en los permisos de Gestión de Usuarios).
//   2. Creá su componente y su ruta en app.routes.ts con data: { pantalla: '<id>' }.
//   3. Si usa la API, agregalo también en backend/src/config/permisos.js.

export type Rol = 'admin' | 'encargado' | 'operador';

export const ROLES: { id: Rol; texto: string }[] = [
  { id: 'operador', texto: 'Operador' },
  { id: 'encargado', texto: 'Encargado' },
  { id: 'admin', texto: 'Administrador' },
];

export type Pantalla = 'documentos' | 'procedimientos';

export interface DefPantalla {
  id: Pantalla;
  texto: string;
  descripcion: string; // se muestra en la tarjeta de Inicio
  icono: string; // emoji de la tarjeta de Inicio
  roles: Rol[]; // roles que la ven si el usuario no tiene permisos propios
}

export const PANTALLAS: DefPantalla[] = [
  {
    id: 'documentos',
    texto: 'Documentación',
    descripcion: 'Subí, consultá y descargá los PDF de la empresa por categoría.',
    icono: '📁',
    roles: ['admin', 'encargado', 'operador'],
  },
  {
    id: 'procedimientos',
    texto: 'Procedimientos generales',
    descripcion: 'Cargá los procedimientos con código, revisión, estado, copias impresas y avisos de vencimiento.',
    icono: '📋',
    roles: ['admin', 'encargado', 'operador'],
  },
];

/** Roles que pueden eliminar documentos (el back end vuelve a controlarlo). */
const ROLES_QUE_ELIMINAN: Rol[] = ['admin', 'encargado'];

export interface Perfil {
  rol: Rol;
  pantallas?: Pantalla[]; // sin definir: las de su rol
}

export function pantallasDeRol(rol: Rol): Pantalla[] {
  return PANTALLAS.filter((p) => p.roles.includes(rol)).map((p) => p.id);
}

/** Pantallas que puede abrir el usuario. El admin las ve todas. */
export function pantallasPermitidas(perfil: Perfil | null): Pantalla[] {
  if (!perfil) return [];
  if (perfil.rol === 'admin') return PANTALLAS.map((p) => p.id);
  const ids = PANTALLAS.map((p) => p.id);
  return perfil.pantallas
    ? perfil.pantallas.filter((p) => ids.includes(p))
    : pantallasDeRol(perfil.rol);
}

export function puedeEliminar(perfil: Perfil | null): boolean {
  return !!perfil && ROLES_QUE_ELIMINAN.includes(perfil.rol);
}

/** Ruta a la que mandar al usuario al entrar (null: no tiene ningún módulo). */
export function rutaInicial(perfil: Perfil | null): string | null {
  if (!perfil) return null;
  if (perfil.rol === 'admin' || pantallasPermitidas(perfil).length) return '/';
  return null;
}
