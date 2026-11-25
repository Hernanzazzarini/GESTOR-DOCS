import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from '../../services/auth';
import { rutaInicial } from '../../permisos';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  errorMessage = '';
  loading = false;

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        // Al iniciar sesión todos van a Inicio, salvo que no tengan ningún módulo habilitado
        this.authService
          .perfil()
          .pipe(take(1))
          .subscribe((perfil) => {
            this.loading = false;
            const ruta = rutaInicial(perfil);
            if (ruta) {
              this.router.navigate([ruta]);
            } else {
              this.errorMessage = perfil
                ? 'Su usuario no tiene módulos habilitados. Consulte al administrador.'
                : 'Su usuario no tiene un rol asignado. Consulte al administrador.';
              this.authService.logout().subscribe();
            }
          });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = this.describirError(err);
        console.error(err);
      },
    });
  }

  private describirError(err: any): string {
    switch (err?.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-email':
        return 'Correo o contraseña incorrectos. Por favor, verifique sus datos.';
      case 'auth/operation-not-allowed':
        return 'El acceso con correo y contraseña no está habilitado en Firebase.';
      case 'auth/user-disabled':
        return 'Esta cuenta está deshabilitada. Consulte al administrador.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Espere unos minutos o restablezca la contraseña.';
      case 'auth/network-request-failed':
        return 'No hay conexión con el servidor. Verifique su conexión a internet.';
      case 'auth/invalid-api-key':
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
        return 'Falta completar la configuración de Firebase (src/environments/firebase.ts).';
    }
    return `No se pudo iniciar sesión (${err?.code ?? err?.message ?? 'error desconocido'}).`;
  }
}
