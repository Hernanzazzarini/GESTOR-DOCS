/**
 * Gestor de documentación — avisos de vencimiento y planilla de registro.
 *
 * Vive dentro de la planilla "Registro de documentos" (en la carpeta Documentos generales).
 * Cada hora actualiza la planilla (pasos 1 y 2). Todos los días a la mañana, además, manda los avisos:
 *   1. Recorre Documentos generales / Categoría / Tipo y lee los datos de cada PDF
 *      (los guarda la app en las "properties" del archivo de Drive).
 *   2. Reescribe la hoja "Documentos" con una fila por documento.
 *   3. Manda un mail al responsable (y a los que figuran en "avisar a") de cada documento
 *      que llegó a uno de sus días de aviso.
 *
 * Instalación: ver apps-script/LEEME.md. No se edita a mano la hoja: se pisa en cada pasada.
 */

const CONFIG = {
  ROOT_FOLDER_ID: '1G8HUpaK-EWlu5xpmc-8m8HRvmwmwLJuq', // carpeta "Documentos generales"
  URL_APP: 'https://gestor-documentacion.web.app',
  HOJA: 'Documentos',
  ZONA: 'America/Argentina/Buenos_Aires',
  HORA: 7, // hora del día en que corre (aprox.)
  MAXIMO_AVISAR: 10,
};

const CARPETA = 'application/vnd.google-apps.folder';
const PDF = 'application/pdf';

// ── Menú y tarea diaria ───────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Gestor de documentos')
    .addItem('Actualizar ahora (planilla y avisos)', 'tareaDiaria')
    .addSeparator()
    .addItem('Instalar tareas automáticas (una sola vez)', 'instalar')
    .addToUi();
}

/**
 * Programa las tareas automáticas (borra las anteriores si existían) y las corre una vez:
 * - cada hora: actualizar la planilla (sin mails);
 * - todos los días a la mañana: planilla + avisos por mail.
 */
function instalar() {
  ScriptApp.getProjectTriggers()
    .filter((t) => ['tareaDiaria', 'actualizarPlanilla'].includes(t.getHandlerFunction()))
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('tareaDiaria').timeBased().everyDays(1).atHour(CONFIG.HORA).inTimezone(CONFIG.ZONA).create();
  ScriptApp.newTrigger('actualizarPlanilla').timeBased().everyHours(1).create();

  const resultado = tareaDiaria();
  SpreadsheetApp.getUi().alert(
    `Listo. La planilla se actualiza sola cada hora, y todos los días cerca de las ${CONFIG.HORA} h ` +
      `se mandan los avisos por mail.\n\n` +
      `Ahora: ${resultado.documentos} documentos, ${resultado.mails} mails enviados.`,
  );
}

/** Solo la planilla, sin mandar mails (corre cada hora). */
function actualizarPlanilla() {
  escribirPlanilla(leerDocumentos());
}

function tareaDiaria() {
  const docs = leerDocumentos();
  escribirPlanilla(docs);
  const mails = enviarAvisos(docs);
  return { documentos: docs.length, mails };
}

// ── Lectura desde Drive ───────────────────────────────────────────────────

