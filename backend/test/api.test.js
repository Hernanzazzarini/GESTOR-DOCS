// Pruebas de la API sin conectarse a Google: Drive, Firebase y Firestore son simulados.
// Correr con: npm test
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { crearApp } from '../src/app.js';

const ROOT = 'root-documentos-generales';
const CARPETA = 'application/vnd.google-apps.folder';
const PDF_VALIDO = Buffer.from('%PDF-1.4\n%prueba\n');

/** Drive en memoria: guarda archivos y cuenta cuántas carpetas se crearon. */
function crearDriveFalso() {
  let siguiente = 1;
  const archivos = new Map([[ROOT, { id: ROOT, name: 'Documentos generales', mimeType: CARPETA, parents: ['unidad'] }]]);
  const nuevoId = () => `archivo-${String(siguiente++).padStart(6, '0')}`;
  const espera = () => new Promise((r) => setTimeout(r, 5));
  const error404 = () => Object.assign(new Error('not found'), { code: 404 });

  const drive = {
    archivos,
    carpetasCreadas: 0,
    files: {
      async list({ q }) {
        await espera();
        const padres = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
        const nombre = q.match(/name = '((?:[^'\\]|\\.)*)'/)?.[1]?.replace(/\\(.)/g, '$1');
        const tipo = q.match(/mimeType = '([^']+)'/)[1];
        const files = [...archivos.values()].filter(
          (f) => padres.includes(f.parents[0]) && f.mimeType === tipo && !f.trashed && (!nombre || f.name === nombre),
        );
        return { data: { files } };
      },
      async create({ requestBody, media }) {
        await espera();
        if (!archivos.has(requestBody.parents[0])) throw error404();
        if (requestBody.mimeType === CARPETA) drive.carpetasCreadas++;
        const f = {
          id: nuevoId(),
          ...requestBody,
          size: media ? '17' : undefined,
          createdTime: new Date().toISOString(),
        };
        archivos.set(f.id, f);
        return { data: f };
      },
      async get({ fileId, alt }) {
        const f = archivos.get(fileId);
        if (!f) throw error404();
        if (alt === 'media') {
          const { Readable } = await import('node:stream');
          return { data: Readable.from(PDF_VALIDO) };
        }
        return { data: f };
      },
      async update({ fileId, requestBody, addParents, removeParents }) {
        const f = archivos.get(fileId);
        if (!f) throw error404();
        if (addParents) f.parents = [...f.parents.filter((p) => p !== removeParents), addParents];
        const { properties, ...resto } = requestBody;
        Object.assign(f, resto);
        if (properties) {
          // Como Drive: se mezclan con las que había y las que vienen en null se borran
          f.properties = { ...f.properties, ...properties };
          for (const [k, v] of Object.entries(f.properties)) if (v === null) delete f.properties[k];
        }
        return { data: f };
      },
    },
  };
  return drive;
}

const PERFILES = {
  'token-admin': { uid: 'u1', email: 'admin@olega.com.ar', perfil: { rol: 'admin' } },
  'token-operador': { uid: 'u2', email: 'op@olega.com.ar', perfil: { rol: 'operador' } },
  'token-sin-modulo': { uid: 'u3', email: 'x@olega.com.ar', perfil: { rol: 'operador', pantallas: [] } },
  'token-sin-rol': { uid: 'u4', email: 'y@olega.com.ar', perfil: null },
};

function armar() {
  const drive = crearDriveFalso();
  const app = crearApp({
    drive,
    rootFolderId: ROOT,
    origenes: ['http://localhost:4200'],
    verificarToken: async (t) => {
      if (!PERFILES[t]) throw new Error('token inválido');
      return { uid: PERFILES[t].uid, email: PERFILES[t].email };
    },
    leerPerfil: async (uid) => Object.values(PERFILES).find((p) => p.uid === uid).perfil,
  });
  return { app, drive };
}

const como = (token) => ({ Authorization: `Bearer ${token}` });

const DATOS = {
  area: 'Calidad',
  fechaRealizacion: '2026-03-10',
  fechaVencimiento: '2027-03-10',
  responsable: 'maria@olega.com.ar',
  diasAviso: '30,7,0',
  avisar: 'jefe@olega.com.ar, calidad@olega.com.ar',
};

