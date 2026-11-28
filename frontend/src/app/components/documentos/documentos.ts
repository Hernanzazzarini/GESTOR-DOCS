import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EncabezadoComponent } from '../encabezado/encabezado';
import { Categoria, DocumentosService, describirError } from '../../services/documentos';

/**
 * Módulo Documentación (RF-01): una tarjeta por categoría.
 * Las categorías vienen del back end (backend/src/config/categorias.js), así que
 * agregar una no requiere tocar el front end (RF-09).
 */
@Component({
  selector: 'app-documentos',
  standalone: true,
  imports: [RouterLink, EncabezadoComponent],
  templateUrl: './documentos.html',
})
export class DocumentosComponent implements OnInit {
  private documentos = inject(DocumentosService);
  private destroyRef = inject(DestroyRef);

  categorias: Categoria[] = [];
  cargando = true;
  // El servidor gratuito se "duerme": si tarda, avisamos que puede demorar
  demorado = false;
  error = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.demorado = false;
    const aviso = setTimeout(() => (this.demorado = true), 3000);

    this.documentos
      .categorias()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          clearTimeout(aviso);
          // Procedimientos generales tiene su propia tarjeta en Inicio
          this.categorias = r.categorias.filter((c) => (c.modulo ?? 'documentos') === 'documentos');
          this.cargando = false;
        },
        error: (err) => {
          clearTimeout(aviso);
          this.documentos.olvidarCategorias();
          this.error = describirError(err, 'No se pudieron cargar las categorías.');
          this.cargando = false;
        },
      });
  }
}
