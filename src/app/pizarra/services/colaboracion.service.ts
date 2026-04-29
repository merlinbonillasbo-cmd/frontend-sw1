import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';

export interface ColaboradorActivo {
  userId: string;
  nombre: string;
}

/** Payload emitido cuando otro diseñador guarda el diagrama */
export interface ActualizacionRemota {
  xml: string;
  editadoPor: string;         // correo del autor — para filtrar el propio guardado
  editadoPorNombre: string;   // nombre completo — para el toast
}

@Injectable({ providedIn: 'root' })
export class ColaboracionService implements OnDestroy {
  private client: Client | null = null;
  private flujoId: string | null = null;
  private userId: string | null = null;

  /** XML + autor recibido de otro colaborador */
  readonly xmlRemoto$ = new Subject<ActualizacionRemota>();
  /** Lista de colaboradores activos en la pizarra */
  readonly colaboradores$ = new Subject<ColaboradorActivo[]>();

  connect(flujoId: string, userId: string, nombre: string): void {
    if (this.client?.active) return; // ya conectado
    this.flujoId = flujoId;
    this.userId = userId;

    this.client = new Client({
      brokerURL: 'ws://18.222.251.205:8080/ws/websocket',
      reconnectDelay: 5000,
      onConnect: () => {
        // ── Actualizaciones del diagrama ─────────────────────────────────
        this.client!.subscribe(`/topic/pizarra/${flujoId}`, (msg: IMessage) => {
          const body = JSON.parse(msg.body);
          if (body.tipo === 'DIAGRAMA_ACTUALIZADO') {
            this.xmlRemoto$.next({
              xml:              body.xmlBpmn ?? '',
              editadoPor:       body.editadoPor ?? '',
              editadoPorNombre: body.editadoPorNombre ?? body.editadoPor ?? '',
            });
          }
        });

        // ── Presencia ────────────────────────────────────────────────────
        this.client!.subscribe(
          `/topic/pizarra/${flujoId}/presencia`,
          (msg: IMessage) => {
            const body = JSON.parse(msg.body);
            if (body.tipo === 'PRESENCIA_ACTUALIZADA') {
              this.colaboradores$.next(body.usuarios ?? []);
            }
          }
        );

        // Anunciar conexión
        this.client!.publish({
          destination: `/app/pizarra/${flujoId}/presencia`,
          body: JSON.stringify({ tipo: 'USUARIO_CONECTADO', userId, nombre, flujoId }),
        });
      },
      onStompError: (frame) => {
        console.warn('STOMP error (colaboración no disponible):', frame.headers?.['message']);
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.flujoId && this.client?.connected) {
      // Avisar al backend que el usuario se desconecta
      this.client.publish({
        destination: `/app/pizarra/${this.flujoId}/presencia`,
        body: JSON.stringify({
          tipo: 'USUARIO_DESCONECTADO',
          userId: this.userId ?? '',
          flujoId: this.flujoId,
        }),
      });
    }
    this.client?.deactivate();
    this.client = null;
    this.flujoId = null;
    this.userId = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
