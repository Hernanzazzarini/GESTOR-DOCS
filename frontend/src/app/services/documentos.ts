import { HttpClient, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

// Habla con la API del back end (el navegador nunca habla directo con Drive).

export interface Tipo {
  id: string;
  nombre: string;
  agregado?: boolean; // true si lo agregó un usuario (no es de los fijos)
}

export const LARGO_MAXIMO_TIPO = 60;

/** Formatos que se pueden subir (el back end los vuelve a controlar: config/formatos.js). */
export const EXTENSIONES = ['pdf', 'docx', 'doc', 'xlsx', 'xls'];
export const ACEPTA_ARCHIVOS = EXTENSIONES.map((e) => `.${e}`).join(',');

/** "Informe.DOCX" → "docx" (o null si no es PDF, Word ni Excel). */
export function extensionDe(nombre: string): string | null {
  const ext = nombre.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '';
  return EXTENSIONES.includes(ext) ? ext : null;
}

/** "Informe.docx" → "Informe" (solo saca las extensiones permitidas). */
export function sinExtension(nombre: string): string {
  return extensionDe(nombre) ? nombre.replace(/\.[^.]+$/, '') : nombre;
}

/** Etiqueta corta y familia del archivo, para el ícono de la tabla. */
export function tipoDeArchivo(formato: string): { etiqueta: string; clase: 'pdf' | 'word' | 'excel' } {
  if (formato === 'docx' || formato === 'doc') return { etiqueta: 'DOC', clase: 'word' };
  if (formato === 'xlsx' || formato === 'xls') return { etiqueta: 'XLS', clase: 'excel' };
  return { etiqueta: 'PDF', clase: 'pdf' };
}

/**
 * "Agua - Microbiológico" → "agua-microbiologico". Igual que en el back end (servicios/tipos.js):
 * dos tipos con el mismo id se consideran el mismo nombre y no se pueden repetir.
 */
export function idDeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  tipos: Tipo[];
}

export interface RespuestaCategorias {
  categorias: Categoria[];
  puedeEliminar: boolean;
  email: string; // del usuario conectado
}

export interface Documento {
  id: string;
  nombre: string;
  formato: string; // "pdf", "docx", "doc", "xlsx" o "xls"
  tamanio: number; // bytes
  fecha: string; // ISO
  subidoPor: string | null;
  area: string | null;
  fechaRealizacion: string | null; // "AAAA-MM-DD"
  fechaVencimiento: string | null; // "AAAA-MM-DD" o null si no vence
  responsable: string | null; // mail de un usuario registrado
  diasAviso: number[]; // días antes del vencimiento en que se manda el mail (0 = el mismo día)
  avisar: string[]; // mails que reciben el aviso además del responsable
}

/** Lo que se carga junto con el archivo (o al editarlo). */
export interface DatosDocumento {
  nombre: string; // sin la extensión; vacío = el nombre del archivo
  area: string;
  fechaRealizacion: string;
  fechaVencimiento: string; // vacío = no vence
  responsable: string;
  diasAviso: number[];
  avisar: string[];
}

export const DIAS_AVISO_POR_DEFECTO = [30, 7, 0]; // igual que el back end
export const MAXIMO_DIAS_AVISO = 6;
export const MAXIMO_AVISAR = 10;

export type EstadoVencimiento = 'vencido' | 'por-vencer' | 'vigente' | 'sin-vencimiento';

/** "vigente" en los filtros = todo lo que no está vencido (incluye por vencer y los que no vencen). */
export type FiltroEstado = 'vencido' | 'por-vencer' | 'vigente' | 'sin-vencimiento' | '';

export interface Filtros {
  texto: string;
  anio: string; // "" = todos
  area: string; // "" = todas
  estado: FiltroEstado; // "" = todos
}

export const FILTROS_VACIOS: Filtros = { texto: '', anio: '', area: '', estado: '' };

/** Cuántos días antes del vencimiento un documento pasa a "Por vencer". */
export const DIAS_AVISO = 30;

