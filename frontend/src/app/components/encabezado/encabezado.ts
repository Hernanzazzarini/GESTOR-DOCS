import { Component, DestroyRef, HostListener, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth';
import { DocumentosService } from '../../services/documentos';
import { PANTALLAS, Perfil, ROLES, pantallasPermitidas } from '../../permisos';

interface Enlace {
  ruta: string;
  texto: string;
  icono: string;
}

const CLAVE_COLAPSADO = 'gestor-docs.sidebar-colapsada';

/** Lee si el menú estaba achicado (en Safari privado localStorage puede fallar: se ignora). */
function leerColapsado(): boolean {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === '1';
  } catch {
    return false;
  }
}

/**
 * Menú lateral (sidebar) común a todas las pantallas: módulos habilitados, usuario conectado
 * y cierre de sesión. Arriba del contenido queda una barra con el título de la pantalla.
 * - En la compu se puede achicar a solo íconos (se recuerda en este navegador).
 * - En el celular se esconde y se abre con el botón ☰.
 * Se usa igual que antes: <app-encabezado titulo="..."> como primer hijo de <div class="pagina">.
 */
@Component({
  selector: 'app-encabezado',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './encabezado.html',
  styleUrl: './encabezado.css',
})
export class EncabezadoComponent implements OnInit {
  private authService = inject(AuthService);
  private documentos = inject(DocumentosService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  @Input() titulo = '';

  email = '';
  perfil: Perfil | null = null;
  colapsado = leerColapsado(); // compu: solo íconos
  abierto = false; // celular: menú desplegado

  /** "sábado, 28 de noviembre" */
  readonly hoy = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  ngOnInit(): void {
    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => (this.email = user?.email ?? ''));
    this.authService
      .perfil()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((perfil) => (this.perfil = perfil));
    // En el celular, el menú se cierra al cambiar de pantalla
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => (this.abierto = false));
  }

  /** Inicio + módulos habilitados + Gestión de Usuarios (admin). */
  get enlaces(): Enlace[] {
    const permitidas = pantallasPermitidas(this.perfil);
    const enlaces: Enlace[] = [{ ruta: '/', texto: 'Inicio', icono: '🏠' }];
    enlaces.push(
      ...PANTALLAS.filter((p) => permitidas.includes(p.id)).map((p) => ({
        ruta: '/' + p.id,
        texto: p.texto,
        icono: p.icono,
      })),
    );
    if (this.perfil?.rol === 'admin') {
      enlaces.push({ ruta: '/admin-usuarios', texto: 'Gestión de Usuarios', icono: '👥' });
    }
    return enlaces;
  }

  /** Letra del círculo del usuario. */
  get inicial(): string {
    return (this.email[0] ?? '?').toUpperCase();
  }

  get textoRol(): string {
    return ROLES.find((r) => r.id === this.perfil?.rol)?.texto ?? '';
  }

  alternarColapso(): void {
    this.colapsado = !this.colapsado;
    try {
      localStorage.setItem(CLAVE_COLAPSADO, this.colapsado ? '1' : '0');
    } catch {
      // sin localStorage no se recuerda, no pasa nada
    }
  }

  @HostListener('document:keydown.escape')
  cerrarMenu(): void {
    this.abierto = false;
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.documentos.olvidarCategorias();
      this.router.navigate(['/login']);
    });
  }
}
