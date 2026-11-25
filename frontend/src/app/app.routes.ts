import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { InicioComponent } from './components/inicio/inicio';
import { AdminUsuariosComponent } from './components/admin-usuarios/admin-usuarios';
import { authGuard } from './guards/auth-guard';
import { adminGuard } from './guards/admin-guard';
import { pantallaGuard } from './guards/pantalla-guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  // Pantalla de inicio: tarjetas con los módulos que el usuario tiene habilitados
  { path: '', component: InicioComponent, canActivate: [authGuard], pathMatch: 'full' },

  // ── Módulo Documentación ─────────────────────────────────────────────
  // Se cargan aparte (loadComponent) para que el paquete inicial no crezca con cada módulo
  {
    path: 'documentos',
    loadComponent: () =>
      import('./components/documentos/documentos').then((m) => m.DocumentosComponent),
    canActivate: [authGuard, pantallaGuard],
    data: { pantalla: 'documentos' },
  },
  {
    path: 'documentos/:categoria',
    loadComponent: () =>
      import('./components/categoria/categoria').then((m) => m.CategoriaComponent),
    canActivate: [authGuard, pantallaGuard],
    data: { pantalla: 'documentos' },
  },

  // ➕ Módulos nuevos acá, con canActivate: [authGuard, pantallaGuard] y data: { pantalla: '<id>' }

  { path: 'admin-usuarios', component: AdminUsuariosComponent, canActivate: [authGuard, adminGuard] },
  { path: '**', redirectTo: '' },
];
