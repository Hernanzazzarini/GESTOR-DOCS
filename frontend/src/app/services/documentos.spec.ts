import { HttpErrorResponse } from '@angular/common/http';
import {
  Documento,
  FILTROS_VACIOS,
  describirAviso,
  describirError,
  estadoVencimiento,
  filtrarDocumentos,
  formatearFecha,
  formatearTamanio,
  hoyIso,
  extensionDe,
  idDeNombre,
  sinExtension,
  tipoDeArchivo,
} from './documentos';

describe('documentos (ayudas)', () => {
  it('formatea tamaños', () => {
    expect(formatearTamanio(500)).toBe('500 B');
    expect(formatearTamanio(2048)).toBe('2 KB');
    expect(formatearTamanio(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });

  it('usa el mensaje que manda el servidor', () => {
    const err = new HttpErrorResponse({ status: 413, error: { mensaje: 'El archivo supera el máximo de 20 MB.' } });
    expect(describirError(err, 'x')).toBe('El archivo supera el máximo de 20 MB.');
  });

  it('avisa si no hay conexión', () => {
    expect(describirError(new HttpErrorResponse({ status: 0 }), 'x')).toMatch(/conexión/);
  });
});

describe('documentos (fechas y filtros)', () => {
  const doc = (datos: Partial<Documento>): Documento => ({
    id: 'x',
    nombre: 'Análisis.pdf',
    formato: 'pdf',
    tamanio: 1,
    fecha: '2026-01-01T12:00:00Z',
    subidoPor: null,
    area: null,
    fechaRealizacion: null,
    fechaVencimiento: null,
    responsable: null,
    diasAviso: [],
    avisar: [],
    ...datos,
  });

  it('muestra las fechas sin correrse un día', () => {
    expect(formatearFecha('2026-03-01')).toBe('01/03/2026');
    expect(formatearFecha(null)).toBe('—');
    expect(hoyIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('calcula el estado del vencimiento', () => {
    const hoy = '2026-11-22';
    expect(estadoVencimiento(doc({}), hoy)).toBe('sin-vencimiento');
    expect(estadoVencimiento(doc({ fechaVencimiento: '2026-11-21' }), hoy)).toBe('vencido');
    expect(estadoVencimiento(doc({ fechaVencimiento: '2026-11-22' }), hoy)).toBe('por-vencer');
    expect(estadoVencimiento(doc({ fechaVencimiento: '2026-12-22' }), hoy)).toBe('por-vencer');
    expect(estadoVencimiento(doc({ fechaVencimiento: '2026-12-23' }), hoy)).toBe('vigente');
  });

  it('filtra por año, área, estado y texto (sin importar acentos)', () => {
    const hoy = '2026-11-22';
    const docs = [
      doc({ id: 'a', area: 'Calidad', fechaRealizacion: '2025-05-01', fechaVencimiento: '2026-01-01', responsable: 'jose@olega.com.ar' }),
      doc({ id: 'b', area: 'Producción', fechaRealizacion: '2026-05-01', nombre: 'Alérgenos maní.pdf' }),
    ];
    const ids = (f: Partial<typeof FILTROS_VACIOS>) =>
      filtrarDocumentos(docs, { ...FILTROS_VACIOS, ...f }, hoy).map((d) => d.id);
    expect(ids({})).toEqual(['a', 'b']);
    expect(ids({ anio: '2025' })).toEqual(['a']);
    expect(ids({ area: 'Producción' })).toEqual(['b']);
    expect(ids({ estado: 'vencido' })).toEqual(['a']);
    expect(ids({ estado: 'vigente' })).toEqual(['b']); // todo lo que no está vencido
    expect(ids({ texto: 'alergenos' })).toEqual(['b']);
    expect(ids({ texto: 'jose' })).toEqual(['a']);
  });
});

describe('documentos (avisos)', () => {
  it('describe cada aviso', () => {
    expect(describirAviso(0)).toBe('El día que vence');
    expect(describirAviso(1)).toBe('1 día antes');
    expect(describirAviso(30)).toBe('30 días antes');
  });
});

describe('idDeNombre (para no repetir tipos de análisis)', () => {
  it('ignora mayúsculas, acentos, espacios y signos', () => {
    expect(idDeNombre('Agua - Microbiológico')).toBe('agua-microbiologico');
    expect(idDeNombre('  ALÉRGENOS ')).toBe('alergenos');
    expect(idDeNombre('metales   pesados')).toBe(idDeNombre('Metales-Pesados'));
    expect(idDeNombre('---')).toBe('');
  });
});

describe('formatos de archivo (PDF, Word, Excel)', () => {
  it('reconoce las extensiones permitidas sin importar mayúsculas', () => {
    expect(extensionDe('Informe.DOCX')).toBe('docx');
    expect(extensionDe('planilla.xls')).toBe('xls');
    expect(extensionDe('foto.png')).toBeNull();
    expect(extensionDe('sin extension')).toBeNull();
  });

  it('saca solo la extensión permitida del nombre', () => {
    expect(sinExtension('Control v1.2.xlsx')).toBe('Control v1.2');
    expect(sinExtension('Lote 1.5')).toBe('Lote 1.5');
  });

  it('elige el ícono según el formato', () => {
    expect(tipoDeArchivo('doc')).toEqual({ etiqueta: 'DOC', clase: 'word' });
    expect(tipoDeArchivo('xlsx')).toEqual({ etiqueta: 'XLS', clase: 'excel' });
    expect(tipoDeArchivo('pdf')).toEqual({ etiqueta: 'PDF', clase: 'pdf' });
  });
});
