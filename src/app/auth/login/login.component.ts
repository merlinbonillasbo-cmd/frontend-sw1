// src/app/auth/login/login.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  form = { correo: '', contrasena: '' };

  loading = signal(false);
  errorMsg = signal('');
  infoMsg = signal('');
  showPassword = signal(false);

  constructor(private auth: AuthService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    const msg = this.route.snapshot.queryParamMap.get('msg');
    if (msg) this.infoMsg.set(msg);
  }

  togglePassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  onSubmit(): void {
    this.errorMsg.set('');
    this.loading.set(true);

    this.auth.login({ correo: this.form.correo.trim(), contrasena: this.form.contrasena }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.auth.persistSession(res.data);
        const rol = res.data.rol;
        if (rol === 'ADM_DISENADOR') {
          this.router.navigate(['/admin/dashboard']);
        } else if (rol === 'SUPERVISOR') {
          this.router.navigate(['/supervisor/dashboard']);
        } else if (rol === 'OFFICER') {
          const dept = res.data.departamentoCodigo;
          if (dept) {
            this.router.navigate(['/officer', dept, 'dashboard']);
          } else {
            this.router.navigate(['/officer/dashboard']);
          }
        } else if (rol === 'CLIENT') {
          this.router.navigate(['/cliente/dashboard']);
        } else {
          this.router.navigate(['/no-autorizado']);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        if (err.status === 401) {
          this.errorMsg.set('Correo o contraseña incorrectos');
        } else {
          this.errorMsg.set(err.error?.message ?? 'Error al iniciar sesión. Intenta de nuevo.');
        }
      }
    });
  }
}
