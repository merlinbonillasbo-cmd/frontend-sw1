import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface FlujoDefinicion {
  id?: string;
  titulo: string;
  descripcion?: string;
  slug?: string;
  xmlBpmn?: string;
  estado?: 'BORRADOR' | 'ACTIVO' | 'ARCHIVADO' | 'DEPRECADO';
  idPropietario?: string;
  colaboradores?: string[];
  carriles?: any[];
  nodos?: any[];
  conexiones?: any[];
  etiquetas?: string[];
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class FluiosApiService {
  private readonly BASE = 'http://100.59.223.50:8080/api/v1/politicas';

  constructor(private http: HttpClient) {}

  listar(): Observable<FlujoDefinicion[]> {
    return this.http.get<ApiResponse<FlujoDefinicion[]>>(this.BASE).pipe(
      map(r => r.data)
    );
  }

  obtener(id: string): Observable<FlujoDefinicion> {
    return this.http.get<ApiResponse<FlujoDefinicion>>(`${this.BASE}/${id}`).pipe(
      map(r => r.data)
    );
  }

  crear(payload: FlujoDefinicion): Observable<FlujoDefinicion> {
    return this.http.post<ApiResponse<FlujoDefinicion>>(this.BASE, payload).pipe(
      map(r => r.data)
    );
  }

  actualizar(id: string, payload: FlujoDefinicion): Observable<FlujoDefinicion> {
    return this.http.put<ApiResponse<FlujoDefinicion>>(`${this.BASE}/${id}`, payload).pipe(
      map(r => r.data)
    );
  }

  publicar(id: string): Observable<FlujoDefinicion> {
    return this.http.post<ApiResponse<FlujoDefinicion>>(`${this.BASE}/${id}/publicar`, {}).pipe(
      map(r => r.data)
    );
  }

  revertirABorrador(id: string): Observable<FlujoDefinicion> {
    return this.http.post<ApiResponse<FlujoDefinicion>>(`${this.BASE}/${id}/revertir`, {}).pipe(
      map(r => r.data)
    );
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<ApiResponse<void>>(`${this.BASE}/${id}`).pipe(
      map(() => void 0)
    );
  }
}
