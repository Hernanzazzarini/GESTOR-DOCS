# Gestor de documentación

Sistema web de la empresa armado con la misma lógica que **Monitoreo Horno PCC4**:
login con Firebase, roles, permisos por módulo, el mismo encabezado y una pantalla de **Inicio**
con un acceso por cada módulo. El primer módulo es **Documentación**: los PDF se guardan en la
Unidad compartida de Google Drive, en `Documentos generales / Categoría / Tipo`.

```
Usuario ─► Angular (Firebase Hosting) ─┬─► Firebase Auth + Firestore   (login, roles, módulos)
                                       └─► API Express (Render) ─► Google Drive (los PDF)
```

| Carpeta     | Qué es                                   | Dónde se publica        |
|-------------|------------------------------------------|-------------------------|
| `frontend/` | Angular 21, igual que el PCC4            | Firebase Hosting (gratis) |
| `backend/`  | API Node + Express + googleapis          | Render (gratis)         |

Todo funciona **sin tarjeta**: Firebase en el plan gratuito (Spark) y Render en el plan Free.

---

## Índice

1. [Configurar Firebase](#1-configurar-firebase-una-sola-vez)
2. [Crear el primer administrador](#2-crear-el-primer-administrador)
3. [Configurar Google Drive](#3-configurar-google-drive)
4. [Probarlo en tu Mac](#4-probarlo-en-tu-mac)
5. [Publicarlo](#5-publicarlo)
6. [Agregar categorías, tipos y módulos](#6-agregar-categorías-tipos-y-módulos)
7. [Seguridad](#7-seguridad)
8. [Problemas comunes](#8-problemas-comunes)

---

## 1. Configurar Firebase (una sola vez)

Usamos el proyecto `gestor-documentacion` que ya creaste en Google Cloud. Firebase y Google Cloud
son lo mismo por dentro: solo hay que "activarle" Firebase.

1. Entrá a <https://console.firebase.google.com> con la cuenta de la empresa.
2. Tocá **Crear un proyecto** → abajo, **"¿Agregar Firebase a un proyecto de Google Cloud?"**
   → elegí **gestor-documentacion**.
3. Si te pregunta por Google Analytics, **desactivalo** (no hace falta).
4. Si te ofrece un plan, quedate en **Spark (sin costo)**. No pide tarjeta.

**Activar el login con correo y contraseña**

5. Menú de la izquierda → **Compilación → Authentication → Comenzar**.
6. Pestaña **Método de acceso** → **Correo electrónico/contraseña** → **Habilitar** → Guardar.

**Crear la base Firestore** (guarda los usuarios y sus roles, como en el PCC4)

7. **Compilación → Firestore Database → Crear base de datos**.
8. Ubicación: `southamerica-east1 (São Paulo)`. Modo: **producción**.

**Registrar la app web y copiar la configuración**

9. Arriba a la izquierda, ⚙️ → **Configuración del proyecto** → abajo, **Tus apps** → ícono `</>`.
10. Nombre: `gestor-docs`. **No** tildes Firebase Hosting todavía → **Registrar app**.
11. Aparece un bloque `const firebaseConfig = { ... }`. Copiá esos valores en
    **`frontend/src/environments/firebase.ts`** (reemplazá cada `COMPLETAR`).

> ✅ **Comprobación:** en `firebase.ts` no queda ningún `COMPLETAR`, y `projectId` es el mismo que
> ves en ⚙️ Configuración del proyecto → **ID del proyecto**.

> ⚠️ Si tu ID del proyecto **no** es exactamente `gestor-documentacion` (a veces Google le agrega
> números), cambialo también en `frontend/.firebaserc` y en `backend/.env` (`FIREBASE_PROJECT_ID`).

---

## 2. Crear el primer administrador

Es lo mismo que hiciste en el PCC4. Después, el resto de los usuarios se crean desde la pantalla
**Gestión de Usuarios**.

1. **Authentication → Users → Agregar usuario**: tu correo y una contraseña.
2. Copiá el **UID de usuario** que aparece en la lista (una cadena larga como `aB3dE...`).
3. **Firestore Database → + Iniciar colección**:
   - ID de la colección: `users`
   - ID del documento: **pegá el UID**
   - Campos:

     | Campo   | Tipo   | Valor              |
     |---------|--------|--------------------|
     | `email` | string | tu correo          |
     | `role`  | string | `admin`            |

4. Guardar.

Las reglas de seguridad (`frontend/firestore.rules`) se publican en el paso 4.

---

## 3. Configurar Google Drive

Si ya hiciste esta parte en octubre (Service Account `gestor-docs` y Unidad compartida), solo
comprobá cada punto.

1. **Google Drive API habilitada** en el proyecto `gestor-documentacion`
   (Google Cloud → APIs y servicios).
2. **Service Account** creada, con su **clave JSON descargada**.
3. **Unidad compartida** en Drive con la carpeta **`Documentos generales`** adentro.
4. La Service Account agregada como **miembro** de la Unidad compartida con el rol
   **Administrador de contenido** (con "Colaborador" no puede eliminar).
5. El **ID de la carpeta** `Documentos generales`: abrila en Drive y copiá lo que está al final
   de la URL:
   `https://drive.google.com/drive/folders/`**`1AbCdEf...`** ← eso.

Las carpetas de categoría y de tipo **no hace falta crearlas**: el sistema las crea solo la
primera vez que alguien sube un PDF.

---

## 4. Probarlo en tu Mac

Necesitás dos ventanas de Terminal: una para el backend y otra para el frontend.

### Backend (Terminal 1)

```bash
cd ~/proyectos/gestor-docs/backend
```
```bash
npm install
```
```bash
cp .env.example .env
```

1. Copiá el JSON de la Service Account dentro de `backend/` con el nombre **`service-account.json`**.
2. Abrí `backend/.env` en VS Code y completá `ROOT_FOLDER_ID` con el ID del paso 3.

```bash
npm run dev
```

> ✅ **Comprobación:** la Terminal muestra
> `✅ API del gestor de documentación en http://localhost:3000/api`.
> Si abrís <http://localhost:3000/api/salud> en el navegador, ves `{"ok":true}`.

### Frontend (Terminal 2)

```bash
cd ~/proyectos/gestor-docs/frontend
```
```bash
npm install
```
```bash
npm start
```

> ✅ **Comprobación:** abrís <http://localhost:4200>, ves la pantalla de login, entrás con el admin
> del paso 2 y aparece **Inicio** con las tarjetas **Documentación** y **Gestión de Usuarios**.

### Publicar las reglas de Firestore (una vez, y cada vez que las cambies)

```bash
cd ~/proyectos/gestor-docs/frontend
```
```bash
firebase deploy --only firestore:rules
```

(Si te dice que no encuentra el proyecto, corré antes `firebase login` y después
`firebase use gestor-documentacion`.)

### Prueba completa

1. **Documentación → Análisis** → Tipo **Aflatoxinas** → elegí un PDF, completá área, fecha de realización y responsable (el vencimiento es opcional) → **Subir**.
2. Aparece en la tabla de abajo. En Drive ves `Documentos generales / Análisis / Aflatoxinas / tu-archivo.pdf`.
3. Tocá el nombre: el PDF se abre en una pestaña nueva.
4. **Eliminar** → **Sí, eliminar**: desaparece de la tabla y queda en la **papelera de la Unidad
   compartida** (se puede recuperar durante 30 días).
5. Probá subir una imagen: tiene que decir *"Solo se aceptan archivos PDF."*
6. **Gestión de Usuarios** → creá un usuario **Operador** → cerrá sesión y entrá con él:
   puede ver y subir, pero no tiene el botón **Eliminar**.

### Pruebas automáticas

```bash
cd ~/proyectos/gestor-docs/backend && npm test      # 15 pruebas de la API (Drive simulado)
cd ~/proyectos/gestor-docs/frontend && npm test     # pruebas de permisos y formato
```

---

## 5. Publicarlo

Primero subí el proyecto a GitHub (un repo nuevo, por ejemplo `gestor-documentacion`).
El `.env` y el `service-account.json` **no se suben**: el `.gitignore` ya los excluye.

> ✅ **Comprobación antes de hacer push:** `git status` **no** muestra `service-account.json` ni `.env`.

### 5.1 Backend en Render

1. Entrá a <https://render.com> → **Get Started** → registrate **con GitHub** (no pide tarjeta).
2. **New → Web Service** → elegí el repo.
3. Completá:

   | Campo           | Valor            |
   |-----------------|------------------|
   | Name            | `gestor-docs-api` |
   | Region          | la que esté más cerca (ej. Virginia / Ohio) |
   | Root Directory  | `backend`        |
   | Runtime         | Node             |
   | Build Command   | `npm install`    |
   | Start Command   | `npm start`      |
   | Instance Type   | **Free**         |

4. **Environment Variables**:

   | Clave                            | Valor |
   |----------------------------------|-------|
   | `ROOT_FOLDER_ID`                 | el ID de `Documentos generales` |
   | `FIREBASE_PROJECT_ID`            | `gestor-documentacion` |
   | `GOOGLE_APPLICATION_CREDENTIALS` | `/etc/secrets/service-account.json` |
   | `ORIGENES_PERMITIDOS`            | `https://gestor-documentacion.web.app,https://gestor-documentacion.firebaseapp.com` |

5. **Secret Files → Add Secret File**: Filename `service-account.json`, y en Contents pegá
   **todo** el contenido del JSON.
6. **Create Web Service**. Cuando termine, arriba aparece la dirección, por ejemplo
   `https://gestor-docs-api.onrender.com`.

> ✅ **Comprobación:** `https://gestor-docs-api.onrender.com/api/salud` muestra `{"ok":true}`.

### 5.2 Frontend en Firebase Hosting (como el PCC4)

1. En `frontend/src/environments/environment.prod.ts`, poné en `apiUrl` la dirección de Render
   **terminada en `/api`**.
2. Luego:

```bash
cd ~/proyectos/gestor-docs/frontend
```
```bash
npm run build
```
```bash
firebase deploy --only hosting
```

> ✅ **Comprobación:** al final la Terminal muestra `Hosting URL: https://gestor-documentacion.web.app`.
> Abrila, iniciá sesión y subí un PDF.

### Sobre el plan gratis de Render

Si nadie usa el sistema durante 15 minutos, el servidor se "duerme". La primera persona que
entra después espera **hasta un minuto** (la pantalla avisa *"El servidor se está iniciando…"*).
Después anda normal. Si la empresa quiere que ande siempre rápido, la opción paga de Render o un
servidor propio se deciden más adelante: **el código no cambia**.

---

## 6. Agregar categorías, tipos y módulos

### Una categoría o un tipo nuevo (RF-09)

Se edita **un solo archivo**: `backend/src/config/categorias.js`. Por ejemplo, para sumar
"Calidad" con dos tipos:

```js
{
  id: 'calidad',            // va en la URL: /documentos/calidad (minúsculas, sin acentos)
  nombre: 'Calidad',        // nombre de la carpeta en Drive
  descripcion: 'Procedimientos y registros',
  tipos: [
    { id: 'procedimientos', nombre: 'Procedimientos' },
    { id: 'registros', nombre: 'Registros' },
  ],
},
```

Guardás, hacés push y Render lo vuelve a publicar solo. **El frontend no se toca.**

### Procedimientos generales

Es una tarjeta propia en Inicio (módulo `procedimientos`, en Drive la carpeta
**Documentos generales › Procedimientos generales › Área de uso › Año**). Usa la misma pantalla
que una categoría, pero cada procedimiento lleva además: código, nombre del documento, realizó,
Nro de revisión, estado (**En uso** / **Obsoleto**), cantidad de copias impresas y en qué áreas
están impresas. Las áreas de uso (Seguridad alimentaria, Calidad, Logística) están en
`backend/src/config/categorias.js` y se pueden agregar más desde la pantalla (**＋ Agregar área**).
Los avisos de vencimiento salen por el mismo Apps Script (los obsoletos no avisan), y en la planilla
**Registro de documentos** los procedimientos van en su propia solapa, **Procedimientos**.

Los usuarios que tienen módulos elegidos a mano en **Gestión de Usuarios** no lo ven hasta que
el admin les tilde **Procedimientos generales**.

### Un módulo nuevo (por ejemplo "Mantenimiento")

1. `frontend/src/app/permisos.ts`: sumá `'mantenimiento'` al tipo `Pantalla` y un objeto a
   `PANTALLAS` (texto, descripción, ícono y roles). Con eso ya aparece en **Inicio**, en el
   **encabezado** y en las casillas de **Gestión de Usuarios**.
2. Creá el componente en `frontend/src/app/components/mantenimiento/`. Usá
   `<app-encabezado titulo="Mantenimiento">` arriba, como las demás pantallas.
3. `frontend/src/app/app.routes.ts`: agregá la ruta con
   `canActivate: [authGuard, pantallaGuard]` y `data: { pantalla: 'mantenimiento' }`.
4. Si el módulo usa la API, sumalo también en `backend/src/config/permisos.js`.

---

## 7. Seguridad

- **La clave de la Service Account** solo existe en el backend (tu Mac y los Secret Files de Render).
  El navegador nunca habla directo con Drive.
- **La configuración de Firebase** (`firebase.ts`) **no es secreta**: está pensada para ir en el
  navegador. Lo que protege los datos es el login y las reglas de `firestore.rules`.
- **El backend controla todo de nuevo** aunque alguien modifique el frontend:
  - Exige el token de login de Firebase y lee el rol del usuario.
  - Solo acepta categorías y tipos del archivo de configuración (el frontend nunca manda IDs de carpeta).
  - Solo acepta PDF reales (revisa el contenido, no solo la extensión) de hasta 20 MB.
  - Solo **Administrador** y **Encargado** pueden eliminar.
  - Solo deja abrir o borrar archivos que estén dentro de `Documentos generales`.
  - Solo responde a las direcciones de `ORIGENES_PERMITIDOS`.
- **Sin carpetas duplicadas**: si dos personas suben al mismo tiempo, la carpeta se crea una sola vez.
- **Eliminar = papelera**: nada se borra para siempre desde el sistema.

---

## 8. Problemas comunes

| Mensaje | Qué pasa | Solución |
|---|---|---|
| `Falta la variable ROOT_FOLDER_ID` | No completaste el `.env` | Paso 4, Backend |
| `No se encontró la clave de la Service Account` | Falta `backend/service-account.json` | Copiá el JSON con ese nombre exacto |
| Login: *"Falta completar la configuración de Firebase"* | Quedó algún `COMPLETAR` en `firebase.ts` | Paso 1, punto 11 |
| Login: *"Su usuario no tiene un rol asignado"* | No existe `users/{UID}` en Firestore o el UID está mal | Paso 2 |
| *"No hay conexión con el servidor"* | El backend no está corriendo | Terminal 1: `npm run dev` |
| `Google Drive respondió: File not found` | `ROOT_FOLDER_ID` incorrecto o la Service Account no es miembro de la Unidad | Paso 3 |
| `Google Drive respondió: ... insufficient permissions` al eliminar | La Service Account tiene rol Colaborador | Cambiala a **Administrador de contenido** |
| En producción: *"Origen no permitido"* | La dirección de Firebase no está en `ORIGENES_PERMITIDOS` | Render → Environment |
