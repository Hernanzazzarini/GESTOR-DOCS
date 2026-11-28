import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { EncabezadoComponent } from '../encabezado/encabezado';
import { AuthService } from '../../services/auth';
import {
  ACEPTA_ARCHIVOS,
  Categoria,
  DIAS_AVISO,
  DIAS_AVISO_POR_DEFECTO,
  DatosDocumento,
  Documento,
  DocumentosService,
  ETIQUETAS_USO,
  EstadoUso,
  EstadoVencimiento,
  FILTROS_VACIOS,
  FiltroEstado,
  Filtros,
  LARGO_MAXIMO_TIPO,
  MAXIMO_AVISAR,
  MAXIMO_COPIAS,
  MAXIMO_DIAS_AVISO,
  MAXIMO_REVISION,
  TAMANIO_MAXIMO,
  anioDe,
  describirAviso,
  describirError,
  diasEntre,
  estadoVencimiento,
  filtrarDocumentos,
  formatearFecha,
  formatearTamanio,
  hoyIso,
  extensionDe,
  idDeNombre,
  sinExtension,
  tipoDeArchivo,
} from '../../services/documentos';

const DATOS_VACIOS: DatosDocumento = {
  nombre: '',
  area: '',
  fechaRealizacion: '',
  fechaVencimiento: '',
  responsable: '',
  diasAviso: DIAS_AVISO_POR_DEFECTO,
  avisar: [],
};

/** Datos extra de Procedimientos generales. */
const PROCEDIMIENTO_VACIO = {
  codigo: '',
  realizo: '',
  revision: null as number | null,
  estadoUso: 'en-uso' as EstadoUso,
  copias: 0 as number | null,
  areasImpresion: [] as string[],
};

/** Ícono de cada tipo (los agregados usan el del tubo de ensayo, o el de la tabla en Procedimientos). */
const ICONOS_TIPO: Record<string, string> = {
  'agua-microbiologico': '🦠',
  'agua-fisicoquimico': '💧',
  alergenos: '🥜',
  aflatoxinas: '🌾',
  // Áreas de uso de Procedimientos generales
  'seguridad-alimentaria': '🛡️',
  calidad: '✅',
  logistica: '🚚',
};

/** Entero entre 0 y máximo (los <input type="number"> devuelven null si están vacíos). */
function esEntero(valor: number | null | undefined, maximo: number): boolean {
  return valor !== null && valor !== undefined && Number.isInteger(valor) && valor >= 0 && valor <= maximo;
}

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const ETIQUETAS_ESTADO: Record<EstadoVencimiento, string> = {
  vencido: 'Vencido',
  'por-vencer': 'Por vencer',
  vigente: 'Vigente',
  'sin-vencimiento': 'No vence',
};

/**
 * Sección de una categoría (RF-02 a RF-08): elegir tipo, subir un PDF con sus datos
 * (área, fechas, responsable, avisos de vencimiento) y buscar / abrir / editar / eliminar
 * los documentos de ese tipo. Los mails de aviso los manda apps-script/Avisos.gs.
 * URL: /documentos/analisis?tipo=aflatoxinas
 *
 * También es la pantalla de Procedimientos generales (/procedimientos?tipo=calidad): la ruta fija
 * la categoría en data.categoria. Ahí los tipos son las áreas de uso y el formulario pide además
 * código, realizó, Nro de revisión, estado (En uso / Obsoleto) y copias impresas por área.
 */
@Component({
  selector: 'app-categoria',
  standalone: true,
  imports: [FormsModule, RouterLink, EncabezadoComponent],
  templateUrl: './categoria.html',
  styleUrl: './categoria.css',
})
export class CategoriaComponent implements OnInit {
  private documentos = inject(DocumentosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);

  @ViewChild('selectorArchivo') selectorArchivo?: ElementRef<HTMLInputElement>;

  readonly formatearTamanio = formatearTamanio;
  readonly formatearFecha = formatearFecha;
  readonly etiquetasEstado = ETIQUETAS_ESTADO;
  readonly diasAviso = DIAS_AVISO;
  readonly describirAviso = describirAviso;
  readonly maximoDiasAviso = MAXIMO_DIAS_AVISO;
  readonly maximoAvisar = MAXIMO_AVISAR;
  readonly largoMaximoTipo = LARGO_MAXIMO_TIPO;
  readonly aceptaArchivos = ACEPTA_ARCHIVOS;
  readonly tipoDeArchivo = tipoDeArchivo;
  readonly etiquetasUso = ETIQUETAS_USO;
  readonly maximoRevision = MAXIMO_REVISION;
  readonly maximoCopias = MAXIMO_COPIAS;

