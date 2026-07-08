// src/app/supervisor/services/supervisor.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CuelloDeBottella {
  idNodo: string;
  etiquetaNodo?: string;
  duracionPromedioMs: number;
  totalTareas: number;
  tareasRetrasadas: number;
}

export interface RendimientoDept {
  idDepartamento: string;
  totalTareas: number;
  tareasRetrasadas: number;
  porcentajeRetraso: number;
  duracionPromedioMs: number;
}

export interface FlujoAtendido {
  id: string;
  idPolitica?: string;
  estado: 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO' | 'EN_ESPERA';
  motivoRechazo?: string;
  datosProceso?: Record<string, any>;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class SupervisorService {
  private readonly BASE = 'http://100.59.223.50:8080/api/v1';

  constructor(private http: HttpClient) {}

  getCuellos(): Observable<CuelloDeBottella[]> {
    return this.http
      .get<ApiResponse<CuelloDeBottella[]>>(`${this.BASE}/analytics/cuellos`)
      .pipe(map(r => r.data ?? []));
  }

  getRendimientoDepartamentos(): Observable<RendimientoDept[]> {
    return this.http
      .get<ApiResponse<RendimientoDept[]>>(`${this.BASE}/analytics/rendimiento-departamentos`)
      .pipe(map(r => r.data ?? []));
  }

  getFlujos(): Observable<FlujoAtendido[]> {
    return this.http
      .get<ApiResponse<PageResponse<FlujoAtendido>>>(`${this.BASE}/instancias?size=200`)
      .pipe(map(r => r.data?.content ?? []));
  }
}
