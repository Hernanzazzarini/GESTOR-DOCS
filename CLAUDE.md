# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Company document manager. Two independent npm projects (no root package.json, no monorepo tooling):

- `frontend/` — Angular 21 (standalone components, Vitest via `@angular/build:unit-test`), deployed to Firebase Hosting. Uses Firebase Auth (email/password) and Firestore (`users` collection only) directly from the browser.
- `backend/` — Node ≥22 ESM + Express 5 + `googleapis`, deployed to Render (free tier, sleeps after 15 min idle). Stores PDFs in a Google Drive Shared Drive under `Documentos generales / <Categoría> / <Tipo> / <Año>` (year of `fechaRealizacion`).

The browser never talks to Drive; only the backend does, via a Service Account. The whole codebase (identifiers, comments, user-facing messages, README) is in Spanish (Argentine voseo, e.g. "Tenés que iniciar sesión") — keep new code and messages consistent with that. Comments reference requirement IDs like `RF-05`, `RNF`.

## Commands

Backend (`cd backend`):
- `npm run dev` — run with `node --watch`, loads `.env` if present
- `npm start` — production start
- `npm test` — `node --test` (runs `test/api.test.js`; Drive/Firebase/Firestore are faked, no credentials needed)
- Single test: `node --test --test-name-pattern="<name>" test/api.test.js`

