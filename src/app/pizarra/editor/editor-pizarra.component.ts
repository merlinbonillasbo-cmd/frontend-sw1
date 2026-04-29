import {
  Component, OnInit, OnDestroy, signal, computed,
  AfterViewInit, ViewChild, ElementRef, PLATFORM_ID, inject
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { FluiosApiService, FlujoDefinicion } from '../services/flujos-api.service';
import { BpmnService } from '../services/bpmn.service';
import { ColaboracionService, ColaboradorActivo } from '../services/colaboracion.service';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, UsuarioResponse } from '../../core/services/admin.service';
import { PanelDepartamentosComponent } from './panel-departamentos/panel-departamentos.component';
import { PanelPropiedadesComponent } from './panel-propiedades/panel-propiedades.component';

@Component({
  selector: 'app-editor-pizarra',
  standalone: true,
  imports: [CommonModule, FormsModule, PanelDepartamentosComponent, PanelPropiedadesComponent],
  templateUrl: './editor-pizarra.component.html',
  styleUrls: ['./editor-pizarra.component.css'],
})
export class EditorPizarraComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bpmnCanvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;

  flujo = signal<FlujoDefinicion | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  publicando = signal(false);
  error = signal('');
  menuExportar = signal(false);
  exito = signal('');
  selectedElement = signal<any>(null);
  soloLectura = signal(false);
  modalColaboradores = signal(false);
  usuariosDepto = signal<UsuarioResponse[]>([]);
  colaboradoresSeleccionados = signal<Set<string>>(new Set());
  guardandoColaboradores = signal(false);
  errorColaboradores = signal('');

  /** Estado del autoguardado */
  autoguardadoEstado = signal<'idle' | 'guardando' | 'guardado' | 'error'>('idle');
  /** Diseñadores activos en la misma pizarra */
  colaboradoresActivos = signal<ColaboradorActivo[]>([]);
  /** Mensaje toast cuando otro diseñador actualiza */
  toastColab = signal('');

  panelActivo = signal<'departamentos' | 'propiedades'>('departamentos');
  readonly panelIzqAbierto = signal(true);
  readonly panelDerAbierto = signal(true);

  private flujoId: string | null = null;
  private subs = new Subscription();
  private readonly platformId = inject(PLATFORM_ID);
  /**
   * true durante y justo después de importar XML remoto.
   * Bloquea el autosave para que no se propague el XML del otro usuario
   * de vuelta al backend (eco). La ventana es >1500ms (el debounce).
   */
  private _aplicandoRemoto = false;
  private _aplicandoRemotoTimer: any = null;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private api: FluiosApiService,
    public bpmn: BpmnService,
    private colabService: ColaboracionService,
    private auth: AuthService,
    private adminService: AdminService
  ) {}

  ngOnInit(): void {
    this.flujoId = this.route.snapshot.paramMap.get('id');
    const readonly = this.route.snapshot.queryParamMap.get('readonly');
    this.soloLectura.set(readonly === 'true');
    this.cargarUsuariosDepto();
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;  // bpmn-js es solo browser

    if (this.soloLectura()) {
      await this.bpmn.initViewer(this.canvasRef.nativeElement);
    } else {
      await this.bpmn.init(this.canvasRef.nativeElement);
    }

    // Eventos del modeler
    this.subs.add(
      this.bpmn.elementClick$.subscribe(el => {
        this.selectedElement.set(el);
        if (el) this.panelActivo.set('propiedades');
      })
    );

    // ── Autoguardado (solo en modo edición) ────────────────────────────
    if (!this.soloLectura()) {
      this.subs.add(
        this.bpmn.changed$.pipe(debounceTime(1500)).subscribe(() => {
          if (!this.flujoId) return;
          if (this._aplicandoRemoto) return; // no eco: cambio viene de XML remoto
          this.autoguardar();
        })
      );
    }

    // ── XML remoto de colaboración → importar si no es del propio usuario ──
    this.subs.add(
      this.colabService.xmlRemoto$.subscribe(async act => {
        const user = this.auth.currentUser$();
        if (user && act.editadoPor === user.correo) return; // ignorar propio guardado

        // Bloquear autosave durante 2200ms para absorber el debounce de 1500ms
        // y cualquier evento de commandStack.changed que bpmn-js dispare al importar
        this._aplicandoRemoto = true;
        clearTimeout(this._aplicandoRemotoTimer);
        this._aplicandoRemotoTimer = setTimeout(() => {
          this._aplicandoRemoto = false;
        }, 2200);

        await this.bpmn.importXml(act.xml);

        const autor = act.editadoPorNombre || act.editadoPor;
        this.toastColab.set(`Actualizado por ${autor}`);
        setTimeout(() => this.toastColab.set(''), 3500);
      })
    );

    // ── Presencia de colaboradores ──────────────────────────────────────
    this.subs.add(
      this.colabService.colaboradores$.subscribe(lista => {
        this.colaboradoresActivos.set(lista);
      })
    );

    if (this.flujoId) {
      this.cargarFlujo();
    } else {
      this.cargando.set(false);
      await this.bpmn.importXml(this.bpmn.getEmptyXml('Nuevo flujo'));
    }
  }

  private cargarFlujo(): void {
    this.cargando.set(true);
    this.api.obtener(this.flujoId!).subscribe({
      next: async (flujo) => {
        this.flujo.set(flujo);
        const user = this.auth.currentUser$();
        if (user && !this.esPropietario() && !this.esColaborador()) {
          this.error.set('No tienes acceso a este flujo.');
          this.cargando.set(false);
          setTimeout(() => this.router.navigate(['/pizarra']), 1200);
          return;
        }
        this.colaboradoresSeleccionados.set(new Set(flujo.colaboradores ?? []));
        const xml = flujo.xmlBpmn ?? this.bpmn.getEmptyXml(flujo.titulo);
        await this.bpmn.importXml(xml);
        this.cargando.set(false);
        this.conectarColaboracion();
      },
      error: (err) => {
        if (err?.status === 403) {
          this.error.set('No tienes acceso a este flujo.');
          setTimeout(() => this.router.navigate(['/pizarra']), 1200);
        } else {
          this.error.set('No se pudo cargar el flujo.');
        }
        this.cargando.set(false);
      },
    });
  }

  abrirColaboradores(): void {
    if (!this.esPropietario()) {
      this.errorColaboradores.set('Solo el propietario puede agregar colaboradores.');
      return;
    }
    this.errorColaboradores.set('');
    this.modalColaboradores.set(true);
  }

  cerrarColaboradores(): void {
    this.modalColaboradores.set(false);
  }

  toggleColaborador(id: string): void {
    this.colaboradoresSeleccionados.update(actual => {
      const next = new Set(actual);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  guardarColaboradores(): void {
    if (!this.flujoId || !this.flujo()) return;
    this.guardandoColaboradores.set(true);
    this.errorColaboradores.set('');
    const lista = Array.from(this.colaboradoresSeleccionados());
    const flujoActual = this.flujo()!;
    this.api.actualizar(this.flujoId, {
      ...flujoActual,
      colaboradores: lista,
    }).subscribe({
      next: (updated) => {
        this.guardandoColaboradores.set(false);
        this.flujo.set(updated ?? null);
        this.modalColaboradores.set(false);
      },
      error: () => {
        this.guardandoColaboradores.set(false);
        this.errorColaboradores.set('No se pudo guardar colaboradores.');
      }
    });
  }

  private cargarUsuariosDepto(): void {
    const user = this.auth.currentUser$();
    if (!user?.idDepartamento) return;
    this.adminService.getUsuarios().subscribe({
      next: data => {
        const filtrados = (data ?? []).filter(u =>
          u.activo &&
          u.rol === 'ADM_DISENADOR' &&
          u.idDepartamento === user.idDepartamento
        );
        this.usuariosDepto.set(filtrados);
      },
      error: () => {
        this.usuariosDepto.set([]);
      }
    });
  }

  esPropietario(): boolean {
    const user = this.auth.currentUser$();
    const flujo = this.flujo();
    if (!user || !flujo) return false;
    return flujo.idPropietario === user.userId;
  }

  esColaborador(): boolean {
    const user = this.auth.currentUser$();
    const flujo = this.flujo();
    if (!user || !flujo) return false;
    return (flujo.colaboradores ?? []).includes(user.userId);
  }

  private conectarColaboracion(): void {
    const user = this.auth.currentUser$();
    if (user && this.flujoId) {
      try {
        this.colabService.connect(this.flujoId, user.userId, user.nombreCompleto);
      } catch {
        // La colaboración es opcional — si falla, el editor sigue funcionando
      }
    }
  }

  private async autoguardar(): Promise<void> {
    if (!this.flujoId || this.guardando()) return;
    this.autoguardadoEstado.set('guardando');
    try {
      const xml = await this.bpmn.getXml();
      const { nodos, conexiones } = this.bpmn.extractElementsForBackend();
      const actualizado = await this.api.actualizar(this.flujoId, {
        ...this.flujo()!,
        xmlBpmn: xml,
        nodos,
        conexiones,
      }).toPromise();
      this.flujo.set(actualizado ?? null);
      this.autoguardadoEstado.set('guardado');
      setTimeout(() => this.autoguardadoEstado.set('idle'), 3000);
    } catch {
      this.autoguardadoEstado.set('error');
      setTimeout(() => this.autoguardadoEstado.set('idle'), 4000);
    }
  }

  async guardar(): Promise<void> {
    if (!this.flujoId || this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      const xml = await this.bpmn.getXml();
      const { nodos, conexiones } = this.bpmn.extractElementsForBackend();
      const flujoActual = this.flujo();
      const actualizado = await this.api.actualizar(this.flujoId, {
        ...flujoActual!,
        xmlBpmn: xml,
        nodos,
        conexiones,
      }).toPromise();
      this.flujo.set(actualizado ?? null);
      this.exito.set('Guardado correctamente.');
      setTimeout(() => this.exito.set(''), 3000);
    } catch {
      this.error.set('Error al guardar.');
    } finally {
      this.guardando.set(false);
    }
  }

  async publicar(): Promise<void> {
    if (!this.flujoId || this.publicando()) return;
    this.publicando.set(true);
    this.error.set('');
    try {
      // Guardar primero
      const xml = await this.bpmn.getXml();
      const { nodos: n2, conexiones: c2 } = this.bpmn.extractElementsForBackend();
      await this.api.actualizar(this.flujoId, { ...this.flujo()!, xmlBpmn: xml, nodos: n2, conexiones: c2 }).toPromise();
      // Publicar
      const publicado = await this.api.publicar(this.flujoId).toPromise();
      this.flujo.set(publicado ?? null);
      this.exito.set('¡Flujo publicado exitosamente!');
      setTimeout(() => this.exito.set(''), 4000);
    } catch {
      this.error.set('Error al publicar el flujo.');
    } finally {
      this.publicando.set(false);
    }
  }

  async exportarXml(): Promise<void> {
    try {
      let xml: string;
      if (this.soloLectura()) {
        xml = this.flujo()?.xmlBpmn ?? '';
        if (!xml) { this.error.set('No hay XML disponible.'); return; }
      } else {
        xml = await this.bpmn.getXml();
      }
      const blob = new Blob([xml], { type: 'application/xml' });
      this.descargar(URL.createObjectURL(blob), `${this.flujo()?.slug ?? 'flujo'}.bpmn`);
    } catch {
      this.error.set('Error al exportar XML.');
      setTimeout(() => this.error.set(''), 4000);
    }
  }

  async exportarPdf(): Promise<void> {
    try {
      const svgStr = await this.bpmn.getSvg();
      const { w, h } = this.svgDims(svgStr);
      const scale = 2;
      const imgData = await this.svgToPng(svgStr, w, h, scale);
      const { default: jsPDF } = await import('jspdf');
      const orientation = w >= h ? 'l' : 'p';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [w * scale, h * scale] });
      pdf.addImage(imgData, 'PNG', 0, 0, w * scale, h * scale);
      pdf.save(`${this.flujo()?.slug ?? 'flujo'}.pdf`);
    } catch (e) {
      console.error('Export PDF:', e);
      this.error.set('Error al exportar PDF.');
      setTimeout(() => this.error.set(''), 4000);
    }
  }

  async exportarImagen(): Promise<void> {
    try {
      const svgStr = await this.bpmn.getSvg();
      const { w, h } = this.svgDims(svgStr);
      const dataUrl = await this.svgToPng(svgStr, w, h, 2);
      this.descargar(dataUrl, `${this.flujo()?.slug ?? 'flujo'}.png`);
    } catch (e) {
      console.error('Export PNG:', e);
      this.error.set('Error al exportar imagen.');
      setTimeout(() => this.error.set(''), 4000);
    }
  }

  /** Dispara la descarga de un URL (blob o data-url) con el nombre dado */
  private descargar(url: string, nombre: string): void {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }, 150);
  }

  /** Extrae ancho y alto real del diagrama desde viewBox o width/height del SVG */
  private svgDims(svgStr: string): { w: number; h: number } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgStr, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { w: 1200, h: 800 };
    const vb = svg.getAttribute('viewBox');
    if (vb) {
      const p = vb.trim().split(/[\s,]+/).map(Number);
      if (p.length === 4 && !p.some(isNaN)) {
        return { w: Math.max(p[2], 100), h: Math.max(p[3], 100) };
      }
    }
    return {
      w: parseFloat(svg.getAttribute('width') ?? '1200') || 1200,
      h: parseFloat(svg.getAttribute('height') ?? '800') || 800,
    };
  }

  /**
   * Convierte un SVG string a PNG data-url.
   * Elimina width/height originales del tag <svg> y los reemplaza por w*scale, h*scale
   * para que el canvas tenga alta resolución con el viewBox correcto.
   */
  private svgToPng(svgStr: string, w: number, h: number, scale: number): Promise<string> {
    const pw = Math.round(w * scale);
    const ph = Math.round(h * scale);

    // Quitar width/height existentes del tag svg y poner los nuevos
    const patched = svgStr
      .replace(/(<svg[^>]*?)\s+width="[^"]*"/,  '$1')
      .replace(/(<svg[^>]*?)\s+height="[^"]*"/, '$1')
      .replace('<svg', `<svg width="${pw}" height="${ph}"`);

    // Codificar como data-url base64 (más confiable que blob URL para SVG)
    const b64 = btoa(unescape(encodeURIComponent(patched)));
    const src = `data:image/svg+xml;base64,${b64}`;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = pw;
        canvas.height = ph;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pw, ph);
        ctx.drawImage(img, 0, 0, pw, ph);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('No se pudo renderizar el SVG'));
      img.src = src;
    });
  }

  readonly esBorrador = computed(() => {
    const est = this.flujo()?.estado;
    return !est || est === 'BORRADOR';
  });

  /** Permite editar tanto borradores como flujos activos (publicados pero sin uso) */
  readonly esEditable = computed(() => {
    const est = this.flujo()?.estado;
    return !est || est === 'BORRADOR' || est === 'ACTIVO';
  });

  ngOnDestroy(): void {
    clearTimeout(this._aplicandoRemotoTimer);
    this.subs.unsubscribe();
    this.bpmn.destroy();
    this.colabService.disconnect();
  }
}
