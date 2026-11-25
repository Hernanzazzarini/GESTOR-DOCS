import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth';
import { EncabezadoComponent } from '../encabezado/encabezado';
import { PANTALLAS, Perfil, pantallasPermitidas } from '../../permisos';

interface Tarjeta {
  ruta: string;
  icono: string;
  titulo: string;
  texto: string;
}

/** Pantalla de inicio: una tarjeta por cada módulo que el usuario tiene habilitado. */
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, EncabezadoComponent],
  templateUrl: './inicio.html',
})
export class InicioComponent implements OnInit {
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  perfil: Perfil | null = null;
  cargando = true;

  ngOnInit(): void {
    this.authService
      .perfil()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((perfil) => {
        this.perfil = perfil;
        this.cargando = false;
      });
  }

  get tarjetas(): Tarjeta[] {
    const permitidas = pantallasPermitidas(this.perfil);
    const tarjetas: Tarjeta[] = PANTALLAS.filter((p) => permitidas.includes(p.id)).map((p) => ({
      ruta: '/' + p.id,
      icono: p.icono,
      titulo: p.texto,
      texto: p.descripcion,
    }));
    if (this.perfil?.rol === 'admin') {
      tarjetas.push({
        ruta: '/admin-usuarios',
        icono: '👥',
        titulo: 'Gestión de Usuarios',
        texto: 'Alta de usuarios, roles y módulos que puede ver cada uno.',
      });
    }
    return tarjetas;
  }
}
