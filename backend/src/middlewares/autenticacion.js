import { puedeEliminar, puedeVerModulo } from '../config/permisos.js';
import { ErrorHttp } from '../servicios/errores.js';

/**
 * Exige un usuario logueado (cabecera "Authorization: Bearer <token de Firebase>")
 * y deja en req.usuario: { uid, email, perfil }.
 */
export function autenticar({ verificarToken, leerPerfil }) {
  return async (req, _res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new ErrorHttp(401, 'Tenés que iniciar sesión.');

    let usuario;
    try {
      usuario = await verificarToken(token);
    } catch {
      throw new ErrorHttp(401, 'La sesión venció. Volvé a iniciar sesión.');
    }
    const perfil = await leerPerfil(usuario.uid, token);
    if (!perfil?.rol) throw new ErrorHttp(403, 'Tu usuario no tiene un rol asignado. Consultá al administrador.');

    req.usuario = { ...usuario, perfil };
    next();
  };
}

/**
 * Exige que el usuario tenga habilitado el módulo (igual que el pantallaGuard del front end).
 * Con una lista, alcanza con uno: el controlador después controla el de cada categoría.
 */
export function requiereModulo(modulos) {
  const lista = [].concat(modulos);
  return (req, _res, next) => {
    if (!lista.some((m) => puedeVerModulo(req.usuario?.perfil, m))) {
      throw new ErrorHttp(403, 'No tenés habilitado este módulo.');
    }
    next();
  };
}

export function requierePermisoEliminar(req, _res, next) {
  if (!puedeEliminar(req.usuario?.perfil)) {
    throw new ErrorHttp(403, 'Tu rol no permite eliminar documentos.');
  }
  next();
}