export const TAMANIO_MAXIMO = 20 * 1024 * 1024; // 20 MB, igual que el back end

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;
  private categorias$?: Observable<RespuestaCategorias>;

  /** Las categorías se piden una sola vez por sesión (vienen del archivo de config del back end). */
  categorias(): Observable<RespuestaCategorias> {
    this.categorias$ ??= this.http
      .get<RespuestaCategorias>(`${this.api}/categorias`)
      .pipe(shareReplay({ bufferSize: 1, refCount: false }));
    return this.categorias$;
  }

  /** Olvida las categorías guardadas (al cerrar sesión o si falló el pedido). */
  olvidarCategorias(): void {
    this.categorias$ = undefined;
  }

  categoria(id: string): Observable<Categoria | undefined> {
    return this.categorias().pipe(map((r) => r.categorias.find((c) => c.id === id)));
  }

  /** Agrega un tipo a la categoría. El back end responde 409 si el nombre ya existe. */
  agregarTipo(categoria: string, nombre: string): Observable<Tipo> {
    return this.http.post<Tipo>(`${this.api}/categorias/${encodeURIComponent(categoria)}/tipos`, { nombre });
  }

  listar(categoria: string, tipo: string): Observable<Documento[]> {
    return this.http.get<Documento[]>(`${this.api}/documentos`, { params: { categoria, tipo } });
  }

  /** Sube el archivo informando el progreso (para la barra de carga). */
  subir(categoria: string, tipo: string, archivo: File, datos: DatosDocumento): Observable<HttpEvent<Documento>> {
    const formulario = new FormData();
    // Los datos van ANTES del archivo para que el servidor ya los tenga al recibirlo
    formulario.append('categoria', categoria);
    formulario.append('tipo', tipo);
    for (const [clave, valor] of Object.entries(datos)) {
      formulario.append(clave, Array.isArray(valor) ? valor.join(',') : valor);
    }
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<Documento>(`${this.api}/documentos`, formulario, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /** Cambia el nombre y los datos de un documento (el archivo queda igual). */
  actualizar(id: string, datos: DatosDocumento): Observable<Documento> {
    return this.http.patch<Documento>(`${this.api}/documentos/${id}`, datos);
  }

  /** El archivo como Blob: para abrirlo en una pestaña nueva o guardarlo en la compu. */
  archivo(id: string, descargar = false): Observable<Blob> {
    const params = descargar ? { descargar: '1' } : undefined;
    return this.http.get(`${this.api}/documentos/${id}/archivo`, { responseType: 'blob', params });
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/documentos/${id}`);
  }

  /** "Ping" sin login para despertar el servidor gratuito si estaba dormido. */
  despertar(): Observable<unknown> {
    return this.http.get(`${this.api}/salud`);
  }
}

/** Texto para mostrarle al usuario a partir de un error de la API. */
export function describirError(err: unknown, porDefecto: string): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No hay conexión con el servidor. Revisá tu internet o probá de nuevo en un minuto.';
    }
    const mensaje = (err.error as { mensaje?: string } | null)?.mensaje;
    if (mensaje) return mensaje;
  }
  return porDefecto;
}

/** 1536000 → "1,5 MB" */
export function formatearTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}

/** Fecha de hoy en la computadora del usuario, como "AAAA-MM-DD". */
export function hoyIso(ahora = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/**
 * "2026-03-10" → "10/03/2026". Se arma a mano porque `new Date("2026-03-10")` es medianoche UTC
 * y en Argentina mostraría el día anterior.
 */
export function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Días entre dos fechas "AAAA-MM-DD" (negativo si `hasta` ya pasó). */
export function diasEntre(desde: string, hasta: string): number {
  const aUtc = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((aUtc(hasta) - aUtc(desde)) / 86_400_000);
}

export function estadoVencimiento(doc: Pick<Documento, 'fechaVencimiento'>, hoy = hoyIso()): EstadoVencimiento {
  if (!doc.fechaVencimiento) return 'sin-vencimiento';
  const dias = diasEntre(hoy, doc.fechaVencimiento);
  if (dias < 0) return 'vencido';
  if (dias <= DIAS_AVISO) return 'por-vencer';
  return 'vigente';
}

/** Año del análisis: sale de la fecha de realización (o de la de subida si es un documento viejo). */
export function anioDe(doc: Pick<Documento, 'fechaRealizacion' | 'fecha'>): string {
  return (doc.fechaRealizacion ?? doc.fecha ?? '').slice(0, 4);
}

/** 30 → "30 días antes", 1 → "1 día antes", 0 → "el día que vence". */
export function describirAviso(dias: number): string {
  if (dias === 0) return 'El día que vence';
  return `${dias} día${dias === 1 ? '' : 's'} antes`;
}

/** Saca acentos y pasa a minúsculas: "Alérgenos" y "alergenos" se encuentran igual. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function cumpleEstado(estado: EstadoVencimiento, filtro: FiltroEstado): boolean {
  if (!filtro) return true;
  if (filtro === 'vigente') return estado !== 'vencido';
  return estado === filtro;
}

export function filtrarDocumentos(docs: Documento[], f: Filtros, hoy = hoyIso()): Documento[] {
  const buscado = normalizar(f.texto.trim());
  return docs.filter((d) => {
    if (f.anio && anioDe(d) !== f.anio) return false;
    if (f.area && d.area !== f.area) return false;
    if (f.estado && !cumpleEstado(estadoVencimiento(d, hoy), f.estado)) return false;
    if (buscado) {
      const donde = normalizar([d.nombre, d.area, d.responsable, d.subidoPor].filter(Boolean).join(' '));
      if (!donde.includes(buscado)) return false;
    }
    return true;
  });
}