  categoria: Categoria | null = null;
  tipo = '';
  private listaActual = ''; // "categoria/tipo" de la lista que se está mostrando
  puedeEliminar = false;
  miEmail = '';
  usuarios: string[] = []; // mails de los usuarios registrados
  cargandoCategoria = true;
  noExiste = false;
  error = '';

  // Lista
  docs: Documento[] = [];
  cargandoDocs = false;
  errorDocs = '';
  private pedidoLista?: Subscription;

  // Búsqueda (se filtra en el navegador: la lista de un tipo ya está completa)
  filtros: Filtros = { ...FILTROS_VACIOS };

  // Subida y edición (el mismo formulario, plegable)
  formularioAbierto = false;
  arrastrando = false;
  archivo: File | null = null;
  datos: DatosDocumento = { ...DATOS_VACIOS };
  editando: Documento | null = null;
  nuevoDia: number | null = null;
  nuevoAvisar = '';
  nuevaAreaImpresion = '';
  errorAviso = '';
  progreso: number | null = null;
  mensajeExito = '';
  errorSubida = '';

  // Agregar un tipo de análisis
  agregandoTipo = false;
  nombreNuevoTipo = '';
  errorTipo = '';
  guardandoTipo = false;

  // Eliminación (confirmación en la misma fila, RF-07)
  confirmando: string | null = null;
  descargando: string | null = null; // id del archivo que se está descargando
  eliminando: string | null = null;
  errorEliminar = '';

