/** Error con código HTTP y mensaje para mostrar al usuario. */
export class ErrorHttp extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}

/** true si Google respondió 404 (por ejemplo, alguien borró una carpeta a mano en Drive). */
export function esNoEncontrado(err) {
  return err?.code === 404 || err?.status === 404 || err?.response?.status === 404;
}
