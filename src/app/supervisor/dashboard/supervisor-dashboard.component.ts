// src/app/supervisor/dashboard/supervisor-dashboard.component.ts
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { SupervisorService, CuelloDeBottella, RendimientoDept, FlujoAtendido } from '../services/supervisor.service';

type Vista = 'cuellos' | 'rendimiento' | 'flujos';

@Component({
  selector: 'app-supervisor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervisor-dashboard.component.html',
  styleUrl: './supervisor-dashboard.component.css'
})
export class SupervisorDashboardComponent implements OnInit {

  vistaActiva = signal<Vista>('cuellos');

  // Datos
  cuellos = signal<CuelloDeBottella[]>([]);
  rendimiento = signal<RendimientoDept[]>([]);
  flujos = signal<FlujoAtendido[]>([]);

  // Loading
  cargandoCuellos = signal(false);
  cargandoRendimiento = signal(false);
  cargandoFlujos = signal(false);

  // Filtro flujos
  filtroEstado = signal<string>('TODOS');

  flujosFiltrados = computed(() => {
    const f = this.filtroEstado();
    const lista = this.flujos();
    if (f === 'TODOS') return lista;
    return lista.filter(fl => fl.estado === f);
  });

  // Computed: dept con más problemas para highlight
  maxTareasRetrasadas = computed(() =>
    Math.max(...this.rendimiento().map(r => r.tareasRetrasadas), 1)
  );
  maxTotalTareas = computed(() =>
    Math.max(...this.rendimiento().map(r => r.totalTareas), 1)
  );
  maxDuracion = computed(() =>
    Math.max(...this.cuellos().map(c => c.duracionPromedioMs), 1)
  );

  constructor(
    public auth: AuthService,
    private supervisorService: SupervisorService
  ) {}

  ngOnInit(): void {
    this.cargarCuellos();
    this.cargarRendimiento();
    this.cargarFlujos();
  }

  ir(vista: Vista): void {
    this.vistaActiva.set(vista);
  }

  cargarCuellos(): void {
    this.cargandoCuellos.set(true);
    this.supervisorService.getCuellos().subscribe({
      next: data => { this.cuellos.set(data); this.cargandoCuellos.set(false); },
      error: () => this.cargandoCuellos.set(false)
    });
  }

  cargarRendimiento(): void {
    this.cargandoRendimiento.set(true);
    this.supervisorService.getRendimientoDepartamentos().subscribe({
      next: data => { this.rendimiento.set(data); this.cargandoRendimiento.set(false); },
      error: () => this.cargandoRendimiento.set(false)
    });
  }

  cargarFlujos(): void {
    this.cargandoFlujos.set(true);
    this.supervisorService.getFlujos().subscribe({
      next: data => { this.flujos.set(data); this.cargandoFlujos.set(false); },
      error: () => this.cargandoFlujos.set(false)
    });
  }

  formatMs(ms: number): string {
    if (!ms || ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
    return `${(ms / 3600000).toFixed(1)} h`;
  }

  barWidth(value: number, max: number): number {
    if (!max || max === 0) return 0;
    return Math.max(4, Math.round((value / max) * 100));
  }

  estadoBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      COMPLETADO: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      CANCELADO:  'bg-red-500/20 text-red-400 border-red-500/40',
      EN_PROCESO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      EN_ESPERA:  'bg-slate-500/20 text-slate-400 border-slate-500/40',
    };
    return map[estado] ?? map['EN_ESPERA'];
  }

  getNombreFlujo(flujo: FlujoAtendido): string {
    return flujo.datosProceso?.['nombreFlujo'] || flujo.id;
  }

  getCodigoCaso(flujo: FlujoAtendido): string | null {
    return flujo.datosProceso?.['codigoCaso'] ?? null;
  }

  contarEstado(estado: string): number {
    return this.flujos().filter(f => f.estado === estado).length;
  }

  logout(): void {
    this.auth.logout();
  }
}

