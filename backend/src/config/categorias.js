// ÚNICO lugar donde se definen las categorías y sus tipos (RF-09).
// Para agregar una categoría o un tipo, sumá un objeto acá y reiniciá el servidor:
// el front end las pide a GET /api/categorias, así que no hay que tocarlo.
//
// - id:     va en la URL (/documentos/analisis). Minúsculas, sin espacios ni acentos.
// - nombre: es el nombre de la carpeta en Drive y el texto que ve el usuario.
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

/** Devuelve { categoria, tipo } o null si la combinación no existe. */
export function buscarCategoriaYTipo(categoriaId, tipoId) {
  const categoria = CATEGORIAS.find((c) => c.id === categoriaId);
  const tipo = categoria?.tipos.find((t) => t.id === tipoId);
  return categoria && tipo ? { categoria, tipo } : null;
}
