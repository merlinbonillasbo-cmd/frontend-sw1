import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Queja {
  id?: string;
  tipo: 'TECNICA' | 'ADMINISTRATIVA' | 'CLIENTE' | 'OTRA';
  descripcion: string;
  idUsuario?: string;
  nombreUsuario?: string;
  departamentoCodigo?: string;
  departamentoNombre?: string;
  fechaCreacion?: string;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class QuejasService {
  private readonly BASE = 'http://100.59.223.50:8080/api/v1/quejas';

  constructor(private http: HttpClient) {}

  crear(queja: Queja): Observable<Queja> {
    return this.http.post<ApiResponse<Queja>>(this.BASE, queja)
      .pipe(map(r => r.data));
  }

  listarPorUsuario(idUsuario: string): Observable<Queja[]> {
    return this.http.get<ApiResponse<Queja[]>>(`${this.BASE}/usuario/${idUsuario}`)
      .pipe(map(r => r.data));
  }

  listarPorDepartamento(codigo: string): Observable<Queja[]> {
    return this.http.get<ApiResponse<Queja[]>>(`${this.BASE}/departamento/${codigo}`)
      .pipe(map(r => r.data));
  }
}
