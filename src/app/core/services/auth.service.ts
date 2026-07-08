// src/app/core/services/auth.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

export interface AuthUser {
  token: string;
  userId: string;
  correo: string;
  nombreCompleto: string;
  rol: string;
  /** ID interno del departamento (para consultas de tareas) */
  idDepartamento?: string;
  /** Código del departamento del usuario (para routing OFFICER) */
  departamentoCodigo?: string;
  /** Nombre completo del departamento (para mostrar en UI) */
  departamentoNombre?: string;
  nombreEmpresa: string;
}

export interface LoginRequest {
  correo: string;
  contrasena: string;
}

export interface RegistroRequest {
  nombreCompleto: string;
  correo: string;
  nombreUsuario: string;
  contrasena: string;
  nombreEmpresa: string;
}

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://localhost:8080/api/v1/auth';

  currentUser$ = signal<AuthUser | null>(this.loadFromStorage());

  constructor(private http: HttpClient, private router: Router) {}

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage;
  }

  registro(payload: RegistroRequest): Observable<ApiResponse<AuthUser>> {
    return this.http.post<ApiResponse<AuthUser>>(`${this.API}/registro`, payload);
  }

  login(payload: LoginRequest): Observable<ApiResponse<AuthUser>> {
    return this.http.post<ApiResponse<AuthUser>>(`${this.API}/login`, payload);
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.API}/logout`, {}).subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/login']);
  }

  persistSession(data: AuthUser): void {
    const storage = this.getStorage();
    if (storage) {
      storage.setItem('token', data.token);
      storage.setItem('rol', data.rol);
      storage.setItem('wf_user', JSON.stringify(data));
      // Clear legacy storage to avoid cross-tab bleed.
      localStorage.removeItem('token');
      localStorage.removeItem('rol');
      localStorage.removeItem('wf_user');
    }
    this.currentUser$.set(data);
  }

  clearSession(): void {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem('token');
      storage.removeItem('rol');
      storage.removeItem('wf_user');
      localStorage.removeItem('token');
      localStorage.removeItem('rol');
      localStorage.removeItem('wf_user');
    }
    this.currentUser$.set(null);
  }

  getToken(): string | null {
    const storage = this.getStorage();
    return storage ? storage.getItem('token') : null;
  }

  getRol(): string | null {
    const storage = this.getStorage();
    return storage ? storage.getItem('rol') : null;
  }

  getDepartamentoCodigo(): string | null {
    return this.currentUser$()?.departamentoCodigo ?? null;
  }

  getDepartamentoNombre(): string | null {
    return this.currentUser$()?.departamentoNombre ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.getRol() === 'ADM_DISENADOR';
  }

  private loadFromStorage(): AuthUser | null {
    const storage = this.getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem('wf_user');
      if (raw) return JSON.parse(raw) as AuthUser;

      // Legacy fallback: migrate localStorage to sessionStorage once.
      const legacy = localStorage.getItem('wf_user');
      if (legacy) {
        const token = localStorage.getItem('token');
        const rol = localStorage.getItem('rol');
        if (token) storage.setItem('token', token);
        if (rol) storage.setItem('rol', rol);
        storage.setItem('wf_user', legacy);
        localStorage.removeItem('token');
        localStorage.removeItem('rol');
        localStorage.removeItem('wf_user');
        return JSON.parse(legacy) as AuthUser;
      }
      return null;
    } catch {
      return null;
    }
  }
}
