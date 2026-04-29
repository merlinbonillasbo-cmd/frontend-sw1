import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FluiosApiService, FlujoDefinicion } from '../services/flujos-api.service';
import { AdminService, DepartamentoResponse } from '../../core/services/admin.service';
import { BpmnService } from '../services/bpmn.service';

@Component({
  selector: 'app-lista-flujos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-flujos.component.html',
  styleUrls: ['./lista-flujos.component.css'],
})
export class ListaFluiosComponent implements OnInit {
  flujos = signal<FlujoDefinicion[]>([]);
  cargando = signal(true);
  error = signal('');

  // Modal nuevo flujo
  modalAbierto = signal(false);
  nuevoTitulo = '';
  nuevoDescripcion = '';
  creando = signal(false);
  errorModal = signal('');

  // Departamentos para seleccionar como carriles
  departamentos = signal<DepartamentoResponse[]>([]);
  deptosCargando = signal(false);
  deptoSeleccionados = new Set<string>();

  // Modal confirmación eliminar
  flujoAEliminar = signal<FlujoDefinicion | null>(null);
  eliminando = signal(false);

  // Revertir a borrador
  reviertiendo = signal(false);

  readonly estadoClase: Record<string, string> = {
    BORRADOR: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
    ACTIVO: 'bg-green-500/20 text-green-300 border border-green-500/40',
    ARCHIVADO: 'bg-slate-500/20 text-slate-400 border border-slate-500/40',
    DEPRECADO: 'bg-red-500/20 text-red-400 border border-red-500/40',
  };

  constructor(
    private api: FluiosApiService,
    private adminService: AdminService,
    private bpmn: BpmnService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.api.listar().subscribe({
      next: (data) => {
        this.flujos.set(data ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los flujos.');
        this.cargando.set(false);
      },
    });
  }

  abrirModal(): void {
    this.nuevoTitulo = '';
    this.nuevoDescripcion = '';
    this.errorModal.set('');
    this.deptoSeleccionados = new Set<string>();
    this.modalAbierto.set(true);
    this.cargarDepartamentos();
  }

  private cargarDepartamentos(): void {
    this.deptosCargando.set(true);
    this.adminService.getDepartamentos().subscribe({
      next: (data) => {
        this.departamentos.set((data ?? []).filter(d => d.activo));
        this.deptosCargando.set(false);
      },
      error: () => {
        this.departamentos.set([]);
        this.deptosCargando.set(false);
      },
    });
  }

  toggleDepto(id: string): void {
    if (this.deptoSeleccionados.has(id)) {
      this.deptoSeleccionados.delete(id);
    } else {
      this.deptoSeleccionados.add(id);
    }
  }

  isDeptoSelected(id: string): boolean {
    return this.deptoSeleccionados.has(id);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
  }

  crearFlujo(): void {
    if (!this.nuevoTitulo.trim()) {
      this.errorModal.set('El título es obligatorio.');
      return;
    }
    if (this.deptoSeleccionados.size === 0) {
      this.errorModal.set('Selecciona al menos un departamento como carril.');
      return;
    }
    this.creando.set(true);
    this.errorModal.set('');
    const slug = this.nuevoTitulo.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const laneNames = this.departamentos()
      .filter(d => this.deptoSeleccionados.has(d.id))
      .map(d => d.nombre);
    const xmlBpmn = this.bpmn.getEmptyXml(this.nuevoTitulo.trim(), laneNames);
    this.api.crear({ titulo: this.nuevoTitulo.trim(), descripcion: this.nuevoDescripcion.trim(), slug, xmlBpmn }).subscribe({
      next: (flujo) => {
        this.creando.set(false);
        this.cerrarModal();
        this.router.navigate(['/pizarra/editor', flujo.id]);
      },
      error: () => {
        this.creando.set(false);
        this.errorModal.set('Error al crear el flujo. Intenta con un título diferente.');
      },
    });
  }

  editarFlujo(flujo: FlujoDefinicion): void {
    this.router.navigate(['/pizarra/editor', flujo.id]);
  }

  revertirFlujo(flujo: FlujoDefinicion): void {
    if (!flujo.id || this.reviertiendo()) return;
    this.reviertiendo.set(true);
    this.api.revertirABorrador(flujo.id).subscribe({
      next: () => {
        this.reviertiendo.set(false);
        this.cargar();
      },
      error: () => {
        this.reviertiendo.set(false);
        this.error.set('No se pudo revertir el flujo a borrador.');
      },
    });
  }

  confirmarEliminar(flujo: FlujoDefinicion): void {
    this.flujoAEliminar.set(flujo);
  }

  cancelarEliminar(): void {
    this.flujoAEliminar.set(null);
  }

  eliminarFlujo(): void {
    const flujo = this.flujoAEliminar();
    if (!flujo?.id) return;
    this.eliminando.set(true);
    this.api.eliminar(flujo.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.flujoAEliminar.set(null);
        this.cargar();
      },
      error: () => {
        this.eliminando.set(false);
        this.flujoAEliminar.set(null);
        this.error.set('No se pudo eliminar el flujo.');
      },
    });
  }

  formatFecha(fecha?: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