Frontend (`cd frontend`):
- `npm start` — `ng serve --host 127.0.0.1` on :4200 (Safari forces https on `localhost`, so the app is opened at http://127.0.0.1:4200); `proxy.conf.json` forwards `/api` to `localhost:3000`
- `npm run build` — output `dist/gestor-docs/browser` (what Firebase Hosting serves)
- `npm test` — `ng test` (Vitest + jsdom); single file: `npx ng test --include src/app/permisos.spec.ts`
- Deploy: `firebase deploy --only hosting` / `firebase deploy --only firestore:rules`
- Prettier config in `frontend/.prettierrc`

Local backend needs `backend/.env` (copy `.env.example`; `ROOT_FOLDER_ID` and `FIREBASE_PROJECT_ID` are required) and `backend/service-account.json`. Both are gitignored secrets — never commit them.

## Architecture

### Backend dependency injection
`src/app.js` exports `crearApp({ drive, rootFolderId, verificarToken, leerPerfil, origenes })`. All external dependencies are injected; `src/index.js` wires the real ones (from `config/drive.js`, `config/entorno.js`, `servicios/usuarios.js`), while tests pass in-memory fakes (`crearDriveFalso()` in `test/api.test.js`). Preserve this when adding features so tests stay offline.

Layers: `routes/index.js` → `middlewares/` (auth, multer upload) → `controllers/documentos.js` → `servicios/` (Drive logic). Errors are thrown as `ErrorHttp(status, mensaje)` (`servicios/errores.js`) and handled by `middlewares/errores.js`; Express 5 catches async throws, so middlewares throw rather than calling `next(err)`. JSON error shape is `{ mensaje }`.

### Auth flow
1. Frontend `services/token-interceptor.ts` adds `Authorization: Bearer <Firebase ID token>` to requests whose URL starts with `environment.apiUrl`.
2. Backend `autenticar` verifies the token with `firebase-admin` (project ID only, no admin credentials) and then reads `users/{uid}` from Firestore **via REST using the user's own token** (`crearLectorPerfil`, 1-min cache). This relies on `frontend/firestore.rules` letting users read their own doc.
3. Profile shape: Firestore field `role` → `perfil.rol`; optional `pantallas` array overrides role-based module defaults. Roles: `admin`, `encargado`, `operador`. Admin sees everything; only admin/encargado can delete.

### Permissions are duplicated on purpose
`frontend/src/app/permisos.ts` (UI show/hide, guards) and `backend/src/config/permisos.js` (enforcement) must be kept in sync manually. Adding a module touches: `Pantalla` type + `PANTALLAS` in `permisos.ts`, a component under `components/`, a route in `app.routes.ts` with `canActivate: [authGuard, pantallaGuard]` and `data: { pantalla: '<id>' }`, and `MODULOS` in backend `permisos.js` if it uses the API. Inicio cards, header nav, and user-admin checkboxes are all derived from `PANTALLAS`.

### Categories live only in the backend
`backend/src/config/categorias.js` is the single source of categories and their fixed types. The frontend fetches them from `GET /api/categorias`, so adding a category needs no frontend change. Users can also add types from the screen (`POST /api/categorias/:categoria/tipos { nombre }`, `servicios/tipos.js`): a user-added type is just a Drive folder inside the category folder, merged after the fixed ones (60 s cache). Its id is `idDeNombre(nombre)` (no accents/case/punctuation), which is also the uniqueness key — duplicates get 409; `idDeNombre` is mirrored in frontend `services/documentos.ts`, and fixed type ids must equal `idDeNombre` of their `nombre` so the folder isn't listed twice. Types can't be deleted from the app (remove the folder in Drive). The `nombre` is the Drive folder name — renaming it creates a new folder (old docs stay in the old one). Clients only send category/type IDs, never Drive folder IDs.

### Drive service invariants (`servicios/carpetas.js`, `servicios/documentos.js`)
- All Drive calls must pass `supportsAllDrives: true` (Shared Drive).
- Folders are created lazily on first upload. `carpetas.js` caches folder IDs and dedupes concurrent lookups via shared in-flight promises so simultaneous uploads don't create duplicate folders; if duplicates exist, the oldest is used. On a Drive 404, the cache is cleared and the operation retried once (`conReintento`).
- Year folders (`ES_ANIO`, 4 digits) sit under each tipo. Listing queries the tipo folder plus all its year folders (older PDFs may sit directly in the tipo). Editing `fechaRealizacion` to another year moves the file (`addParents`/`removeParents`).
- Download/delete call `verificarUbicacion`, which walks parents (file → [año →] tipo → categoría → root) to ensure the file is an allowed format inside `ROOT_FOLDER_ID`, preventing access to arbitrary Shared Drive files by ID.
- Delete moves to trash (never permanent).
- Per-document data (`area`, `fechaRealizacion`, `fechaVencimiento`, `responsable` (a registered user's email), `diasAviso` "30,7,0", `avisar1..avisar10`, `subidoPor`) lives in the Drive file's public `properties` — NOT `appProperties`, which are private to the OAuth client and invisible to the Apps Script. Older files may still have `appProperties`; `desdePropiedades` merges both. Drive caps each key+value at 124 bytes, hence one property per email and the length limits in `servicios/datos-documento.js` (validation + (de)serialization). On edit (`PATCH /api/documentos/:id`) unused keys are sent as `null` so Drive deletes them. Dates are `AAAA-MM-DD` strings; the frontend formats them by hand (`formatearFecha`) to avoid the UTC off-by-one. Search/filters (año, área, vencimiento) run client-side in `filtrarDocumentos`.
- Edit permission (`puedeEditar`: admin/encargado, uploader, or responsable) is in backend `permisos.js` and mirrored in `CategoriaComponent.puedeEditar`.
- Uploads: PDF, Word (.doc/.docx) and Excel (.xls/.xlsx), defined in `config/formatos.js` (mirrored as `EXTENSIONES` in frontend `services/documentos.ts` and `FORMATOS` in `Avisos.gs`). Format comes from the filename extension and must match the magic bytes (`%PDF-`, zip, OLE); the browser's MIME is ignored. Stored in Drive with the real MIME (never converted to Google Docs); the saved name keeps the original extension, also on edit. multer memory storage, 20 MB limit, field name `archivo`; filename is re-decoded latin1→UTF-8.
- `GET /api/documentos/:id/archivo` serves inline ("Ver", PDF only); `?descargar=1` sends `Content-Disposition: attachment` ("Descargar", any format).

### Expiry alerts (`apps-script/`)
Not deployed with the app: `Avisos.gs` is pasted by hand into a Google Sheet's Apps Script (steps in `apps-script/LEEME.md`), runs daily as the installing user, reads the Drive `properties`, rewrites the "Documentos" sheet and emails via `MailApp`. Sent alerts are remembered in Script Properties (`aviso|fileId|vencimiento|dias`). The responsable/avisar pickers read the `users` collection, which needs the `allow list` rule in `frontend/firestore.rules` deployed.

### Frontend
- `environments/firebase.ts` holds the (public) Firebase web config; `environment.prod.ts` sets `apiUrl` to the Render URL ending in `/api`.
- Feature components are lazy-loaded (`loadComponent`); every screen uses `<app-encabezado titulo="...">` as its header.
- Locale is `es-AR` (dates/numbers).
- CORS: backend only accepts origins listed in `ORIGENES_PERMITIDOS`.
