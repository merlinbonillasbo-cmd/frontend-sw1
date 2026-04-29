import { Injectable } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Subject } from 'rxjs';
import SockJS from 'sockjs-client';

export interface ClienteNotificacion {
  tipo: string;
  instanciaId?: string;
  estado?: string;
  departamento?: string;
  nodoActualId?: string;
  motivoRechazo?: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ClientWebSocketService {
  private client: Client | null = null;
  private subscriptions: StompSubscription[] = [];

  readonly notificaciones$ = new Subject<ClienteNotificacion>();

  connect(idCliente: string): void {
    if (this.client?.active) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        const sub = this.client!.subscribe(`/topic/notificaciones/cliente/${idCliente}`, msg => {
          const data = JSON.parse(msg.body);
          this.notificaciones$.next(data);
        });
        this.subscriptions.push(sub);
      },
      onDisconnect: () => {},
      onStompError: (frame) => {
        console.error('[ClientWS] Error STOMP:', frame.headers['message'], frame.body);
      }
    });

    this.client.activate();
  }

  disconnect(): void {
    if (!this.client?.active) return;
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.client.deactivate();
    this.client = null;
  }
}
