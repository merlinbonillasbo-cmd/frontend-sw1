// src/app/officer/dashboard/officer-dashboard.component.ts
import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { TareaService, Tarea } from '../../core/services/tarea.service';
import { InstanciaService, Instancia, CampoFormulario } from '../../core/services/instancia.service';
import { PoliticaService, Politica } from '../../core/services/politica.service';
import { QuejasService, Queja } from '../../core/services/quejas.service';
import { OfficerWebSocketService, UsuarioPresente, Notificacion } from '../services/officer-websocket.service';
import { Subscription } from 'rxjs';

type Vista = 'tareas' | 'flujos' | 'enviar' | 'quejas';

@Component({
  selector: 'app-officer-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './officer-dashboard.component.html',
  styleUrl: './officer-dashboard.component.css'
})
export class OfficerDashboardComponent implements OnInit, OnDestroy {

  vistaActiva = signal<Vista>('tareas');
  deptNombre = signal<string>('');
  deptCodigo = signal<string>('');

  // Tareas
  tareasPendientes = signal<Tarea[]>([]);
  tareasEnAtencion = signal<Tarea[]>([]);
  cargandoTareas = signal(false);

  // Usuarios activos en el departamento
  usuariosActivos = signal<UsuarioPresente[]>([]);

  // Formulario dinámico
  camposFormulario = signal<CampoFormulario[]>([]);
  datosFormulario = signal<Record<string, any>>({});
  archivosFormulario: Record<string, File> = {};
  tareaActualId = signal<string | null>(null);
  nodoActualLabel = signal<string>('');
  departamentosDestino = signal<string[]>([]);
  guardandoFormulario = signal(false);

  // Políticas publicadas (para iniciar nuevo trámite)
  politicasActivas = signal<Politica[]>([]);
  iniciandoFlujo = signal(false);

  // Quejas
  tipoQueja = signal<'TECNICA' | 'ADMINISTRATIVA' | 'CLIENTE' | 'OTRA'>('TECNICA');
  descripcionQueja = signal<string>('');
  quejasUsuario = signal<Queja[]>([]);
  enviandoQueja = signal(false);

  // Notificaciones
  notificaciones = signal<Notificacion[]>([]);
  badgeNotificaciones = computed(() => this.notificaciones().length);
  dropdownNotificacionesAbierto = signal(false);
  toastNotificacion = signal<string | null>(null);

  // Subscriptions
  private subs = new Subscription();