function subir(
  app,
  token,
  { categoria = 'analisis', tipo = 'aflatoxinas', contenido = PDF_VALIDO, nombre = 'Análisis lote 12.pdf', mime = 'application/pdf', datos = DATOS } = {},
) {
  const pedido = request(app).post('/api/documentos').set(como(token)).field('categoria', categoria).field('tipo', tipo);
  for (const [clave, valor] of Object.entries(datos)) pedido.field(clave, valor);
  return pedido.attach('archivo', contenido, { filename: nombre, contentType: mime });
}

describe('API gestor de documentación', () => {
  let app;
  let drive;
  beforeEach(() => ({ app, drive } = armar()));

  it('/api/salud responde sin login', async () => {
    await request(app).get('/api/salud').expect(200, { ok: true });
  });

  it('sin token responde 401', async () => {
    await request(app).get('/api/categorias').expect(401);
  });

  it('usuario sin rol o sin el módulo responde 403', async () => {
    await request(app).get('/api/categorias').set(como('token-sin-rol')).expect(403);
    await request(app).get('/api/categorias').set(como('token-sin-modulo')).expect(403);
  });

  it('devuelve las categorías y si el usuario puede eliminar', async () => {
    const op = await request(app).get('/api/categorias').set(como('token-operador')).expect(200);
    assert.equal(op.body.categorias[0].id, 'analisis');
    assert.equal(op.body.puedeEliminar, false);
    const admin = await request(app).get('/api/categorias').set(como('token-admin')).expect(200);
    assert.equal(admin.body.puedeEliminar, true);
  });

  it('lista vacía si todavía no hay carpeta (y no la crea)', async () => {
    const res = await request(app)
      .get('/api/documentos?categoria=analisis&tipo=agua-microbiologico')
      .set(como('token-operador'))
      .expect(200);
    assert.deepEqual(res.body, []);
    assert.equal(drive.carpetasCreadas, 0);
  });

  it('sube un PDF a Documentos generales/Análisis/Aflatoxinas con el nombre con acentos', async () => {
    const res = await subir(app, 'token-operador').expect(201);
    assert.equal(res.body.nombre, 'Análisis lote 12.pdf');
    assert.equal(res.body.subidoPor, 'op@olega.com.ar');

    const archivo = drive.archivos.get(res.body.id);
    const anio = drive.archivos.get(archivo.parents[0]);
    const tipo = drive.archivos.get(anio.parents[0]);
    const categoria = drive.archivos.get(tipo.parents[0]);
    assert.equal(anio.name, '2026'); // año de la fecha de realización
    assert.equal(tipo.name, 'Aflatoxinas');
    assert.equal(categoria.name, 'Análisis');
    assert.equal(categoria.parents[0], ROOT);

    const lista = await request(app)
      .get('/api/documentos?categoria=analisis&tipo=aflatoxinas')
      .set(como('token-operador'))
      .expect(200);
    assert.equal(lista.body.length, 1);
  });

  it('guarda área, fechas y responsable junto al PDF y los devuelve en la lista', async () => {
    const { body: doc } = await subir(app, 'token-operador', {
      datos: { ...DATOS, nombre: '  Agua pozo 2   marzo ' },
    }).expect(201);
    assert.equal(doc.nombre, 'Agua pozo 2 marzo.pdf');
    assert.equal(doc.area, 'Calidad');
    assert.equal(doc.fechaRealizacion, '2026-03-10');
    assert.equal(doc.fechaVencimiento, '2027-03-10');
    assert.equal(doc.responsable, 'maria@olega.com.ar');
    assert.deepEqual(doc.diasAviso, [30, 7, 0]);
    assert.deepEqual(doc.avisar, ['jefe@olega.com.ar', 'calidad@olega.com.ar']);
    // Públicas (properties) para que el script de avisos las pueda leer
    const props = drive.archivos.get(doc.id).properties;
    assert.equal(props.avisar2, 'calidad@olega.com.ar');
    assert.equal(props.avisar3, undefined);

    const { body: lista } = await request(app)
      .get('/api/documentos?categoria=analisis&tipo=aflatoxinas')
      .set(como('token-operador'))
      .expect(200);
    assert.equal(lista[0].responsable, 'maria@olega.com.ar');
  });

  it('el vencimiento es opcional (y sin vencimiento no hay avisos)', async () => {
    const { fechaVencimiento, ...sinVencimiento } = DATOS;
    const { body: doc } = await subir(app, 'token-operador', { datos: sinVencimiento }).expect(201);
    assert.equal(doc.fechaVencimiento, null);
    assert.deepEqual(doc.diasAviso, []);
    assert.deepEqual(doc.avisar, []);
    assert.equal(drive.archivos.get(doc.id).properties.fechaVencimiento, undefined);
  });

  it('ordena los días de aviso y no repite al responsable en "avisar"', async () => {
    const { body: doc } = await subir(app, 'token-operador', {
      datos: { ...DATOS, diasAviso: '0, 15,15', avisar: 'MARIA@olega.com.ar,otro@olega.com.ar' },
    }).expect(201);
    assert.deepEqual(doc.diasAviso, [15, 0]);
    assert.deepEqual(doc.avisar, ['otro@olega.com.ar']);
  });

  it('rechaza datos faltantes o fechas inválidas', async () => {
    const casos = [
      [{ ...DATOS, area: '   ' }, /área/],
      [{ ...DATOS, responsable: '' }, /responsable/],
      [{ ...DATOS, fechaRealizacion: '2026-02-30' }, /realización/],
      [{ ...DATOS, fechaVencimiento: '10/03/2027' }, /vencimiento/],
      [{ ...DATOS, fechaVencimiento: '2026-01-01' }, /anterior/],
      [{ ...DATOS, area: 'x'.repeat(61) }, /60 caracteres/],
      [{ ...DATOS, responsable: 'María Pérez' }, /mail válido/],
      [{ ...DATOS, avisar: 'jefe@olega.com.ar, cualquiera' }, /cualquiera/],
      [{ ...DATOS, diasAviso: '30,-1' }, /entre 0 y 365/],
      [{ ...DATOS, diasAviso: '1,2,3,4,5,6,7' }, /hasta 6 avisos/],
    ];
    for (const [datos, mensaje] of casos) {
      const res = await subir(app, 'token-operador', { datos }).expect(400);
      assert.match(res.body.mensaje, mensaje);
    }
    assert.equal(drive.carpetasCreadas, 0); // no llega a tocar Drive
  });

  it('Análisis tiene Agua (microbiológico y fisicoquímico), Alérgenos y Aflatoxinas', async () => {
    const { body } = await request(app).get('/api/categorias').set(como('token-operador')).expect(200);
    const tipos = body.categorias.find((c) => c.id === 'analisis').tipos.map((t) => t.id);
    assert.deepEqual(tipos, ['agua-microbiologico', 'agua-fisicoquimico', 'alergenos', 'aflatoxinas']);
  });

  it('edita los datos: quien lo subió sí, otro operador no', async () => {
    const { body: doc } = await subir(app, 'token-admin').expect(201);
    const cambios = { ...DATOS, nombre: 'Nuevo nombre', area: 'Producción', diasAviso: [60], avisar: [] };

    await request(app).patch(`/api/documentos/${doc.id}`).set(como('token-operador')).send(cambios).expect(403);
    const { body: editado } = await request(app)
      .patch(`/api/documentos/${doc.id}`)
      .set(como('token-admin'))
      .send(cambios)
      .expect(200);
    assert.equal(editado.nombre, 'Nuevo nombre.pdf');
    assert.equal(editado.area, 'Producción');
    assert.deepEqual(editado.diasAviso, [60]);
    assert.deepEqual(editado.avisar, []); // los mails anteriores se borraron
    assert.equal(editado.subidoPor, 'admin@olega.com.ar'); // no se pierde

    // El responsable también puede editarlo
    const { body: propio } = await subir(app, 'token-admin', { datos: { ...DATOS, responsable: 'op@olega.com.ar' } }).expect(201);
    await request(app).patch(`/api/documentos/${propio.id}`).set(como('token-operador')).send(cambios).expect(200);
  });

  it('separa por año y lista todos los años juntos (y los PDF viejos sueltos en el tipo)', async () => {
    const { body: d2025 } = await subir(app, 'token-operador', { datos: { ...DATOS, fechaRealizacion: '2025-06-01' } }).expect(201);
    const { body: d2026 } = await subir(app, 'token-operador').expect(201);
    const carpeta2025 = drive.archivos.get(drive.archivos.get(d2025.id).parents[0]);
    const carpeta2026 = drive.archivos.get(drive.archivos.get(d2026.id).parents[0]);
    assert.equal(carpeta2025.name, '2025');
    assert.equal(carpeta2026.name, '2026');

    // Un PDF de antes de separar por año, directo en la carpeta del tipo
    const viejo = { id: 'pdf-viejo-0000000', name: 'viejo.pdf', mimeType: 'application/pdf', parents: [carpeta2025.parents[0]], properties: {} };
    drive.archivos.set(viejo.id, viejo);

    const { body: lista } = await request(app)
      .get('/api/documentos?categoria=analisis&tipo=aflatoxinas')
      .set(como('token-operador'))
      .expect(200);
    assert.deepEqual(lista.map((d) => d.id).sort(), [d2025.id, d2026.id, viejo.id].sort());
    await request(app).get(`/api/documentos/${viejo.id}/archivo`).set(como('token-operador')).expect(200);
  });

  it('al cambiar el año de realización, mueve el PDF a la carpeta de ese año', async () => {
    const { body: doc } = await subir(app, 'token-admin').expect(201);
    await request(app)
      .patch(`/api/documentos/${doc.id}`)
      .set(como('token-admin'))
      .send({ ...DATOS, fechaRealizacion: '2024-12-31' })
      .expect(200);
    const archivo = drive.archivos.get(doc.id);
    assert.equal(archivo.parents.length, 1);
    assert.equal(drive.archivos.get(archivo.parents[0]).name, '2024');
  });

  it('5 subidas a la vez crean cada carpeta una sola vez', async () => {
    await Promise.all(Array.from({ length: 5 }, () => subir(app, 'token-operador').expect(201)));
    assert.equal(drive.carpetasCreadas, 3); // Análisis + Aflatoxinas + 2026
  });

  it('rechaza archivos que no son PDF aunque digan serlo', async () => {
    await subir(app, 'token-operador', { mime: 'image/png', nombre: 'foto.png' }).expect(400);
    const falso = await subir(app, 'token-operador', { contenido: Buffer.from('no soy un pdf') }).expect(400);
    assert.match(falso.body.mensaje, /PDF/);
  });

  it('rechaza archivos de más de 20 MB', async () => {
    const grande = Buffer.concat([PDF_VALIDO, Buffer.alloc(20 * 1024 * 1024)]);
    const res = await subir(app, 'token-operador', { contenido: grande }).expect(413);
    assert.match(res.body.mensaje, /20 MB/);
  });

  it('rechaza categorías o tipos inventados', async () => {
    await subir(app, 'token-operador', { categoria: 'hackeo' }).expect(400);
    await subir(app, 'token-operador', { tipo: 'inventado' }).expect(400);
  });

  it('el operador no puede eliminar; el admin manda a la papelera', async () => {
    const { body: doc } = await subir(app, 'token-operador').expect(201);
    await request(app).delete(`/api/documentos/${doc.id}`).set(como('token-operador')).expect(403);
    await request(app).delete(`/api/documentos/${doc.id}`).set(como('token-admin')).expect(204);
    assert.equal(drive.archivos.get(doc.id).trashed, true);
    await request(app).delete(`/api/documentos/${doc.id}`).set(como('token-admin')).expect(404);
  });

  it('no deja abrir ni borrar archivos fuera de Documentos generales', async () => {
    const otra = { id: 'carpeta-ajena-000', name: 'RRHH', mimeType: CARPETA, parents: ['otra-carpeta-raiz'] };
    const sub = { id: 'subcarpeta-ajena-0', name: 'Sueldos', mimeType: CARPETA, parents: [otra.id] };
    const pdf = { id: 'pdf-ajeno-0000000', name: 'sueldos.pdf', mimeType: 'application/pdf', parents: [sub.id] };
    for (const f of [otra, sub, pdf]) drive.archivos.set(f.id, f);

    await request(app).get(`/api/documentos/${pdf.id}/archivo`).set(como('token-admin')).expect(403);
    await request(app).delete(`/api/documentos/${pdf.id}`).set(como('token-admin')).expect(403);
  });

  it('abre el PDF para verlo en el navegador', async () => {
    const { body: doc } = await subir(app, 'token-operador').expect(201);
    const res = await request(app).get(`/api/documentos/${doc.id}/archivo`).set(como('token-operador')).expect(200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /inline/);
  });

  it('si borran una carpeta a mano en Drive, la vuelve a crear', async () => {
    const { body: doc } = await subir(app, 'token-operador').expect(201);
    const tipoId = drive.archivos.get(doc.id).parents[0];
    drive.archivos.delete(tipoId); // alguien la borró en Drive
    await subir(app, 'token-operador').expect(201);
  });

  it('bloquea llamadas desde otros sitios web', async () => {
    await request(app).get('/api/salud').set('Origin', 'https://sitio-malo.com').expect(403);
  });
});
