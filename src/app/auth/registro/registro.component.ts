// src/app/auth/registro/registro.component.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css'
})
export class RegistroComponent {
  form = {
    nombreCompleto: '',
    correo: '',
    nombreUsuario: '',
    contrasena: '',
    confirmarContrasena: '',
    nombreEmpresa: ''
  };

  loading = signal(false);
  errorMsg = signal('');
  showPassword = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(): void {
    this.errorMsg.set('');

    if (this.form.contrasena !== this.form.confirmarContrasena) {
      this.errorMsg.set('Las contraseñas no coinciden');
      return;
    }
    if (this.form.contrasena.length < 8) {
      this.errorMsg.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    this.loading.set(true);
    this.auth.registro({
      nombreCompleto: this.form.nombreCompleto.trim(),
      correo: this.form.correo.trim(),
      nombreUsuario: this.form.nombreUsuario.trim(),
      contrasena: this.form.contrasena,
      nombreEmpresa: this.form.nombreEmpresa.trim()
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/login'], {
          queryParams: { msg: 'Cuenta creada. Inicia sesión para continuar.' }
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.errorMsg.set(err.error?.message ?? 'Error al registrar. Intenta de nuevo.');
      }
    });
  }
}
