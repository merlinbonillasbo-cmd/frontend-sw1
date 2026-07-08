import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Instancia {
  id: string;
  idPolitica: string;
  idCliente?: string;
  idDepartamentoActual?: string;
  nodoActualId?: string;
  estado?: string;
  datosProceso?: Record<string, unknown>;
  motivoRechazo?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface CampoFormulario {
  nombre: string;
  tipo: 'texto' | 'imagen' | 'pdf' | 'sino' | 'fecha' | 'readonly';
  requerido: boolean;
  ayuda?: string;
  valor?: any;
}

interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class InstanciaService {
  private readonly BASE = 'http://100.59.223.50:8080/api/v1/instancias';

  constructor(private http: HttpClient) {}

  /** Claim a task (ROJO → AMARILLO). id = ActiveTask ID */
  tomarTarea(tareaId: string, idUsuario: string, nombreUsuario: string): Observable<Instancia> {
    return this.http.post<ApiResponse<Instancia>>(
      `${this.BASE}/${tareaId}/tomar?idUsuario=${encodeURIComponent(idUsuario)}&nombreUsuario=${encodeURIComponent(nombreUsuario)}`, {})
      .pipe(map(r => r.data));
  }

  /** Get form fields for a task. id = ActiveTask ID */
  obtenerFormulario(tareaId: string): Observable<{
    campos: CampoFormulario[];
    tareaId?: string;
    nodoLabel?: string;
    datosEntrada?: Record<string, any>;
    departamentoDestino?: string;
    departamentoDestinoCodigo?: string;
    departamentosDestino?: string[];
    departamentosDestinoCodigo?: string[];
    clienteId?: string;
    clienteNombre?: string;
    clienteCorreo?: string;
    clienteUsuario?: string;
    crearUsuarioCliente?: boolean;
    clienteCreado?: boolean;
    correoSugerido?: string;
  }> {
    return this.http.get<ApiResponse<{
      campos: CampoFormulario[];
      tareaId?: string;
      nodoLabel?: string;
      datosEntrada?: Record<string, any>;
      departamentoDestino?: string;
      departamentoDestinoCodigo?: string;
      departamentosDestino?: string[];
      departamentosDestinoCodigo?: string[];
      clienteId?: string;
      clienteNombre?: string;
      clienteCorreo?: string;
      clienteUsuario?: string;
      crearUsuarioCliente?: boolean;
      clienteCreado?: boolean;
      correoSugerido?: string;
    }>>(
      `${this.BASE}/${tareaId}/formulario`)
      .pipe(map(r => r.data));
  }

  /** Complete a task and advance to next node. id = ActiveTask ID */
  avanzarTarea(tareaId: string, datos: Record<string, any>): Observable<Instancia> {
    return this.http.post<ApiResponse<Instancia>>(`${this.BASE}/${tareaId}/avanzar`, datos)
      .pipe(map(r => r.data));
  }

  /** Start a new workflow instance and trigger first task */
  iniciarFlujo(idPolitica: string, idCliente?: string, nombreFlujo?: string): Observable<Instancia> {
    return this.http.post<ApiResponse<Instancia>>(`${this.BASE}/iniciar`, { idPolitica, idCliente, nombreFlujo })
      .pipe(map(r => r.data));
  }

  crearCliente(tareaId: string, contrasena: string): Observable<{ idCliente?: string; correo?: string; nombreUsuario?: string; nombreCompleto?: string }> {
    return this.http.post<ApiResponse<{ idCliente?: string; correo?: string; nombreUsuario?: string; nombreCompleto?: string }>>(
      `${this.BASE}/${tareaId}/crear-cliente`, { contrasena })
      .pipe(map(r => r.data));
  }

  asignarCliente(tareaId: string, idCliente: string): Observable<{ idCliente?: string; correo?: string; nombreUsuario?: string; nombreCompleto?: string }> {
    return this.http.post<ApiResponse<{ idCliente?: string; correo?: string; nombreUsuario?: string; nombreCompleto?: string }>>(
      `${this.BASE}/${tareaId}/asignar-cliente`, { idCliente })
      .pipe(map(r => r.data));
  }

  misInstancias(): Observable<Instancia[]> {
    return this.http.get<ApiResponse<Instancia[]>>(`${this.BASE}/mis`)
      .pipe(map(r => r.data));
  }
}
