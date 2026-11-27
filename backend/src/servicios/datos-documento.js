import { extensionDe } from '../config/formatos.js';
import { ErrorHttp } from './errores.js';

// Datos que acompañan a cada archivo: área, fechas, responsable y avisos de vencimiento.
//
// Se guardan en el mismo archivo de Drive como "properties" (públicas, no "appProperties"):
// así también los puede leer el script de Google que manda los avisos y arma la planilla
// (apps-script/Avisos.gs). Drive admite como mucho 124 bytes por dato (nombre + valor),
// por eso cada mail de "avisar" va en su propia propiedad (avisar1, avisar2, …).

export const MAXIMO_AVISAR = 10; // mails extra por documento
export const MAXIMO_DIAS_AVISO = 6; // avisos por documento
export const DIAS_AVISO_POR_DEFECTO = [30, 7, 0];

/** Todas las propiedades que maneja la app (para poder borrarlas al editar). */
const CLAVES = [
  'area',
  'fechaRealizacion',
  'fechaVencimiento',
  'responsable',
  'diasAviso',
  ...Array.from({ length: MAXIMO_AVISAR }, (_, i) => `avisar${i + 1}`),
];

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** "2026-02-30" no es válida aunque tenga el formato correcto. */
function esFechaValida(texto) {
  const partes = FECHA.exec(texto);
  if (!partes) return false;
  const [, a, m, d] = partes.map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

/** Texto de una línea, sin espacios de más ni caracteres invisibles. */
function limpiar(valor) {
  return String(valor ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Acepta un array (JSON) o un texto separado por comas (formulario con archivo). */
function aLista(valor) {
  const lista = Array.isArray(valor) ? valor : String(valor ?? '').split(',');
  return lista.map(limpiar).filter(Boolean);
}

function textoObligatorio(valor, campo, maximo) {
  const texto = limpiar(valor);
  if (!texto) throw new ErrorHttp(400, `Falta completar ${campo}.`);
  if (texto.length > maximo || Buffer.byteLength(texto) > 100) {
    throw new ErrorHttp(400, `${campo[0].toUpperCase()}${campo.slice(1)} puede tener hasta ${maximo} caracteres.`);
  }
  return texto;
}

function validarEmail(valor, descripcion) {
  const email = limpiar(valor).toLowerCase();
  if (!EMAIL.test(email) || Buffer.byteLength(email) > 100) {
    throw new ErrorHttp(400, `${descripcion} no es un mail válido.`);
  }
  return email;
}

/**
 * Valida lo que manda el formulario. Devuelve { nombre, datos }.
 * El año del análisis sale de la fecha de realización (no se carga aparte).
 */
export function validarDatos(body, nombreOriginal) {
  const fechaRealizacion = limpiar(body?.fechaRealizacion);
  if (!esFechaValida(fechaRealizacion)) throw new ErrorHttp(400, 'La fecha de realización no es válida.');

  const fechaVencimiento = limpiar(body?.fechaVencimiento) || null; // no todos los documentos vencen
  if (fechaVencimiento && !esFechaValida(fechaVencimiento)) {
    throw new ErrorHttp(400, 'La fecha de vencimiento no es válida.');
  }
  if (fechaVencimiento && fechaVencimiento < fechaRealizacion) {
    throw new ErrorHttp(400, 'La fecha de vencimiento no puede ser anterior a la de realización.');
  }

  // Si no escriben un nombre, queda el del archivo. Siempre termina con la extensión del archivo
  // original (.pdf, .docx, .xlsx…): al editar, nombreOriginal es el nombre que ya tiene.
  const extension = extensionDe(nombreOriginal) ?? 'pdf';
  const sinExtension = (texto) => limpiar(texto).replace(new RegExp(`\\.${extension}$`, 'i'), '');
  const base = sinExtension(body?.nombre) || sinExtension(nombreOriginal);
  if (!base) throw new ErrorHttp(400, 'Falta completar el nombre.');
  if (base.length > 150) throw new ErrorHttp(400, 'El nombre puede tener hasta 150 caracteres.');

  if (!limpiar(body?.responsable)) throw new ErrorHttp(400, 'Falta completar el responsable.');
  const responsable = validarEmail(body.responsable, 'El responsable');

  // Avisos: solo tienen sentido si el documento vence
  let diasAviso = [];
  let avisar = [];
  if (fechaVencimiento) {
    diasAviso = [...new Set(aLista(body?.diasAviso).map((d) => {
      if (!/^\d{1,3}$/.test(d) || Number(d) > 365) {
        throw new ErrorHttp(400, 'Los días de aviso tienen que ser números entre 0 y 365.');
      }
      return Number(d);
    }))].sort((a, b) => b - a);
    if (diasAviso.length > MAXIMO_DIAS_AVISO) {
      throw new ErrorHttp(400, `Se pueden programar hasta ${MAXIMO_DIAS_AVISO} avisos por documento.`);
    }

    avisar = [...new Set(aLista(body?.avisar).map((e) => validarEmail(e, `"${e}"`)))].filter(
      (e) => e !== responsable, // el responsable ya recibe el aviso
    );
    if (avisar.length > MAXIMO_AVISAR) {
      throw new ErrorHttp(400, `Se puede avisar a hasta ${MAXIMO_AVISAR} personas además del responsable.`);
    }
  }

  return {
    nombre: `${base}.${extension}`,
    datos: {
      area: textoObligatorio(body?.area, 'el área', 60),
      fechaRealizacion,
      fechaVencimiento,
      responsable,
      diasAviso,
      avisar,
    },
  };
}

/**
 * Datos → propiedades de Drive. Las que no se usan van en null: al editar, Drive las borra
 * (por ejemplo, si antes había 3 mails para avisar y ahora 1).
 */
export function aPropiedades(datos) {
  const props = Object.fromEntries(CLAVES.map((c) => [c, null]));
  props.area = datos.area;
  props.fechaRealizacion = datos.fechaRealizacion;
  props.fechaVencimiento = datos.fechaVencimiento || null;
  props.responsable = datos.responsable;
  props.diasAviso = datos.diasAviso.length ? datos.diasAviso.join(',') : null;
  datos.avisar.forEach((email, i) => (props[`avisar${i + 1}`] = email));
  return props;
}

/** Propiedades de Drive → datos (los documentos viejos guardaban todo en appProperties). */
export function desdePropiedades(archivo) {
  const p = { ...(archivo.appProperties ?? {}), ...(archivo.properties ?? {}) };
  return {
    subidoPor: p.subidoPor || null,
    area: p.area || null,
    fechaRealizacion: p.fechaRealizacion || null, // "AAAA-MM-DD"
    fechaVencimiento: p.fechaVencimiento || null, // "AAAA-MM-DD" o null si no vence
    responsable: p.responsable || null,
    diasAviso: p.diasAviso ? p.diasAviso.split(',').map(Number) : [],
    avisar: Array.from({ length: MAXIMO_AVISAR }, (_, i) => p[`avisar${i + 1}`]).filter(Boolean),
  };
}
