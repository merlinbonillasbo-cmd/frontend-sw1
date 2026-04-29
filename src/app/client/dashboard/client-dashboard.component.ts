import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { InstanciaService, Instancia } from '../../core/services/instancia.service';
import { ClientWebSocketService } from '../services/client-websocket.service';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-dashboard.component.html',
  styleUrl: './client-dashboard.component.css'
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  instancias = signal<Instancia[]>([]);
  cargando = signal(false);
  error = signal('');

  private subs = new Subscription();

  constructor(
    public auth: AuthService,
    private instanciaService: InstanciaService,
    private ws: ClientWebSocketService
  ) {}

  ngOnInit(): void {
    this.cargar();
    const userId = this.auth.currentUser$()?.userId;
    if (userId) {
      this.ws.connect(userId);
      this.subs.add(
        this.ws.notificaciones$.subscribe(() => this.cargar())
      );
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.ws.disconnect();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.instanciaService.misInstancias().subscribe({
      next: data => {
        this.instancias.set(data || []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar tus solicitudes.');
        this.cargando.set(false);
      }
    });
  }

  estadoLabel(estado?: string): string {
    if (estado === 'COMPLETADO') return 'Finalizado';
    if (estado === 'CANCELADO') return 'Rechazado';
    return 'En proceso';
  }

  estadoClase(estado?: string): string {
    if (estado === 'COMPLETADO') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (estado === 'CANCELADO') return 'bg-red-500/15 text-red-400 border-red-500/30';
    return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  }
}
