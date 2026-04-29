// src/app/admin/dashboard/admin-dashboard.component.ts
import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  AdminService,
  UsuarioResponse,
  UsuarioRequest,
  DepartamentoResponse,
  DepartamentoRequest,
  RolResponse,
  RolRequest
} from '../../core/services/admin.service';
import { FluiosApiService, FlujoDefinicion } from '../../pizarra/services/flujos-api.service';
import { TareaService, Tarea } from '../../core/services/tarea.service';
import { InstanciaService, CampoFormulario } from '../../core/services/instancia.service';
import { OfficerWebSocketService, Notificacion } from '../../officer/services/officer-websocket.service';

type Section = 'dashboard' | 'usuarios' | 'departamentos' | 'roles' | 'flujos' | 'tareas' | 'formulario' | 'pizarra';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  activeSection = signal<Section>('dashboard');
  sidebarOpen = signal(true);

  // Usuario data
  usuarios = signal<UsuarioResponse[]>([]);
  usuariosLoading = signal(false);
  showUserModal = signal(false);
  editingUser = signal<UsuarioResponse | null>(null);
  userForm: UsuarioRequest = { nombreCompleto: '', correo: '', nombreUsuario: '', contrasena: '', idDepartamento: '' };
  userModalError = signal('');
  userModalLoading = signal(false);
  tempPasswordShown = signal('');

  // Departamento data
  departamentos = signal<DepartamentoResponse[]>([]);
  depLoading = signal(false);
  showDepModal = signal(false);
  editingDep = signal<DepartamentoResponse | null>(null);
  depForm: DepartamentoRequest = { codigo: '', nombre: '', descripcion: '', color: '#0ea5e9', rolAsignado: '' };
  depModalError = signal('');
  depModalLoading = signal(false);

  roles = ['ADM_DISENADOR', 'SUPERVISOR', 'OFFICER', 'CLIENT'];

  // Rol data
  rolesList = signal<RolResponse[]>([]);
  rolesLoading = signal(false);
  showRolModal = signal(false);
  editingRol = signal<RolResponse | null>(null);
  rolForm: RolRequest = { nombreRol: '', permisos: [] };
  rolModalError = signal('');
  rolModalLoading = signal(false);

  // Flujos publicados
  flujos = signal<FlujoDefinicion[]>([]);
  flujosLoading = signal(false);

  // ── Tareas del departamento ──────────────────────────────
  tareasPendientes = signal<Tarea[]>([]);
  tareasEnAtencion = signal<Tarea[]>([]);
  cargandoTareas = signal(false);
  deptCodigo = signal<string>('');

  // Formulario dinámico
  camposFormulario = signal<CampoFormulario[]>([]);
  datosFormulario = signal<Record<string, any>>({});
  archivosFormulario: Record<string, File> = {};
  tareaActualId = signal<string | null>(null);
  nodoActualLabel = signal<string>('');
  guardandoFormulario = signal(false);

  // Datos que viajan en el flujo
  datosEntrada = signal<Record<string, any>>({});
  tieneDatosEntrada = computed(() => Object.keys(this.datosEntrada()).length > 0);
  departamentosDestino = signal<string[]>([]);
  crearUsuarioCliente = signal(false);
  clienteCreado = signal(false);
  correoSugerido = signal<string | null>(null);
  contrasenaCliente = signal('');
  creandoCliente = signal(false);
  clienteFiltro = signal('');
  clienteSeleccionadoId = signal<string | null>(null);
  clienteAsociado = signal<{ id: string; nombreCompleto: string; correo: string; nombreUsuario: string } | null>(null);
  readonly clientesDisponibles = computed(() =>
    this.usuarios().filter(u => u.activo && u.rol === 'CLIENT')
  );
  readonly clientesFiltrados = computed(() => {
    const q = this.normalizarTexto(this.clienteFiltro());
    const base = this.clientesDisponibles();
    if (!q) return base;
    return base.filter(u => {
      const texto = this.normalizarTexto(`${u.nombreCompleto} ${u.correo} ${u.nombreUsuario}`);
      return texto.includes(q);
    });
  });

  // Notificaciones WebSocket
  notificaciones = signal<Notificacion[]>([]);
  badgeNotificaciones = computed(() => this.notificaciones().length);
  dropdownNotificacionesAbierto = signal(false);
  toastNotificacion = signal<string | null>(null);

  // Pizarra embebida
  pizarraUrl = signal('/pizarra');
  pizarraSafeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.pizarraUrl())
  );

  private subs = new Subscription();

  // Gráfica: usuarios activos por departamento
  readonly graficoDepto = computed(() => {
    const usuarios = this.usuarios();
    const departamentos = this.departamentos();
    const data = departamentos
      .filter(d => d.activo)
      .map(d => ({
        nombre: d.nombre,
        color: d.color ?? '#38bdf8',
        count: usuarios.filter(u => u.idDepartamento === d.id && u.activo).length
      }))
      .sort((a, b) => b.count - a.count);
    const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count)) : 0;
    const yMax = Math.max(Math.ceil(maxCount / 3) * 3, 18);
    const yDivisions = Array.from({ length: yMax / 3 }, (_, i) => (i + 1) * 3);
    return { data, yMax, yDivisions };
  });

  constructor(
    public auth: AuthService,
    private adminService: AdminService,
    private flujosApi: FluiosApiService,
    private tareaService: TareaService,
    private instanciaService: InstanciaService,
    private wsService: OfficerWebSocketService,
    public router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadUsuarios();
    this.loadDepartamentos();
    this.loadRoles();

    const user = this.auth.currentUser$();
    if (!user) return;
    const codigo = user.departamentoCodigo ?? '';
    this.deptCodigo.set(codigo);

    if (codigo) {
      this.cargarTareas(codigo);
      this.wsService.connect(codigo, user.userId, user.nombreCompleto);

      this.subs.add(
        this.wsService.notificaciones$.subscribe(notif => {
          this.agregarNotificacion(notif);
          if (notif.tipo === 'NUEVA_TAREA') {
            this.mostrarToast(`Nueva tarea: ${notif.mensaje ?? ''}`);
            this.cargarTareas(codigo);
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

  navigate(section: Section): void {
    this.activeSection.set(section);
    if (section === 'flujos' && this.flujos().length === 0) {
      this.loadFlujos();
    }
    if (section === 'tareas') {
      const codigo = this.deptCodigo();
      if (codigo) this.cargarTareas(codigo);
    }
  }

  abrirPizarra(url: string = '/pizarra'): void {
    this.pizarraUrl.set(url);
    this.activeSection.set('pizarra');
  }

  // ─── Tareas ───────────────────────────────────────────────
  cargarTareas(codigoDept: string): void {
    this.cargandoTareas.set(true);
    this.tareaService.porDepartamento(codigoDept).subscribe({
      next: data => {
        this.tareasPendientes.set(data.filter(t => t.semaforo === 'ROJO'));
        this.tareasEnAtencion.set(data.filter(t => t.semaforo === 'AMARILLO'));
        this.cargandoTareas.set(false);
      },
      error: () => this.cargandoTareas.set(false)
    });
  }

  tomarTarea(tareaId: string): void {
    const user = this.auth.currentUser$();
    if (!user) return;
    this.instanciaService.tomarTarea(tareaId, user.userId, user.nombreCompleto).subscribe({
      next: () => {
        this.mostrarToast('Tarea tomada — cargando formulario...');
        this.abrirFormulario(tareaId);
      },
      error: err => this.mostrarToast(err?.error?.message ?? 'Error al tomar la tarea')
    });
  }

  continuarTarea(tareaId: string): void {
    this.abrirFormulario(tareaId);
  }

  abrirFormulario(tareaId: string): void {
    this.tareaActualId.set(tareaId);
    this.archivosFormulario = {};
    this.clienteFiltro.set('');
    this.instanciaService.obtenerFormulario(tareaId).subscribe({
      next: data => {
        this.camposFormulario.set(data.campos || []);
        this.nodoActualLabel.set(data.nodoLabel ?? '');
        this.datosEntrada.set(data.datosEntrada || {});
        const destinos = data.departamentosDestino ?? (data.departamentoDestino ? [data.departamentoDestino] : []);
        this.departamentosDestino.set(destinos);
        this.crearUsuarioCliente.set(!!data.crearUsuarioCliente);
        this.clienteCreado.set(!!data.clienteCreado);
        this.correoSugerido.set(data.correoSugerido ?? null);
        this.clienteSeleccionadoId.set(data.clienteId ?? null);
        if (data.clienteId && data.clienteNombre && data.clienteCorreo && data.clienteUsuario) {
          this.clienteAsociado.set({
            id: data.clienteId,
            nombreCompleto: data.clienteNombre,
            correo: data.clienteCorreo,
            nombreUsuario: data.clienteUsuario
          });
        } else {
          this.clienteAsociado.set(null);
        }
        const init: Record<string, any> = { ...(data.datosEntrada || {}) };
        (data.campos || []).forEach(c => {
          if (init[c.nombre] === undefined) {
            init[c.nombre] = c.valor ?? '';
          }
        });
        this.datosFormulario.set(init);
        this.navigate('formulario');
      },
      error: () => {
        this.mostrarToast('Error al cargar el formulario');
        this.camposFormulario.set([{ nombre: 'observaciones', tipo: 'texto', requerido: false }]);
        this.datosFormulario.set({ observaciones: '' });
        this.datosEntrada.set({});
        this.departamentosDestino.set([]);
        this.crearUsuarioCliente.set(false);
        this.clienteCreado.set(false);
        this.correoSugerido.set(null);
        this.clienteSeleccionadoId.set(null);
        this.clienteAsociado.set(null);
        this.clienteFiltro.set('');
        this.navigate('formulario');
      }
    });
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
          this.mostrarToast('Tarea completada — flujo avanzado');
        }
        this.tareaActualId.set(null);
        this.camposFormulario.set([]);
        this.datosFormulario.set({});
        this.archivosFormulario = {};
        this.nodoActualLabel.set('');
        this.datosEntrada.set({});
        this.departamentosDestino.set([]);
        this.crearUsuarioCliente.set(false);
        this.clienteCreado.set(false);
        this.correoSugerido.set(null);
        this.contrasenaCliente.set('');
        this.clienteSeleccionadoId.set(null);
        this.clienteAsociado.set(null);
        this.clienteFiltro.set('');
        this.navigate('tareas');
      },
      error: err => {
        this.guardandoFormulario.set(false);
        this.mostrarToast(err?.error?.message ?? 'Error al completar la tarea');
      }
    });
  }

  crearUsuarioClienteDesdeTarea(): void {
    const tareaId = this.tareaActualId();
    if (!tareaId) return;
    const pwd = this.contrasenaCliente().trim();
    if (!pwd) {
      this.mostrarToast('Ingresa una contraseña para el cliente');
      return;
    }
    this.creandoCliente.set(true);
    this.instanciaService.crearCliente(tareaId, pwd).subscribe({
      next: (resp) => {
        this.creandoCliente.set(false);
        this.clienteCreado.set(true);
        if (resp?.correo) this.correoSugerido.set(resp.correo);
        if (resp?.idCliente && resp?.nombreCompleto && resp?.correo && resp?.nombreUsuario) {
          this.clienteAsociado.set({
            id: resp.idCliente,
            nombreCompleto: resp.nombreCompleto,
            correo: resp.correo,
            nombreUsuario: resp.nombreUsuario
          });
          this.clienteSeleccionadoId.set(resp.idCliente);
        }
        this.mostrarToast('Usuario cliente creado');
      },
      error: (err) => {
        this.creandoCliente.set(false);
        this.mostrarToast(err?.error?.message ?? 'Error al crear usuario cliente');
      }
    });
  }

  asignarClienteExistente(): void {
    const tareaId = this.tareaActualId();
    const idCliente = this.clienteSeleccionadoId();
    if (!tareaId || !idCliente) {
      this.mostrarToast('Selecciona un cliente');
      return;
    }
    this.creandoCliente.set(true);
    this.instanciaService.asignarCliente(tareaId, idCliente).subscribe({
      next: (resp) => {
        this.creandoCliente.set(false);
        this.clienteCreado.set(true);
        if (resp?.idCliente && resp?.nombreCompleto && resp?.correo && resp?.nombreUsuario) {
          this.clienteAsociado.set({
            id: resp.idCliente,
            nombreCompleto: resp.nombreCompleto,
            correo: resp.correo,
            nombreUsuario: resp.nombreUsuario
          });
          this.clienteSeleccionadoId.set(resp.idCliente);
        }
        this.mostrarToast('Cliente asociado al flujo');
      },
      error: (err) => {
        this.creandoCliente.set(false);
        this.mostrarToast(err?.error?.message ?? 'Error al asignar cliente');
      }
    });
  }

  // ─── Notificaciones ───────────────────────────────────────
  agregarNotificacion(notif: Notificacion): void {
    this.notificaciones.set([notif, ...this.notificaciones()].slice(0, 5));
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

  private normalizarTexto(texto: string): string {
    return (texto ?? '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .trim();
  }

  // ─── Usuarios ─────────────────────────────────────────────
  loadUsuarios(): void {
    this.usuariosLoading.set(true);
    this.adminService.getUsuarios().subscribe({
      next: data => { this.usuarios.set(data); this.usuariosLoading.set(false); },
      error: () => this.usuariosLoading.set(false)
    });
  }

  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.userForm = { nombreCompleto: '', correo: '', nombreUsuario: '', contrasena: '', idDepartamento: '' };
    this.userModalError.set('');
    this.tempPasswordShown.set('');
    this.showUserModal.set(true);
  }

  openEditUserModal(user: UsuarioResponse): void {
    this.editingUser.set(user);
    this.userForm = {
      nombreCompleto: user.nombreCompleto,
      correo: user.correo,
      nombreUsuario: user.nombreUsuario,
      contrasena: '',
      idDepartamento: user.idDepartamento ?? ''
    };
    this.userModalError.set('');
    this.tempPasswordShown.set('');
    this.showUserModal.set(true);
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.tempPasswordShown.set('');
  }

  saveUser(): void {
    this.userModalError.set('');
    this.userModalLoading.set(true);

    const payload: UsuarioRequest = {
      nombreCompleto: this.userForm.nombreCompleto.trim(),
      correo: this.userForm.correo.trim(),
      nombreUsuario: this.userForm.nombreUsuario.trim(),
      contrasena: this.userForm.contrasena,
      idDepartamento: this.userForm.idDepartamento?.trim() ?? ''
    };

    const editing = this.editingUser();
    const obs = editing
      ? this.adminService.editarUsuario(editing.id, payload)
      : this.adminService.crearUsuario(payload);

    obs.subscribe({
      next: result => {
        this.userModalLoading.set(false);
        if (!editing && result.contrasenaTemp) {
          this.tempPasswordShown.set(result.contrasenaTemp);
        } else {
          this.closeUserModal();
          this.loadUsuarios();
        }
      },
      error: err => {
        this.userModalLoading.set(false);
        this.userModalError.set(err.error?.message ?? 'Error al guardar usuario');
      }
    });
  }

  confirmTempPassword(): void {
    this.tempPasswordShown.set('');
    this.closeUserModal();
    this.loadUsuarios();
  }

  deleteUser(id: string): void {
    if (!confirm('¿Eliminar este usuario?')) return;
    this.adminService.desactivarUsuario(id).subscribe({
      next: () => this.loadUsuarios()
    });
  }

  reactivateUser(id: string): void {
    if (!confirm('¿Reactivar este usuario?')) return;
    this.adminService.reactivarUsuario(id).subscribe({
      next: () => this.loadUsuarios()
    });
  }

  getRolBadgeClass(rol: string): string {
    const map: Record<string, string> = {
      ADMIN: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      DESIGNER: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      SUPERVISOR: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
      OFFICER: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      CLIENT: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    };
    return map[rol] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }

  getDepartamentoNombre(id: string): string {
    return this.departamentos().find(d => d.id === id)?.nombre ?? '—';
  }

  getRolHeredado(idDepartamento: string): string {
    return this.departamentos().find(d => d.id === idDepartamento)?.rolAsignado ?? '—';
  }

  // ─── Departamentos ────────────────────────────────────────
  loadDepartamentos(): void {
    this.depLoading.set(true);
    this.adminService.getDepartamentos().subscribe({
      next: data => { this.departamentos.set(data); this.depLoading.set(false); },
      error: () => this.depLoading.set(false)
    });
  }

  openCreateDepModal(): void {
    this.editingDep.set(null);
    this.depForm = { codigo: '', nombre: '', descripcion: '', color: '#0ea5e9', rolAsignado: '' };
    this.depModalError.set('');
    this.showDepModal.set(true);
  }

  openEditDepModal(dep: DepartamentoResponse): void {
    this.editingDep.set(dep);
    this.depForm = {
      codigo: dep.codigo,
      nombre: dep.nombre,
      descripcion: dep.descripcion ?? '',
      color: dep.color ?? '#0ea5e9',
      rolAsignado: dep.rolAsignado ?? ''
    };
    this.depModalError.set('');
    this.showDepModal.set(true);
  }

  closeDepModal(): void {
    this.showDepModal.set(false);
  }

  saveDep(): void {
    this.depModalError.set('');
    this.depModalLoading.set(true);

    const payload: DepartamentoRequest = {
      codigo: this.depForm.codigo.trim().toUpperCase(),
      nombre: this.depForm.nombre.trim(),
      descripcion: this.depForm.descripcion.trim(),
      color: this.depForm.color.trim(),
      rolAsignado: this.depForm.rolAsignado
    };

    const editing = this.editingDep();
    const obs = editing
      ? this.adminService.editarDepartamento(editing.id, payload)
      : this.adminService.crearDepartamento(payload);

    obs.subscribe({
      next: () => {
        this.depModalLoading.set(false);
        this.closeDepModal();
        this.loadDepartamentos();
      },
      error: err => {
        this.depModalLoading.set(false);
        this.depModalError.set(err.error?.message ?? 'Error al guardar departamento');
      }
    });
  }

  deleteDep(id: string): void {
    if (!confirm('¿Eliminar este departamento?')) return;
    this.adminService.desactivarDepartamento(id).subscribe({
      next: () => this.loadDepartamentos()
    });
  }

  getMembersCount(dep: DepartamentoResponse): number {
    return this.usuarios().filter(u => u.idDepartamento === dep.id && u.activo).length;
  }

  // ─── Roles ────────────────────────────────────────────────
  loadRoles(): void {
    this.rolesLoading.set(true);
    this.adminService.getRoles().subscribe({
      next: data => { this.rolesList.set(data); this.rolesLoading.set(false); },
      error: () => this.rolesLoading.set(false)
    });
  }

  openCreateRolModal(): void {
    this.editingRol.set(null);
    this.rolForm = { nombreRol: '', permisos: [] };
    this.rolModalError.set('');
    this.showRolModal.set(true);
  }

  openEditRolModal(rol: RolResponse): void {
    this.editingRol.set(rol);
    this.rolForm = { nombreRol: rol.nombreRol, permisos: [...(rol.permisos ?? [])] };
    this.rolModalError.set('');
    this.showRolModal.set(true);
  }

  closeRolModal(): void {
    this.showRolModal.set(false);
  }

  saveRol(): void {
    this.rolModalError.set('');
    this.rolModalLoading.set(true);
    const payload: RolRequest = {
      nombreRol: this.rolForm.nombreRol.trim(),
      permisos: this.rolForm.permisos
    };
    const editing = this.editingRol();
    const obs = editing
      ? this.adminService.editarRol(editing.id, payload)
      : this.adminService.crearRol(payload);

    obs.subscribe({
      next: () => {
        this.rolModalLoading.set(false);
        this.closeRolModal();
        this.loadRoles();
      },
      error: err => {
        this.rolModalLoading.set(false);
        this.rolModalError.set(err.error?.message ?? 'Error al guardar rol');
      }
    });
  }

  deleteRol(id: string): void {
    if (!confirm('¿Eliminar este rol?')) return;
    this.adminService.eliminarRol(id).subscribe({
      next: () => this.loadRoles()
    });
  }

  // ─── Flujos publicados ────────────────────────────────────
  loadFlujos(): void {
    this.flujosLoading.set(true);
    this.flujosApi.listar().subscribe({
      next: data => {
        this.flujos.set(data.filter(f => f.estado === 'ACTIVO'));
        this.flujosLoading.set(false);
      },
      error: () => this.flujosLoading.set(false)
    });
  }

  irAlEditor(flujoId: string): void {
    this.abrirPizarra(`/pizarra/editor/${flujoId}?readonly=true`);
  }

  estadoBadgeClass(estado: string | undefined): string {
    const map: Record<string, string> = {
      ACTIVO:     'bg-green-500/15 text-green-400 border-green-500/30',
      BORRADOR:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
      ARCHIVADO:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
      DEPRECADO:  'bg-red-500/15 text-red-400 border-red-500/30',
    };
    return map[estado ?? ''] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  }
}