/** Drive.Files.list con todas las páginas (Unidad compartida incluida). */
function listarTodo(q, campos) {
  const archivos = [];
  let pageToken;
  do {
    const res = Drive.Files.list({
      q,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
      fields: `nextPageToken, files(${campos})`,
      pageSize: 1000,
      pageToken,
    });
    archivos.push(...(res.files || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return archivos;
}

function hijos(carpetaId, mimeType, campos) {
  return listarTodo(`'${carpetaId}' in parents and mimeType = '${mimeType}' and trashed = false`, campos);
}

/**
 * Documentos generales / Categoría / Tipo / Año / *.pdf → lista de documentos con sus datos.
 * También lee los PDF sueltos en el Tipo (como se guardaban antes de separar por año).
 */
function leerDocumentos() {
  const docs = [];
  const campos = 'id, name, webViewLink, createdTime, properties';
  for (const categoria of hijos(CONFIG.ROOT_FOLDER_ID, CARPETA, 'id, name')) {
    for (const tipo of hijos(categoria.id, CARPETA, 'id, name')) {
      const anios = hijos(tipo.id, CARPETA, 'id, name').filter((c) => /^\d{4}$/.test(c.name));
      for (const carpeta of [tipo, ...anios]) {
        for (const f of hijos(carpeta.id, PDF, campos)) docs.push(aDocumento(f, categoria.name, tipo.name));
      }
    }
  }
  return docs;
}

function aDocumento(f, categoria, tipo) {
  const p = f.properties || {};
  const avisar = [];
  for (let i = 1; i <= CONFIG.MAXIMO_AVISAR; i++) if (p[`avisar${i}`]) avisar.push(p[`avisar${i}`]);
  return {
    id: f.id,
    nombre: f.name,
    link: f.webViewLink,
    categoria,
    tipo,
    area: p.area || '',
    fechaRealizacion: p.fechaRealizacion || '',
    fechaVencimiento: p.fechaVencimiento || '',
    responsable: p.responsable || '',
    subidoPor: p.subidoPor || '',
    diasAviso: p.diasAviso ? p.diasAviso.split(',').map(Number) : [],
    avisar,
  };
}

// ── Fechas (sin horas: "AAAA-MM-DD") ──────────────────────────────────────

function hoyIso() {
  return Utilities.formatDate(new Date(), CONFIG.ZONA, 'yyyy-MM-dd');
}

function diasEntre(desde, hasta) {
  const utc = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86400000);
}

function formatearFecha(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function estado(doc, hoy) {
  if (!doc.fechaVencimiento) return 'No vence';
  const dias = diasEntre(hoy, doc.fechaVencimiento);
  if (dias < 0) return 'Vencido';
  if (dias <= 30) return 'Por vencer';
  return 'Vigente';
}

// ── Planilla ──────────────────────────────────────────────────────────────

const COLUMNAS = [
  'Categoría', 'Tipo', 'Nombre', 'Área', 'Fecha de realización', 'Año', 'Fecha de vencimiento',
  'Estado', 'Días para vencer', 'Responsable', 'Avisar también a', 'Avisos (días antes)', 'Subido por', 'Link',
];

const COLORES_ESTADO = { Vencido: '#fdecea', 'Por vencer': '#fff4e0', Vigente: '#e7f6ec', 'No vence': null };

function aFecha(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function filasPlanilla(docs, hoy) {
  // Primero los que vencen antes; los que no vencen, al final
  const orden = (d) => d.fechaVencimiento || '9999-12-31';
  return [...docs]
    .sort((a, b) => orden(a).localeCompare(orden(b)) || a.nombre.localeCompare(b.nombre))
    .map((d) => [
      d.categoria,
      d.tipo,
      d.nombre,
      d.area,
      aFecha(d.fechaRealizacion),
      d.fechaRealizacion ? Number(d.fechaRealizacion.slice(0, 4)) : '',
      aFecha(d.fechaVencimiento),
      estado(d, hoy),
      d.fechaVencimiento ? diasEntre(hoy, d.fechaVencimiento) : '',
      d.responsable,
      d.avisar.join(', '),
      d.diasAviso.join(', '),
      d.subidoPor,
      d.link,
    ]);
}

function escribirPlanilla(docs) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName(CONFIG.HOJA) || libro.insertSheet(CONFIG.HOJA, 0);
  const hoy = hoyIso();
  const filas = filasPlanilla(docs, hoy);

  if (hoja.getFilter()) hoja.getFilter().remove();
  hoja.clear();
  hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold').setBackground('#e2e8f0');
  hoja.setFrozenRows(1);
  hoja
    .getRange('A1')
    .setNote(`Se actualiza sola (y desde el menú "Gestor de documentos"). No la edites a mano.\n` +
      `Se actualiza cada hora. Última actualización: ${Utilities.formatDate(new Date(), CONFIG.ZONA, 'dd/MM/yyyy HH:mm')}`);

  if (filas.length) {
    hoja.getRange(2, 1, filas.length, COLUMNAS.length).setValues(filas);
    hoja.getRange(2, 5, filas.length, 1).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(2, 7, filas.length, 1).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(2, 8, filas.length, 1).setBackgrounds(filas.map((f) => [COLORES_ESTADO[f[7]]]));
  }
  hoja.getRange(1, 1, filas.length + 1, COLUMNAS.length).createFilter();
  hoja.autoResizeColumns(1, COLUMNAS.length);
}

// ── Avisos por mail ───────────────────────────────────────────────────────

/** Clave con la que se recuerda que un aviso ya se mandó (si cambia el vencimiento, se vuelve a avisar). */
function claveAviso(doc, dias) {
  return `aviso|${doc.id}|${doc.fechaVencimiento}|${dias}`;
}

/**
 * Qué avisos le tocan hoy a un documento. Si un día no se corrió (o el documento se subió tarde),
 * se manda UN solo mail por todos los avisos atrasados, no uno por cada uno.
 */
function avisosPendientes(doc, hoy, yaEnviados) {
  if (!doc.fechaVencimiento || !doc.diasAviso.length || !doc.responsable) return [];
  const faltan = diasEntre(hoy, doc.fechaVencimiento);
  return doc.diasAviso.filter((n) => faltan <= n && !yaEnviados.has(claveAviso(doc, n)));
}

function asuntoAviso(doc, faltan) {
  if (faltan > 0) return `Vence en ${faltan} día${faltan === 1 ? '' : 's'}: ${doc.nombre}`;
  if (faltan === 0) return `Vence hoy: ${doc.nombre}`;
  return `Vencido hace ${-faltan} día${faltan === -1 ? '' : 's'}: ${doc.nombre}`;
}

function cuerpoAviso(doc, faltan) {
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fila = (k, v) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td>${esc(v)}</td></tr>`;
  const situacion = faltan > 0 ? `vence en <b>${faltan} día${faltan === 1 ? '' : 's'}</b>` : faltan === 0 ? '<b>vence hoy</b>' : `<b>venció hace ${-faltan} día${faltan === -1 ? '' : 's'}</b>`;
  return (
    `<p>El documento <b>${esc(doc.nombre)}</b> ${situacion}.</p>` +
    '<table style="border-collapse:collapse;font-size:14px">' +
    fila('Categoría', `${doc.categoria} › ${doc.tipo}`) +
    fila('Área', doc.area || '—') +
    fila('Realización', formatearFecha(doc.fechaRealizacion) || '—') +
    fila('Vencimiento', formatearFecha(doc.fechaVencimiento)) +
    fila('Responsable', doc.responsable) +
    '</table>' +
    `<p><a href="${doc.link}">Abrir el PDF en Drive</a> · <a href="${CONFIG.URL_APP}">Abrir el gestor de documentación</a></p>` +
    '<p style="color:#64748b;font-size:12px">Aviso automático del gestor de documentación. ' +
    'Para cambiar cuándo y a quién se avisa, editá el documento en el gestor.</p>'
  );
}

function enviarAvisos(docs) {
  const propiedades = PropertiesService.getScriptProperties();
  const guardadas = propiedades.getProperties();
  const yaEnviados = new Set(Object.keys(guardadas).filter((k) => k.startsWith('aviso|')));
  const hoy = hoyIso();
  let mails = 0;

  for (const doc of docs) {
    const pendientes = avisosPendientes(doc, hoy, yaEnviados);
    if (!pendientes.length) continue;
    if (MailApp.getRemainingDailyQuota() < 1) {
      console.warn('Se terminó la cuota diaria de mails; el resto sale mañana.');
      break;
    }
    const faltan = diasEntre(hoy, doc.fechaVencimiento);
    MailApp.sendEmail({
      to: doc.responsable,
      cc: doc.avisar.join(','),
      subject: asuntoAviso(doc, faltan),
      htmlBody: cuerpoAviso(doc, faltan),
      name: 'Gestor de documentación',
    });
    for (const n of pendientes) propiedades.setProperty(claveAviso(doc, n), hoy);
    mails++;
  }

  // Limpieza: se olvidan los avisos de documentos que ya no están (borrados o movidos)
  const vigentes = new Set(docs.map((d) => d.id));
  for (const clave of yaEnviados) {
    if (!vigentes.has(clave.split('|')[1])) propiedades.deleteProperty(clave);
  }
  return mails;
}
