import { Component, Input, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BpmnService, LaneSummary } from '../../services/bpmn.service';
import { AdminService, DepartamentoResponse } from '../../../core/services/admin.service';

@Component({
  selector: 'app-panel-departamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './panel-departamentos.component.html',
})
export class PanelDepartamentosComponent implements OnInit, OnDestroy {
  @Input() editable = true;

  constructor(private bpmnService: BpmnService, private adminService: AdminService) {}

  carriles = signal<LaneSummary[]>([]);
  departamentos = signal<DepartamentoResponse[]>([]);
  deptoSeleccionado = '';
  agregando = signal(false);
  private subs = new Subscription();

  /** Departamentos activos que aún no están como carril */
  readonly deptoDisponibles = computed(() => {
    const labels = new Set(this.carriles().map(c => c.label.toLowerCase()));
    return this.departamentos().filter(d => !labels.has(d.nombre.toLowerCase()));
  });

  ngOnInit(): void {
    this.carriles.set(this.bpmnService.getLanesSnapshot());
    this.subs.add(this.bpmnService.lanes$.subscribe(lanes => this.carriles.set(lanes)));
    this.bpmnService.refreshLanes();
    this.adminService.getDepartamentos().subscribe({
      next: (data) => this.departamentos.set((data ?? []).filter(d => d.activo)),
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  eliminando = signal<string | null>(null);
  dragFromIndex = signal<number | null>(null);
  dragOverIndex = signal<number | null>(null);

  onDragStart(event: DragEvent, index: number): void {
    this.dragFromIndex.set(index);
    event.dataTransfer?.setData('text/plain', String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverIndex.set(index);
  }

  onDrop(event: DragEvent, toIndex: number): void {
    event.preventDefault();
    const fromIndex = this.dragFromIndex();
    if (fromIndex === null || fromIndex === toIndex) {
      this.onDragEnd();
      return;
    }
    const current = [...this.carriles()];
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    this.carriles.set(current);
    this.bpmnService.reorderLanes(current.map(c => c.id));
    this.onDragEnd();
  }

  onDragEnd(): void {
    this.dragFromIndex.set(null);
    this.dragOverIndex.set(null);
  }

  eliminarCarril(id: string): void {
    if (!this.editable) return;
    this.eliminando.set(id);
    try {
      this.bpmnService.removeLane(id);
    } catch (e) {
      console.error('Error al eliminar carril:', e);
    } finally {
      this.eliminando.set(null);
    }
  }

  async agregarCarril(): Promise<void> {
    const nombre = this.deptoSeleccionado.trim();
    if (!nombre || !this.editable) return;
    this.agregando.set(true);
    const id = `Lane_${Date.now()}`;
    try {
      await this.bpmnService.addLane(id, nombre);
      this.bpmnService.refreshLanes();
      this.deptoSeleccionado = '';
    } catch (e) {
      console.error('Error al agregar carril:', e);
    } finally {
      this.agregando.set(false);
    }
  }
}
