import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Tarea {
  id: string;
  idInstancia: string;
  idNodo: string;
  idDepartamentoAsignado: string;
  idUsuarioAsignado?: string;
  semaforo?: 'ROJO' | 'AMARILLO' | 'VERDE';
  prioridad?: 'ALTA' | 'MEDIA' | 'BAJA';
  fechaVencimiento?: string;
  fechaInicio?: string;
  fechaCreacion?: string;
  datos?: Record<string, unknown>;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class TareaService {
  private readonly BASE = 'http://localhost:8080/api/v1/tareas';

  constructor(private http: HttpClient) {}

  porDepartamento(idDepartamento: string): Observable<Tarea[]> {
    return this.http
      .get<ApiResponse<Tarea[]>>(`${this.BASE}/departamento/${idDepartamento}`)
      .pipe(map(r => r.data));
  }

  porUsuario(idUsuario: string): Observable<Tarea[]> {
    return this.http
      .get<ApiResponse<Tarea[]>>(`${this.BASE}/usuario/${idUsuario}`)
      .pipe(map(r => r.data));
  }
}
