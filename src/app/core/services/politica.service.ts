import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Politica {
  id: string;
  titulo: string;
  descripcion?: string;
  slug?: string;
  estado?: string;
  nodos?: Array<{ idDepartamento?: string; inicioFlujo?: boolean }>;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class PoliticaService {
  private readonly BASE = 'http://18.222.251.205:8080/api/v1/politicas';

  constructor(private http: HttpClient) {}

  listarTodas(): Observable<Politica[]> {
    return this.http.get<ApiResponse<Politica[]>>(this.BASE).pipe(map(r => r.data));
  }

  listarActivas(): Observable<Politica[]> {
    return this.listarTodas().pipe(
      map(politicas => politicas.filter(p => p.estado === 'ACTIVO'))
    );
  }
}
