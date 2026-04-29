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
  nombreUsuario?: string;
  semaforo?: 'ROJO' | 'AMARILLO' | 'VERDE';
  prioridad?: 'ALTA' | 'MEDIA' | 'BAJA';
  fechaVencimiento?: string;
  fechaInicio?: string;
  fechaCreacion?: string;
  datos?: Record<string, unknown>;
}

export interface TareaHecha {
  id: string;
  idInstancia: string;
  idNodo: string;
  etiquetaNodo?: string;
  idDepartamento: string;
  idUsuario?: string;
  nombreUsuario?: string;
  fechaArchivo?: string;
  duracionMs?: number;
  fueRetrasado?: boolean;
  datos?: Record<string, unknown>;
  fechaCreacion?: string;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class TareaService {
  private readonly BASE = 'http://18.222.251.205:8080/api/v1/tareas';

  constructor(private http: HttpClient) {}

  porDepartamento(idDepartamento: string): Observable<Tarea[]> {
    return this.http
      .get<ApiResponse<Tarea[]>>(`${this.BASE}/departamento/${idDepartamento}`)
      .pipe(map(r => r.data));
  }

  porDepartamentoHechas(idDepartamento: string): Observable<TareaHecha[]> {
    return this.http
      .get<ApiResponse<TareaHecha[]>>(`http://18.222.251.205:8080/api/v1/historial/tareas/departamento/${idDepartamento}`)
      .pipe(map(r => r.data));
  }

  porUsuario(idUsuario: string): Observable<Tarea[]> {
    return this.http
      .get<ApiResponse<Tarea[]>>(`${this.BASE}/usuario/${idUsuario}`)
      .pipe(map(r => r.data));
  }
}
