// ÚNICO lugar donde se definen las categorías y sus tipos (RF-09).
// Para agregar una categoría o un tipo, sumá un objeto acá y reiniciá el servidor:
// el front end las pide a GET /api/categorias, así que no hay que tocarlo.
//
// - id:     va en la URL (/documentos/analisis). Minúsculas, sin espacios ni acentos.
// - nombre: es el nombre de la carpeta en Drive y el texto que ve el usuario.
// - modulo (opcional): módulo de permisos al que pertenece; sin él, "documentos" (Documentación).
// - procedimiento (opcional): true si los documentos llevan los datos de un procedimiento.
// - etiquetaTipo (opcional): cómo se le dice a un tipo en esa categoría ("tipo de análisis").
//
// Además, los usuarios pueden agregar tipos desde la pantalla (servicios/tipos.js): cada uno es
// una carpeta más dentro de la categoría en Drive. Los de acá son los fijos.
//
// Si cambiás el "nombre" de algo que ya tiene archivos, se crea una carpeta nueva:
// renombrá también la carpeta vieja en Drive para no perder los documentos.

export const CATEGORIAS = [
  {
    id: 'analisis',
    nombre: 'Análisis',
    descripcion: 'Resultados de laboratorio',
    tipos: [
      { id: 'agua-microbiologico', nombre: 'Agua - Microbiológico' },
      { id: 'agua-fisicoquimico', nombre: 'Agua - Fisicoquímico' },
      { id: 'alergenos', nombre: 'Alérgenos' },
      { id: 'aflatoxinas', nombre: 'Aflatoxinas' },
    ],
  },
  // Procedimientos generales: tiene su propia tarjeta en Inicio (módulo "procedimientos"),
  // por eso no aparece en Documentación. Sus "tipos" son las áreas de uso del documento
  // (se pueden agregar más desde la pantalla, igual que los tipos de análisis).
  {
    id: 'procedimientos',
    nombre: 'Procedimientos generales',
    descripcion: 'Procedimientos de la empresa con código, revisión y copias impresas',
    modulo: 'procedimientos', // config/permisos.js
    procedimiento: true, // pide los datos extra: código, realizó, revisión, estado, copias…
    etiquetaTipo: 'área de uso', // cómo se llama un "tipo" en esta categoría
    tipos: [
      { id: 'seguridad-alimentaria', nombre: 'Seguridad alimentaria' },
      { id: 'calidad', nombre: 'Calidad' },
      { id: 'logistica', nombre: 'Logística' },
    ],
  },
  // Proveedores: desactivada por ahora. Para volver a mostrarla, sacá las // de estas líneas.
  // {
  //   id: 'proveedores',
  //   nombre: 'Proveedores',
  //   descripcion: 'Evaluaciones y certificados de proveedores',
  //   tipos: [
  //     { id: 'evaluaciones', nombre: 'Evaluaciones' },
  //     { id: 'certificados', nombre: 'Certificados' },
  //   ],
  // },
];