  readonly fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  constructor(
    public auth: AuthService,
    private tareaService: TareaService,
    private instanciaService: InstanciaService,
    private politicaService: PoliticaService,
    private quejasService: QuejasService,
    private wsService: OfficerWebSocketService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser$();
    if (!user) return;

    // Departamento
    this.deptNombre.set(user.departamentoNombre ?? user.departamentoCodigo ?? '—');
    this.deptCodigo.set(user.departamentoCodigo ?? '');

    // Cargar tareas usando el departamento code (same value stored in Node.idDepartamento)
    const deptId = user.departamentoCodigo ?? user.idDepartamento;
    if (deptId) {
      this.cargarTareas(deptId);
    }

    // Cargar quejas y políticas activas
    this.cargarQuejas(user.userId);
    this.cargarPoliticasActivas();

    // Conectar WebSocket
    if (this.deptCodigo()) {
      this.wsService.connect(this.deptCodigo(), user.userId, user.nombreCompleto);

      this.subs.add(
        this.wsService.presencia$.subscribe(usuarios => {
          this.usuariosActivos.set(usuarios);
        })
      );

      this.subs.add(
        this.wsService.notificaciones$.subscribe(notif => {
          this.agregarNotificacion(notif);
          if (notif.tipo === 'NUEVA_TAREA') {
            this.mostrarToast(`Nueva tarea disponible: ${notif.mensaje || ''}`);
            // Reload tasks to show new task
            const u = this.auth.currentUser$();
            const id = u?.departamentoCodigo ?? u?.idDepartamento;
            if (id) this.cargarTareas(id);
          }
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    const user = this.auth.currentUser$();
    if (user && this.deptCodigo()) {
      this.wsService.disconnect(this.deptCodigo(), user.userId);
    }
  }

  navegarA(vista: Vista): void {
    this.vistaActiva.set(vista);
    // Reload tasks whenever returning to the tasks view
    if (vista === 'tareas') {
      const user = this.auth.currentUser$();
      const deptId = user?.departamentoCodigo ?? user?.idDepartamento;
      if (deptId) this.cargarTareas(deptId);
    }
  }

  cargarTareas(idDepartamento: string): void {
    this.cargandoTareas.set(true);
    this.tareaService.porDepartamento(idDepartamento).subscribe({
      next: data => {
        this.tareasPendientes.set(data.filter(t => t.semaforo === 'ROJO'));
        this.tareasEnAtencion.set(data.filter(t => t.semaforo === 'AMARILLO'));
        this.cargandoTareas.set(false);
      },
      error: () => this.cargandoTareas.set(false)
    });
  }

  cargarPoliticasActivas(): void {
    this.politicaService.listarActivas().subscribe({
      next: data => this.politicasActivas.set(data ?? []),
      error: () => {}
    });
  }

  puedeIniciar(politica: Politica): boolean {
    const user = this.auth.currentUser$();
    if (!user) return false;
    const deptCodigo = user.departamentoCodigo ?? '';
    const deptId = user.idDepartamento ?? '';
    const nodos = politica.nodos ?? [];
    const starters = nodos.filter(n => n.inicioFlujo);
    if (starters.length === 0) return false;
    return starters.some(n => n.idDepartamento === deptCodigo || n.idDepartamento === deptId);
  }

  /** Claim a task (ROJO → AMARILLO) and open its form */
  tomarTarea(tareaId: string): void {
    const user = this.auth.currentUser$();
    if (!user) return;

    this.instanciaService.tomarTarea(tareaId, user.userId, user.nombreCompleto).subscribe({
      next: () => {
        this.mostrarToast('Tarea tomada — cargando formulario...');
        this.abrirFormulario(tareaId);
      },
      error: (err) => {
        const msg = err?.error?.message ?? 'Error al tomar la tarea';
        this.mostrarToast(msg);
      }
    });
  }

  /** Load form fields for a task and switch to the 'enviar' view */
  abrirFormulario(tareaId: string): void {
    this.tareaActualId.set(tareaId);
    this.archivosFormulario = {};
    this.instanciaService.obtenerFormulario(tareaId).subscribe({
      next: data => {
        this.camposFormulario.set(data.campos || []);
        this.nodoActualLabel.set(data.nodoLabel ?? '');
        const destinos = data.departamentosDestino ?? (data.departamentoDestino ? [data.departamentoDestino] : []);
        this.departamentosDestino.set(destinos);
        const init: Record<string, any> = {};
        (data.campos || []).forEach(c => init[c.nombre] = c.valor ?? '');
        this.datosFormulario.set(init);
        this.navegarA('enviar');
      },
      error: () => {
        this.mostrarToast('Error al cargar el formulario');
        // Still open the view with an empty fallback so officer can continue
        this.camposFormulario.set([{ nombre: 'observaciones', tipo: 'texto', requerido: false }]);
        this.datosFormulario.set({ observaciones: '' });
        this.departamentosDestino.set([]);
        this.navegarA('enviar');
      }
    });
  }

  /** Open form for a task that is already in AMARILLO state */
  continuarTarea(tareaId: string): void {
    this.abrirFormulario(tareaId);
  }

  onArchivoSeleccionado(event: Event, nombreCampo: string): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file) {
      this.archivosFormulario[nombreCampo] = file;
      const datos = { ...this.datosFormulario() };
      datos[nombreCampo] = file.name;
      this.datosFormulario.set(datos);
    }
  }

  /** Complete task (AMARILLO → VERDE) and trigger next node */
  completarTarea(): void {
    const id = this.tareaActualId();
    if (!id) return;

    this.guardandoFormulario.set(true);
    this.instanciaService.avanzarTarea(id, this.datosFormulario()).subscribe({
      next: (instancia) => {
        this.guardandoFormulario.set(false);
        if (instancia?.estado === 'COMPLETADO') {
          this.mostrarToast('Flujo finalizado exitosamente');
        } else if (instancia?.estado === 'CANCELADO') {
          this.mostrarToast('Flujo cancelado');
        } else {
          this.mostrarToast('Tarea completada — flujo avanzado al siguiente departamento');
        }
        this.tareaActualId.set(null);
        this.camposFormulario.set([]);
        this.datosFormulario.set({});
        this.archivosFormulario = {};
        this.nodoActualLabel.set('');
        this.departamentosDestino.set([]);
        this.navegarA('tareas');
        const user = this.auth.currentUser$();
        const deptId = user?.departamentoCodigo ?? user?.idDepartamento;
        if (deptId) this.cargarTareas(deptId);
      },
      error: (err) => {
        this.guardandoFormulario.set(false);
        const msg = err?.error?.message ?? 'Error al completar la tarea';
        this.mostrarToast(msg);
      }
    });
  }

  /** Start a new workflow instance (creates first task for AT dept) */
  iniciarFlujo(idPolitica: string): void {
    const user = this.auth.currentUser$();
    const nombre = window.prompt('Nombre del flujo (opcional):');
    if (nombre === null) {
      return; // cancelado
    }
    const nombreFlujo = nombre.trim() || undefined;
    this.iniciandoFlujo.set(true);
    this.instanciaService.iniciarFlujo(idPolitica, user?.userId, nombreFlujo).subscribe({
      next: (instancia) => {
        this.iniciandoFlujo.set(false);
        const nombreFlujo = (instancia?.datosProceso as any)?.nombreFlujo;
        if (nombreFlujo) {
          this.mostrarToast(`Nuevo trámite iniciado: ${nombreFlujo}`);
        } else {
          this.mostrarToast('Nuevo trámite iniciado exitosamente');
        }
        const deptId = user?.departamentoCodigo ?? user?.idDepartamento;
        if (deptId) this.cargarTareas(deptId);
      },
      error: (err) => {
        this.iniciandoFlujo.set(false);
        const msg = err?.error?.message ?? 'Error al iniciar el trámite';
        this.mostrarToast(msg);
      }
    });
  }

  cargarQuejas(idUsuario: string): void {
    this.quejasService.listarPorUsuario(idUsuario).subscribe({
      next: data => this.quejasUsuario.set(data)
    });
  }

  enviarQueja(): void {
    const user = this.auth.currentUser$();
    if (!user || !this.descripcionQueja().trim()) return;

    const queja: Queja = {
      tipo: this.tipoQueja(),
      descripcion: this.descripcionQueja().trim(),
      idUsuario: user.userId,
      nombreUsuario: user.nombreCompleto,
      departamentoCodigo: this.deptCodigo(),
      departamentoNombre: this.deptNombre()
    };

    this.enviandoQueja.set(true);
    this.quejasService.crear(queja).subscribe({
      next: () => {
        this.enviandoQueja.set(false);
        this.descripcionQueja.set('');
        this.mostrarToast('Queja enviada exitosamente');
        this.cargarQuejas(user.userId);
      },
      error: () => {
        this.enviandoQueja.set(false);
        this.mostrarToast('Error al enviar la queja');
      }
    });
  }

  agregarNotificacion(notif: Notificacion): void {
    const lista = this.notificaciones();
    this.notificaciones.set([notif, ...lista].slice(0, 5));
  }

  toggleDropdownNotificaciones(): void {
    this.dropdownNotificacionesAbierto.update(v => !v);
  }

  limpiarNotificaciones(): void {
    this.notificaciones.set([]);
    this.dropdownNotificacionesAbierto.set(false);
  }

  mostrarToast(mensaje: string): void {
    this.toastNotificacion.set(mensaje);
    setTimeout(() => this.toastNotificacion.set(null), 4000);
  }

  getSemaforoColor(semaforo?: string): string {
    const map: Record<string, string> = {
      ROJO: 'bg-red-500/15 text-red-400 border-red-500/30',
      AMARILLO: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      VERDE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
    return map[semaforo ?? ''] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }

  logout(): void {
    this.auth.logout();
  }
}


