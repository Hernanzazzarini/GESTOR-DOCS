import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { map, take } from 'rxjs';

// Gestión de Usuarios: solo el admin. El resto vuelve a Inicio.
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAdmin().pipe(
    take(1),
    map((isAdmin) => (isAdmin ? true : router.createUrlTree(['/']))),
  );
};
