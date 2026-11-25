import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { DocumentosService } from '../../services/documentos';
import { PANTALLAS, Perfil, pantallasPermitidas } from '../../permisos';

interface Enlace {
  ruta: string;
  texto: string;
}

/** Encabezado común (igual que el PCC4): título, usuario conectado, navegación y cierre de sesión. */
@Component({
  selector: 'app-encabezado',
  standalone: true,
  imports: [RouterLink],
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

  ngOnInit(): void {
    this.authService.user$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => (this.email = user?.email ?? ''));
    this.authService
      .perfil()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((perfil) => (this.perfil = perfil));
  }

  /** Inicio + módulos habilitados + Gestión de Usuarios (admin), sin la pantalla actual. */
  get enlaces(): Enlace[] {
    const actual = this.router.url.split('?')[0];
    const permitidas = pantallasPermitidas(this.perfil);
    const enlaces: Enlace[] = [{ ruta: '/', texto: 'Inicio' }];
    enlaces.push(
      ...PANTALLAS.filter((p) => permitidas.includes(p.id)).map((p) => ({
        ruta: '/' + p.id,
        texto: p.texto,
      })),
    );
    if (this.perfil?.rol === 'admin') {
      enlaces.push({ ruta: '/admin-usuarios', texto: 'Gestión de Usuarios' });
    }
    return enlaces.filter((e) => e.ruta !== actual);
  }

  logout(): void {
    this.authService.logout().subscribe(() => {
      this.documentos.olvidarCategorias();
      this.router.navigate(['/login']);
    });
  }
}
