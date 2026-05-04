import { Injectable } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import SockJS from 'sockjs-client';

export interface UsuarioPresente {
  idUsuario: string;
  nombreUsuario: string;
  estado?: 'disponible' | 'ocupado';
}

export interface Notificacion {
  tipo: string;
  mensaje?: string;
  timestamp: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class OfficerWebSocketService {
  private client: Client | null = null;
  private subscriptions: StompSubscription[] = [];

  readonly presencia$ = new Subject<UsuarioPresente[]>();
  readonly notificaciones$ = new Subject<Notificacion>();

  connect(deptCodigo: string, idUsuario: string, nombreUsuario: string): void {
    if (this.client?.active) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS('http://18.224.95.208:8080/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('[OfficerWS] Conectado a WebSocket');

        // Suscribir a presencia del departamento
        const subPresencia = this.client!.subscribe(`/topic/presencia/${deptCodigo}`, msg => {
          const data = JSON.parse(msg.body);
          if (data.tipo === 'PRESENCIA_ACTUALIZADA') {
            this.presencia$.next(data.usuarios || []);
          }
        });
        this.subscriptions.push(subPresencia);

        // Suscribir a notificaciones del departamento
        const subNotif = this.client!.subscribe(`/topic/notificaciones/${deptCodigo}`, msg => {
          const data = JSON.parse(msg.body);
          this.notificaciones$.next(data);
        });
        this.subscriptions.push(subNotif);

        // Publicar presencia: conectado
        this.client!.publish({
          destination: `/app/officer/${deptCodigo}/presencia`,
          body: JSON.stringify({ tipo: 'CONECTADO', idUsuario, nombreUsuario })
        });
      },
      onDisconnect: () => {
        console.log('[OfficerWS] Desconectado');
      },
      onStompError: (frame) => {
        console.error('[OfficerWS] Error STOMP:', frame.headers['message'], frame.body);
      }
    });

    this.client.activate();
  }

  disconnect(deptCodigo: string, idUsuario: string): void {
    if (!this.client?.active) return;

    // Publicar desconexión
    this.client.publish({
      destination: `/app/officer/${deptCodigo}/presencia`,
      body: JSON.stringify({ tipo: 'DESCONECTADO', idUsuario })
    });

    // Cancelar suscripciones
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    this.client.deactivate();
    this.client = null;
  }
}