  ngOnInit(): void {
    this.cargarUsuarios();
    combineLatest([this.route.paramMap, this.route.queryParamMap, this.documentos.categorias()])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([params, query, r]) => {
          this.cargandoCategoria = false;
          this.puedeEliminar = r.puedeEliminar;
          this.miEmail = r.email.toLowerCase();
          // /documentos/:categoria o una ruta con la categoría fija (Procedimientos generales)
          const id = params.get('categoria') ?? this.route.snapshot.data['categoria'];
          const categoria = r.categorias.find((c) => c.id === id) ?? null;
          this.categoria = categoria;
          this.noExiste = !categoria;
          if (!categoria) return;

          const pedido = query.get('tipo');
          const tipo = categoria.tipos.some((t) => t.id === pedido) ? pedido! : categoria.tipos[0]?.id;
          this.tipo = tipo ?? '';
          // Solo se vuelve a pedir la lista si cambió la categoría o el tipo
          if (`${categoria.id}/${this.tipo}` !== this.listaActual) {
            this.listaActual = `${categoria.id}/${this.tipo}`;
            this.filtros = { ...FILTROS_VACIOS };
            this.cancelarEdicion();
            this.limpiarMensajes();
            this.cargarDocs();
          }
        },
        error: (err) => {
          this.documentos.olvidarCategorias();
          this.cargandoCategoria = false;
          this.error = describirError(err, 'No se pudo cargar la categoría.');
        },
      });
  }

  /**
   * La lista de usuarios sale de Firestore. Si no se puede leer (por ejemplo, si todavía no se
   * publicaron las reglas nuevas), el responsable se escribe a mano.
   */
  private async cargarUsuarios(): Promise<void> {
    try {
      this.usuarios = await this.auth.emailsUsuarios();
    } catch {
      this.usuarios = [];
    }
  }

  /** Opciones del responsable: los usuarios registrados (y el actual, si ya no está en la lista). */
  get opcionesResponsable(): string[] {
    const r = this.datos.responsable;
    return r && !this.usuarios.includes(r) ? [r, ...this.usuarios] : this.usuarios;
  }

  iconoTipo(id: string): string {
    return ICONOS_TIPO[id] ?? (this.esProcedimiento ? '📋' : '🧪');
  }

  /** Procedimientos generales: datos extra y textos propios. */
  get esProcedimiento(): boolean {
    return !!this.categoria?.procedimiento;
  }

  /** "tipo de análisis" o "área de uso". */
  get etiquetaTipo(): string {
    return this.categoria?.etiquetaTipo ?? 'tipo de análisis';
  }

  /** "documento" o "procedimiento" (para los textos de la pantalla). */
  get palabraDoc(): string {
    return this.esProcedimiento ? 'procedimiento' : 'documento';
  }

  get nombreTipo(): string {
    return this.categoria?.tipos.find((t) => t.id === this.tipo)?.nombre ?? '';
  }

  // ── Agregar tipo de análisis ─────────────────────────────────────────

  abrirNuevoTipo(): void {
    this.agregandoTipo = true;
    this.nombreNuevoTipo = '';
    this.errorTipo = '';
  }

  cerrarNuevoTipo(): void {
    this.agregandoTipo = false;
    this.errorTipo = '';
  }

  /** Si el nombre ya existe (sin contar mayúsculas, acentos ni signos), devuelve el que existe. */
  get tipoRepetido(): string {
    const id = idDeNombre(this.nombreNuevoTipo);
    return (id && this.categoria?.tipos.find((t) => t.id === id)?.nombre) || '';
  }

  /** Igual que el back end (servicios/tipos.js). */
  get mensajeRepetido(): string {
    return this.categoria?.etiquetaTipo
      ? `Ya existe el ${this.etiquetaTipo} "${this.tipoRepetido}".`
      : `Ya existe un tipo de análisis llamado "${this.tipoRepetido}".`;
  }

  guardarNuevoTipo(): void {
    if (!this.categoria || this.guardandoTipo) return;
    const nombre = this.nombreNuevoTipo.trim().replace(/\s+/g, ' ');
    if (!idDeNombre(nombre)) {
      this.errorTipo = `Escribí el nombre del ${this.etiquetaTipo}.`;
      return;
    }
    if (this.tipoRepetido) {
      this.errorTipo = this.mensajeRepetido;
      return;
    }
    const categoria = this.categoria;
    this.guardandoTipo = true;
    this.errorTipo = '';
    this.documentos.agregarTipo(categoria.id, nombre).subscribe({
      next: (tipo) => {
        this.guardandoTipo = false;
        this.agregandoTipo = false;
        // Se suma a la lista guardada de categorías, así la tarjeta aparece sin recargar
        if (!categoria.tipos.some((t) => t.id === tipo.id)) categoria.tipos.push(tipo);
        // Se pasa a la tarjeta nueva; el mensaje va después porque al cambiar de tipo se borran
        this.router
          .navigate([], { relativeTo: this.route, queryParams: { tipo: tipo.id }, replaceUrl: true })
          .then(() => (this.mensajeExito = `Se agregó el ${this.etiquetaTipo} "${tipo.nombre}".`));
      },
      error: (err) => {
        this.guardandoTipo = false;
        this.errorTipo = describirError(err, `No se pudo agregar el ${this.etiquetaTipo}.`);
      },
    });
  }

  // ── Búsqueda ─────────────────────────────────────────────────────────

  get docsFiltrados(): Documento[] {
    return filtrarDocumentos(this.docs, this.filtros);
  }

  /** Años que aparecen en la lista, del más nuevo al más viejo, con cuántos documentos tiene cada uno. */
  get anios(): { anio: string; cantidad: number }[] {
    const cuenta = new Map<string, number>();
    for (const d of this.docs) {
      const anio = anioDe(d);
      if (anio) cuenta.set(anio, (cuenta.get(anio) ?? 0) + 1);
    }
    return [...cuenta].sort(([a], [b]) => b.localeCompare(a)).map(([anio, cantidad]) => ({ anio, cantidad }));
  }

  /** Carpeta de Drive donde va a quedar (el año sale de la fecha de realización). */
  get anioDestino(): string {
    return this.datos.fechaRealizacion.slice(0, 4) || 'Año de realización';
  }

  /** Áreas ya usadas: arman el filtro y las sugerencias al escribir (así no se escribe distinto cada vez). */
  get areas(): string[] {
    return [...new Set(this.docs.map((d) => d.area).filter((a): a is string => !!a))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    );
  }

  /** Cuántos hay de cada estado en el año elegido (las tarjetas del resumen). */
  get resumen(): { total: number; vencido: number; porVencer: number; vigente: number } {
    const delAnio = this.filtros.anio ? this.docs.filter((d) => anioDe(d) === this.filtros.anio) : this.docs;
    const r = { total: delAnio.length, vencido: 0, porVencer: 0, vigente: 0 };
    for (const d of delAnio) {
      const e = estadoVencimiento(d);
      if (e === 'vencido') r.vencido++;
      else r.vigente++; // vigentes = todos los que no están vencidos
      if (e === 'por-vencer') r.porVencer++;
    }
    return r;
  }

  /** Tocar una tarjeta del resumen filtra por ese estado (y tocarla de nuevo lo quita). */
  alternarEstado(estado: FiltroEstado): void {
    this.filtros.estado = this.filtros.estado === estado ? '' : estado;
  }

  get hayFiltros(): boolean {
    const f = this.filtros;
    return !!(f.texto || f.area || f.estado || f.uso); // el año se ve en las pestañas
  }

  limpiarFiltros(): void {
    this.filtros = { ...FILTROS_VACIOS, anio: this.filtros.anio };
  }

  estado(doc: Documento): EstadoVencimiento {
    return estadoVencimiento(doc);
  }

  /** "Vence en 12 días", "Venció hace 3 días", "Vence hoy". */
  detalleVencimiento(doc: Documento): string {
    if (!doc.fechaVencimiento) return '';
    const dias = diasEntre(hoyIso(), doc.fechaVencimiento);
    if (dias === 0) return 'Vence hoy';
    if (dias > 0) return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
    return `Venció hace ${-dias} día${dias === -1 ? '' : 's'}`;
  }

  /** Al cambiar el tipo en el selector se actualiza la URL (así "Atrás" y los favoritos funcionan). */
  cambiarTipo(tipo: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tipo }, replaceUrl: true });
  }

  cargarDocs(): void {
    if (!this.categoria || !this.tipo) return;
    this.pedidoLista?.unsubscribe();
    this.cargandoDocs = true;
    this.errorDocs = '';
    this.docs = [];
    this.pedidoLista = this.documentos.listar(this.categoria.id, this.tipo).subscribe({
      next: (docs) => {
        this.docs = docs;
        this.cargandoDocs = false;
      },
      error: (err) => {
        this.errorDocs = describirError(err, 'No se pudieron cargar los documentos.');
        this.cargandoDocs = false;
      },
    });
  }

  // ── Subida ───────────────────────────────────────────────────────────

  abrirFormulario(): void {
    this.limpiarMensajes();
    this.formularioAbierto = true;
    if (this.esProcedimiento && this.datos.estadoUso === undefined) this.datos = { ...this.datos, ...PROCEDIMIENTO_VACIO };
  }

  cerrarFormulario(): void {
    if (this.editando) return this.cancelarEdicion();
    this.formularioAbierto = false;
    this.archivo = null;
    this.errorSubida = '';
  }

  elegirArchivo(evento: Event): void {
    this.procesarArchivo((evento.target as HTMLInputElement).files?.[0] ?? null);
  }

  // Arrastrar y soltar el PDF sobre el recuadro
  alArrastrar(evento: DragEvent, encima: boolean): void {
    evento.preventDefault();
    if (this.progreso === null) this.arrastrando = encima;
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando = false;
    if (this.progreso !== null) return;
    this.procesarArchivo(evento.dataTransfer?.files?.[0] ?? null);
  }

  quitarArchivo(): void {
    this.archivo = null;
    this.reiniciarSelector();
  }

  private procesarArchivo(archivo: File | null): void {
    this.limpiarMensajes();
    this.archivo = null;
    if (!archivo) return;

    // RF-08: PDF, Word o Excel (el servidor lo vuelve a controlar)
    if (!extensionDe(archivo.name)) {
      this.errorSubida = 'Solo se aceptan archivos PDF, Word (.doc, .docx) o Excel (.xls, .xlsx).';
      this.reiniciarSelector();
      return;
    }
    if (archivo.size > TAMANIO_MAXIMO) {
      this.errorSubida = `El archivo pesa ${formatearTamanio(archivo.size)} y el máximo es 20 MB.`;
      this.reiniciarSelector();
      return;
    }
    this.archivo = archivo;
    // Se propone el nombre del archivo; se puede cambiar antes de subir
    if (!this.datos.nombre) this.datos.nombre = sinExtension(archivo.name);
  }

  /** Qué falta para poder subir (null = está todo). */
  get faltante(): string | null {
    const d = this.datos;
    if (!this.editando && !this.archivo) return 'Elegí el archivo.';
    if (this.esProcedimiento) {
      if (!d.codigo?.trim()) return 'Completá el código.';
      if (!d.nombre.trim()) return 'Completá el nombre del documento.';
      if (!d.realizo?.trim()) return 'Completá quién lo realizó.';
      if (!esEntero(d.revision, MAXIMO_REVISION)) return 'Completá el Nro de revisión (0 a 999).';
      if (!d.estadoUso) return 'Elegí si está En uso u Obsoleto.';
      if (!esEntero(d.copias ?? 0, MAXIMO_COPIAS)) return 'La cantidad de copias tiene que ser de 0 a 999.';
      if (d.copias && !d.areasImpresion?.length) return 'Agregá en qué área están las copias impresas.';
    } else if (!d.area.trim()) return 'Completá el área.';
    if (!d.fechaRealizacion) return 'Completá la fecha de realización.';
    if (!d.responsable.trim()) return 'Completá el responsable.';
    if (!EMAIL.test(d.responsable.trim())) return 'El responsable tiene que ser un mail.';
    if (d.fechaVencimiento && d.fechaVencimiento < d.fechaRealizacion) {
      return 'El vencimiento no puede ser anterior a la realización.';
    }
    return null;
  }

  /**
   * Lo que se manda al back end. En Procedimientos el área es el área de uso (la pone el servidor);
   * en las demás categorías no se mandan los datos de procedimiento.
   */
  private datosParaEnviar(): DatosDocumento {
    if (this.esProcedimiento) {
      const copias = this.datos.copias ?? 0;
      return { ...this.datos, area: this.nombreTipo, copias, areasImpresion: copias ? this.datos.areasImpresion : [] };
    }
    const { codigo, realizo, revision, estadoUso, copias, areasImpresion, ...resto } = this.datos;
    return resto;
  }

  subir(): void {
    if (this.editando) return this.guardarEdicion();
    if (this.faltante || !this.archivo || !this.categoria || !this.tipo || this.progreso !== null) return;
    this.limpiarMensajes();
    this.progreso = 0;
    const tipoAlSubir = this.tipo;

    this.documentos.subir(this.categoria.id, this.tipo, this.archivo, this.datosParaEnviar()).subscribe({
      next: (evento) => {
        if (evento.type === HttpEventType.UploadProgress && evento.total) {
          this.progreso = Math.round((evento.loaded / evento.total) * 100);
        }
        if (evento.type === HttpEventType.Response && evento.body) {
          const doc = evento.body;
          const anio = doc.fechaRealizacion?.slice(0, 4) ?? '';
          const codigo = doc.codigo ? `${doc.codigo} · ` : '';
          this.mensajeExito = `"${codigo}${doc.nombre}" se guardó en ${this.categoria!.nombre} › ${this.nombreTipo} › ${anio}.`;
          if (this.tipo === tipoAlSubir) this.docs = [doc, ...this.docs];
          this.progreso = null;
          this.archivo = null;
          // Área, responsable y avisos suelen repetirse al cargar varios: se dejan puestos
          // (en Procedimientos, también quién lo realizó)
          const { area, responsable, diasAviso, avisar, realizo } = this.datos;
          this.datos = { ...DATOS_VACIOS, area, responsable, diasAviso, avisar };
          if (this.esProcedimiento) this.datos = { ...this.datos, ...PROCEDIMIENTO_VACIO, realizo };
          this.reiniciarSelector();
        }
      },
      error: (err) => {
        this.progreso = null;
        this.errorSubida = describirError(err, 'No se pudo subir el archivo.');
      },
    });
  }

  // ── Avisos de vencimiento ────────────────────────────────────────────

  agregarDia(): void {
    this.errorAviso = '';
    const dia = this.nuevoDia;
    if (dia === null || !Number.isInteger(dia) || dia < 0 || dia > 365) {
      this.errorAviso = 'Escribí un número de días entre 0 y 365.';
      return;
    }
    if (this.datos.diasAviso.length >= MAXIMO_DIAS_AVISO) {
      this.errorAviso = `Se pueden programar hasta ${MAXIMO_DIAS_AVISO} avisos.`;
      return;
    }
    this.datos.diasAviso = [...new Set([...this.datos.diasAviso, dia])].sort((a, b) => b - a);
    this.nuevoDia = null;
  }

  quitarDia(dia: number): void {
    this.datos.diasAviso = this.datos.diasAviso.filter((d) => d !== dia);
  }

  /** Usuarios que se pueden sumar a "avisar a" (los que todavía no están). */
  get usuariosParaAvisar(): string[] {
    return this.usuarios.filter((u) => u !== this.datos.responsable && !this.datos.avisar.includes(u));
  }

  agregarAvisar(): void {
    this.errorAviso = '';
    const email = this.nuevoAvisar.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL.test(email)) {
      this.errorAviso = `"${email}" no es un mail válido.`;
      return;
    }
    if (email === this.datos.responsable || this.datos.avisar.includes(email)) {
      this.nuevoAvisar = '';
      return; // ya recibe el aviso
    }
    if (this.datos.avisar.length >= MAXIMO_AVISAR) {
      this.errorAviso = `Se puede avisar a hasta ${MAXIMO_AVISAR} personas además del responsable.`;
      return;
    }
    this.datos.avisar = [...this.datos.avisar, email];
    this.nuevoAvisar = '';
  }

  quitarAvisar(email: string): void {
    this.datos.avisar = this.datos.avisar.filter((e) => e !== email);
  }

  // ── Copias impresas (Procedimientos) ─────────────────────────────────

  /** Sugerencias para "en qué área está impreso": las áreas de uso y las ya usadas. */
  get sugerenciasImpresion(): string[] {
    const usadas = this.docs.flatMap((d) => d.areasImpresion ?? []);
    const todas = [...(this.categoria?.tipos.map((t) => t.nombre) ?? []), ...usadas];
    const elegidas = this.datos.areasImpresion ?? [];
    return [...new Set(todas)].filter((a) => !elegidas.includes(a)).sort((a, b) => a.localeCompare(b, 'es'));
  }

  agregarAreaImpresion(): void {
    this.errorAviso = '';
    const area = this.nuevaAreaImpresion.trim().replace(/\s+/g, ' ').replace(/,/g, ' ');
    if (!area) return;
    const actuales = this.datos.areasImpresion ?? [];
    if (!actuales.some((a) => a.toLowerCase() === area.toLowerCase())) {
      const siguiente = [...actuales, area];
      if (new TextEncoder().encode(siguiente.join(',')).length > 100) {
        this.errorAviso = 'Las áreas donde está impreso pueden tener hasta 100 caracteres en total.';
        return;
      }
      this.datos.areasImpresion = siguiente;
    }
    this.nuevaAreaImpresion = '';
  }

  quitarAreaImpresion(area: string): void {
    this.datos.areasImpresion = (this.datos.areasImpresion ?? []).filter((a) => a !== area);
  }

  // ── Edición ──────────────────────────────────────────────────────────

  puedeEditar(doc: Documento): boolean {
    if (this.puedeEliminar) return true; // admin y encargado (igual que el back end)
    return !!this.miEmail && [doc.subidoPor, doc.responsable].some((e) => e?.toLowerCase() === this.miEmail);
  }

  editar(doc: Documento): void {
    this.limpiarMensajes();
    this.archivo = null;
    this.reiniciarSelector();
    this.editando = doc;
    this.formularioAbierto = true;
    this.datos = {
      nombre: sinExtension(doc.nombre),
      area: doc.area ?? '',
      fechaRealizacion: doc.fechaRealizacion ?? '',
      fechaVencimiento: doc.fechaVencimiento ?? '',
      responsable: doc.responsable ?? '',
      diasAviso: doc.fechaVencimiento ? [...doc.diasAviso] : DIAS_AVISO_POR_DEFECTO,
      avisar: [...doc.avisar],
    };
    if (this.esProcedimiento) {
      this.datos = {
        ...this.datos,
        codigo: doc.codigo ?? '',
        realizo: doc.realizo ?? '',
        revision: doc.revision ?? null,
        estadoUso: doc.estadoUso ?? 'en-uso',
        copias: doc.copias ?? 0,
        areasImpresion: [...(doc.areasImpresion ?? [])],
      };
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    if (!this.editando) return;
    this.editando = null;
    this.formularioAbierto = false;
    this.datos = { ...DATOS_VACIOS };
    this.errorAviso = '';
  }

  private guardarEdicion(): void {
    const doc = this.editando;
    if (!doc || this.faltante || this.progreso !== null) return;
    this.limpiarMensajes();
    this.progreso = 0;
    this.documentos.actualizar(doc.id, this.datosParaEnviar()).subscribe({
      next: (actualizado) => {
        this.progreso = null;
        this.docs = this.docs.map((d) => (d.id === actualizado.id ? actualizado : d));
        this.mensajeExito = `Se guardaron los cambios de "${actualizado.nombre}".`;
        this.cancelarEdicion();
      },
      error: (err) => {
        this.progreso = null;
        this.errorSubida = describirError(err, 'No se pudieron guardar los cambios.');
      },
    });
  }

  private reiniciarSelector(): void {
    if (this.selectorArchivo) this.selectorArchivo.nativeElement.value = '';
  }

  private limpiarMensajes(): void {
    this.mensajeExito = '';
    this.errorSubida = '';
    this.errorEliminar = '';
    this.confirmando = null;
  }

  // ── Ver, descargar y eliminar ────────────────────────────────────────

  /** "ana@empresa.com" → ["ana", "@empresa.com"] (para cortar la línea en la @). */
  partesMail(mail: string): [string, string] {
    const i = mail.indexOf('@');
    return i > 0 ? [mail.slice(0, i), mail.slice(i)] : [mail, ''];
  }

  /** 📄 PDF, 📝 Word, 📊 Excel (para el archivo elegido antes de subirlo). */
  iconoArchivo(nombre: string): string {
    const clase = tipoDeArchivo(extensionDe(nombre) ?? 'pdf').clase;
    return clase === 'word' ? '📝' : clase === 'excel' ? '📊' : '📄';
  }

  /** Solo los PDF se pueden ver en el navegador; Word y Excel se descargan. */
  abrir(doc: Documento): void {
    if (doc.formato === 'pdf') this.ver(doc);
    else this.descargar(doc);
  }

  /** Guarda el archivo en la compu (en Descargas), con su nombre. */
  descargar(doc: Documento): void {
    this.limpiarMensajes();
    this.descargando = doc.id;
    this.documentos.archivo(doc.id, true).subscribe({
      next: (blob) => {
        this.descargando = null;
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = doc.nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        this.descargando = null;
        this.errorEliminar = `No se pudo descargar "${doc.nombre}".`;
      },
    });
  }

  /** Abre el PDF en una pestaña nueva. La pestaña se abre ANTES de pedirlo para que Safari no la bloquee. */
  ver(doc: Documento): void {
    const pestania = window.open('', '_blank');
    pestania?.document.write('<p style="font-family:sans-serif">Abriendo documento…</p>');
    this.documentos.archivo(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (pestania) {
          pestania.location.href = url;
        } else {
          window.location.href = url; // si el navegador bloqueó la pestaña
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => {
        pestania?.close();
        this.errorEliminar = `No se pudo abrir "${doc.nombre}".`;
      },
    });
  }

  /** Texto corto para la tabla: "Avisa 30, 7 y 0 días antes a 3 personas". */
  resumenAvisos(doc: Documento): string {
    if (doc.estadoUso === 'obsoleto') return 'Sin avisos (obsoleto)';
    if (!doc.fechaVencimiento || !doc.diasAviso.length) return 'Sin avisos';
    const personas = 1 + doc.avisar.length;
    const dias = doc.diasAviso.map((d) => (d === 0 ? 'el día' : `${d} d`)).join(', ');
    return `Avisos: ${dias} · ${personas} persona${personas === 1 ? '' : 's'}`;
  }

  pedirConfirmacion(doc: Documento): void {
    this.limpiarMensajes();
    this.confirmando = doc.id;
  }

  eliminar(doc: Documento): void {
    this.eliminando = doc.id;
    this.documentos.eliminar(doc.id).subscribe({
      next: () => {
        this.docs = this.docs.filter((d) => d.id !== doc.id);
        if (this.editando?.id === doc.id) this.cancelarEdicion();
        this.eliminando = null;
        this.confirmando = null;
        this.mensajeExito = `"${doc.nombre}" se envió a la papelera de Drive.`;
      },
      error: (err) => {
        this.eliminando = null;
        this.errorEliminar = describirError(err, 'No se pudo eliminar el documento.');
      },
    });
  }
}
