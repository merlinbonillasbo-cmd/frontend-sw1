// src/app/core/services/admin.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UsuarioResponse {
  id: string;
  nombreUsuario: string;
  correo: string;
  nombreCompleto: string;
  rol: string;
  idDepartamento: string;
  nombreDepartamento?: string;
  codigoDepartamento?: string;
  activo: boolean;
  contrasenaTemp?: string;
}

export interface UsuarioRequest {
  nombreCompleto: string;
  correo: string;
  nombreUsuario: string;
  contrasena: string;
  idDepartamento: string;
}

export interface DepartamentoResponse {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  color: string;
  activo: boolean;
  rolAsignado?: string;
  idsMiembros?: string[];
}

export interface DepartamentoRequest {
  codigo: string;
  nombre: string;
  descripcion: string;
  color: string;
  /** Rol que opera en este departamento */
  rolAsignado: string;
}

export interface RolResponse {
  id: string;
  nombreRol: string;
  permisos: string[];
}

export interface RolRequest {
  nombreRol: string;
  permisos: string[];
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

interface PageResponse<T> {
  content: T[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly BASE = 'http://localhost:8080/api/v1/admin';
  private readonly ROLES_BASE = 'http://localhost:8080/api/v1/roles';

  constructor(private http: HttpClient) {}

  // ─── Usuarios ────────────────────────────────────────────
  getUsuarios(): Observable<UsuarioResponse[]> {
    return this.http.get<ApiResponse<UsuarioResponse[]>>(`${this.BASE}/usuarios`).pipe(
      map(r => r.data)
    );
  }

  crearUsuario(payload: UsuarioRequest): Observable<UsuarioResponse> {
    return this.http.post<ApiResponse<UsuarioResponse>>(`${this.BASE}/usuarios`, payload).pipe(
      map(r => r.data)
    );
  }

  editarUsuario(id: string, payload: Partial<UsuarioRequest>): Observable<UsuarioResponse> {
    return this.http.put<ApiResponse<UsuarioResponse>>(`${this.BASE}/usuarios/${id}`, payload).pipe(
      map(r => r.data)
    );
  }

  desactivarUsuario(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.BASE}/usuarios/${id}`).pipe(
      map(() => void 0)
    );
  }

  reactivarUsuario(id: string): Observable<void> {
    return this.http.patch<ApiResponse<void>>(`${this.BASE}/usuarios/${id}/reactivar`, {}).pipe(
      map(() => void 0)
    );
  }

  // ─── Departamentos ───────────────────────────────────────
  getDepartamentos(): Observable<DepartamentoResponse[]> {
    return this.http.get<ApiResponse<DepartamentoResponse[]>>(`${this.BASE}/departamentos`).pipe(
      map(r => r.data)
    );
  }

  crearDepartamento(payload: DepartamentoRequest): Observable<DepartamentoResponse> {
    return this.http.post<ApiResponse<DepartamentoResponse>>(`${this.BASE}/departamentos`, payload).pipe(
      map(r => r.data)
    );
  }

  editarDepartamento(id: string, payload: Partial<DepartamentoRequest>): Observable<DepartamentoResponse> {
    return this.http.put<ApiResponse<DepartamentoResponse>>(`${this.BASE}/departamentos/${id}`, payload).pipe(
      map(r => r.data)
    );
  }

  desactivarDepartamento(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.BASE}/departamentos/${id}`).pipe(
      map(() => void 0)
    );
  }

  // ─── Roles ───────────────────────────────────────────────
  getRoles(): Observable<RolResponse[]> {
    return this.http.get<ApiResponse<RolResponse[] | PageResponse<RolResponse>>>(this.ROLES_BASE).pipe(
      map(r => Array.isArray(r.data) ? r.data : (r.data?.content ?? []))
    );
  }

  crearRol(payload: RolRequest): Observable<RolResponse> {
    return this.http.post<ApiResponse<RolResponse>>(this.ROLES_BASE, payload).pipe(
      map(r => r.data)
    );
  }

  editarRol(id: string, payload: Partial<RolRequest>): Observable<RolResponse> {
    return this.http.put<ApiResponse<RolResponse>>(`${this.ROLES_BASE}/${id}`, payload).pipe(
      map(r => r.data)
    );
  }

  eliminarRol(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.ROLES_BASE}/${id}`).pipe(
      map(() => void 0)
    );
  }
}
