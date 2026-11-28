// Formatos de archivo que se pueden subir (RF-08): PDF, Word y Excel.
// El formato sale de la extensión del nombre y se confirma con los primeros bytes del archivo
// ("firma"), porque la extensión o el tipo que manda el navegador los puede falsear cualquiera.
// Se guardan en Drive tal cual (no se convierten a Documentos/Hojas de Google).

const FIRMA_PDF = Buffer.from('%PDF-', 'latin1');
const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // .docx y .xlsx son archivos zip
const FIRMA_OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .doc y .xls viejos

export const FORMATOS = [
  { extension: 'pdf', mime: 'application/pdf', firma: FIRMA_PDF },
  { extension: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', firma: FIRMA_ZIP },
  { extension: 'doc', mime: 'application/msword', firma: FIRMA_OLE },
  { extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', firma: FIRMA_ZIP },
  { extension: 'xls', mime: 'application/vnd.ms-excel', firma: FIRMA_OLE },
];

export const MIMES = FORMATOS.map((f) => f.mime);

/** "Informe.Final.XLSX" → "xlsx" (o null si no tiene una de las extensiones permitidas). */
export function extensionDe(nombre) {
  const ext = String(nombre ?? '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return FORMATOS.some((f) => f.extension === ext) ? ext : null;
}

export function formatoPorExtension(extension) {
  return FORMATOS.find((f) => f.extension === extension) ?? null;
}

export function formatoPorMime(mime) {
  return FORMATOS.find((f) => f.mime === mime) ?? null;
}

/** true si el contenido empieza con la firma que corresponde a ese formato. */
export function tieneFirma(formato, contenido) {
  return contenido.subarray(0, formato.firma.length).equals(formato.firma);
}
