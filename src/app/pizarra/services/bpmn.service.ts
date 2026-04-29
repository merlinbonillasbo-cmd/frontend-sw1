import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { bpmnEsModule } from './bpmn-es.translations';
import { CUSTOM_MODDLE } from './custom-bpmn.moddle';

// bpmn-js se importa como CommonJS — se carga dinámicamente para evitar problemas con SSR
let BpmnModeler: any;
let BpmnNavigatedViewer: any;

/** Tipo local para campos del formulario dinámico (usado al escribir extensiones) */
export interface FormFieldDef {
  id: string;
  label: string;
  ayuda: string;
  tipo: string;   // text | number | date | image | file | boolean
  requerido: boolean;
}

@Injectable({ providedIn: 'root' })
export class BpmnService {
  private modeler: any = null;
  private _soloLectura = false;
  readonly elementClick$ = new Subject<any>();
  readonly changed$ = new Subject<string>();
  private readonly lanesSubject = new BehaviorSubject<LaneSummary[]>([]);
  readonly lanes$ = this.lanesSubject.asObservable();

  get soloLectura(): boolean { return this._soloLectura; }

  constructor(private zone: NgZone) {}

  /** Inicializa en modo VISTA (solo navegación, sin edición) */
  async initViewer(container: HTMLElement): Promise<void> {
    this._soloLectura = true;
    if (!BpmnNavigatedViewer) {
      const mod = await import('bpmn-js/lib/NavigatedViewer');
      BpmnNavigatedViewer = mod.default;
    }
    this.modeler = new BpmnNavigatedViewer({
      container,
      additionalModules: [bpmnEsModule],
      moddleExtensions: { custom: CUSTOM_MODDLE },
    });

    this.modeler.on('selection.changed', ({ newSelection }: any) => {
      this.zone.run(() => this.elementClick$.next(newSelection[0] ?? null));
    });

    const emitLanes = () => {
      this.zone.run(() => this.lanesSubject.next(this.getLanesSnapshot()));
    };
    this.modeler.on('import.done', emitLanes);
  }

  async init(container: HTMLElement): Promise<void> {
    this._soloLectura = false;
    if (!BpmnModeler) {
      const mod = await import('bpmn-js/lib/Modeler');
      BpmnModeler = mod.default;
    }
    this.modeler = new BpmnModeler({
      container,
      additionalModules: [bpmnEsModule],
      moddleExtensions: { custom: CUSTOM_MODDLE },
      canvas: {
        deferUpdate: false
      },
      keyboard: {
        bindTo: window
      }
    });

    // Evento: elemento seleccionado
    this.modeler.on('selection.changed', ({ newSelection }: any) => {
      this.zone.run(() => this.elementClick$.next(newSelection[0] ?? null));
    });

    const emitLanes = () => {
      this.zone.run(() => this.lanesSubject.next(this.getLanesSnapshot()));
    };

    this.modeler.on('shape.added', emitLanes);
    this.modeler.on('shape.removed', emitLanes);
    this.modeler.on('root.set', emitLanes);
    this.modeler.on('import.done', emitLanes);

    // Evento: diagrama modificado → serializar XML
    this.modeler.on('commandStack.changed', async () => {
      const xml = await this.getXml();
      this.zone.run(() => this.changed$.next(xml));
    });
  }

  async importXml(xml: string): Promise<void> {
    await this.modeler.importXML(xml);
    this.fixCanvasBackground();
    this.refreshLanes();
  }

  private fixCanvasBackground(): void {
    setTimeout(() => {
      const container: HTMLElement | null = this.modeler.get('canvas')._container;
      if (container) {
        const djsContainer = container.querySelector<HTMLElement>('.djs-container');
        if (djsContainer) {
          djsContainer.style.backgroundColor = '#ffffff';
          djsContainer.style.backgroundImage = 'radial-gradient(circle, #c0c0c0 1.5px, transparent 1.5px)';
          djsContainer.style.backgroundSize = '24px 24px';
        }
        // Ocultar el rectángulo de fondo de la "hoja"
        const svgBg = container.querySelector<SVGElement>('.djs-layer-base rect');
        if (svgBg) {
          svgBg.style.display = 'none';
        }
      }
    }, 100);
  }

  async getXml(): Promise<string> {
    const { xml } = await this.modeler.saveXML({ format: true });
    return xml;
  }

  /** Agrega un carril (Lane) al Pool principal usando la API nativa de bpmn-js */
  async addLane(_laneId: string, label: string): Promise<void> {
    const modeling = this.modeler.get('modeling');
    const elementRegistry = this.modeler.get('elementRegistry');

    const existingLanes: any[] = elementRegistry
      .filter((el: any) => el.type === 'bpmn:Lane')
      .sort((a: any, b: any) => a.y - b.y);

    if (existingLanes.length === 0) {
      console.warn('No hay carriles existentes en el diagrama para agregar después.');
      return;
    }

    // Guardar IDs antes de agregar para poder detectar el nuevo carril si addLane no lo retorna
    const idsBefore = new Set<string>(existingLanes.map((l: any) => l.id));

    const lastLane = existingLanes[existingLanes.length - 1];
    const returned = modeling.addLane(lastLane, 'after');

    // Resolver el elemento del nuevo carril.
    // addLane debe retornarlo, pero si retorna null buscamos el que no existía antes.
    let newLane: any = returned ?? null;
    if (!newLane) {
      newLane = elementRegistry
        .filter((el: any) => el.type === 'bpmn:Lane')
        .find((el: any) => !idsBefore.has(el.id)) ?? null;
    }

    if (newLane) {
      // Los carriles tienen el texto embebido en sus bounds (no tienen label externo).
      // updateLabel crea un label shape separado que no funciona para lanes.
      // updateProperties actualiza directamente businessObject.name y redibuja el texto.
      modeling.updateProperties(newLane, { name: label });
    }

    this.refreshLanes();
  }

  /** Elimina un carril por su id del diagrama */
  removeLane(laneId: string): void {
    const elementRegistry = this.modeler.get('elementRegistry');
    const modeling = this.modeler.get('modeling');
    const lane = elementRegistry.get(laneId);
    if (!lane) return;
    modeling.removeElements([lane]);
    this.refreshLanes();
  }

  getLanesSnapshot(): LaneSummary[] {
    if (!this.modeler) return [];
    const elementRegistry = this.modeler.get('elementRegistry');
    return elementRegistry
      .filter((el: any) => el.type === 'bpmn:Lane')
      .sort((a: any, b: any) => a.y - b.y)
      .map((lane: any) => ({
        id: lane.id,
        label: lane.businessObject?.name || lane.name || lane.id,
      }));
  }

  /** Reordena los carriles cambiando sus etiquetas según la nueva posición deseada */
  reorderLanes(laneIdsInNewOrder: string[]): void {
    const elementRegistry = this.modeler.get('elementRegistry');
    const modeling = this.modeler.get('modeling');

    // Obtener elementos de carril y ordenarlos por posición y (orden visual actual)
    const laneElements: any[] = laneIdsInNewOrder
      .map((id: string) => elementRegistry.get(id))
      .filter(Boolean);

    if (laneElements.length < 2) return;

    const sortedByY = [...laneElements].sort((a: any, b: any) => a.y - b.y);

    // Etiquetas en el nuevo orden deseado
    const newLabels = laneIdsInNewOrder.map((id: string) => {
      const lane = elementRegistry.get(id);
      return lane?.businessObject?.name ?? lane?.id ?? '';
    });

    // Asignar cada etiqueta al carril que ocupa ese slot visual (por y)
    sortedByY.forEach((lane: any, idx: number) => {
      if ((lane.businessObject?.name ?? '') !== newLabels[idx]) {
        modeling.updateLabel(lane, newLabels[idx]);
      }
    });

    this.refreshLanes();
  }

  refreshLanes(): void {
    this.lanesSubject.next(this.getLanesSnapshot());
  }

  zoom(delta: number): void {
    const canvas = this.modeler.get('canvas');
    canvas.zoom(canvas.zoom() + delta);
  }

  fitView(): void {
    this.modeler.get('canvas').zoom('fit-viewport');
  }

  undo(): void {
    this.modeler.get('commandStack').undo();
  }

  redo(): void {
    this.modeler.get('commandStack').redo();
  }

  destroy(): void {
    this.modeler?.destroy();
    this.modeler = null;
  }

  // ── Helpers para el panel de propiedades ──────────────────────────────

  getModeling(): any {
    return this.modeler?.get('modeling') ?? null;
  }

  /** Devuelve el SVG completo del diagrama actual (igual que bpmn-js saveSVG) */
  async getSvg(): Promise<string> {
    try {
      const { svg } = await this.modeler.saveSVG();
      return svg;
    } catch {
      // Fallback: serializar el SVG del DOM directamente
      const canvas = this.modeler.get('canvas');
      const svgEl: SVGElement | null = canvas._container?.querySelector('.djs-container svg') ?? null;
      if (!svgEl) throw new Error('No SVG encontrado');
      return new XMLSerializer().serializeToString(svgEl);
    }
  }

  /**
   * Escribe en extensionElements del UserTask seleccionado:
   *  - custom:FormFields (con sus custom:Field hijos)
   *  - custom:Assignee (código del departamento)
   * Ambos son opcionales: si están vacíos no se añaden.
   */
  setUserTaskExtensions(
    element: any,
    deptCodigo: string,
    deptDestinoCodigos: string[],
    campos: FormFieldDef[],
    crearUsuario: boolean,
    inicioFlujo: boolean
  ): void {
    if (!this.modeler) return;
    const moddle   = this.modeler.get('moddle');
    const modeling = this.modeler.get('modeling');
    const bo = element.businessObject;

    // Obtener o crear el contenedor extensionElements
    let extEl = bo.extensionElements;
    if (!extEl) {
      extEl = moddle.create('bpmn:ExtensionElements', { values: [] });
    } else {
      // Quitar versiones anteriores de nuestras extensiones
      extEl.values = (extEl.values ?? []).filter(
        (e: any) => e.$type !== 'custom:FormFields'
          && e.$type !== 'custom:Assignee'
          && e.$type !== 'custom:DestinationDepartment'
          && e.$type !== 'custom:FlowStarter'
          && e.$type !== 'custom:UserCreation'
      );
    }

    // Campos del formulario — se guardan TODOS (incluso sin etiqueta aún) para no
    // perder campos recién agregados cuando el usuario aún no escribió la etiqueta.
    if (campos.length > 0) {
      const fieldEls = campos.map(f =>
        moddle.create('custom:Field', {
          id:       f.id,
          label:    f.label,
          type:     f.tipo,
          required: String(f.requerido),
          ayuda: f.ayuda,
        })
      );
      const formFieldsEl = moddle.create('custom:FormFields', { fields: fieldEls });
      extEl.values = [...(extEl.values ?? []), formFieldsEl];
    }

    // Departamento asignado
    if (deptCodigo) {
      const assigneeEl = moddle.create('custom:Assignee', { departamento: deptCodigo });
      extEl.values = [...(extEl.values ?? []), assigneeEl];
    }

    // Departamento destino (documentos)
    const destinos = Array.from(new Set(
      (deptDestinoCodigos ?? [])
        .map(d => (d ?? '').trim())
        .filter(d => d.length > 0)
    ));
    for (const destino of destinos) {
      const destEl = moddle.create('custom:DestinationDepartment', { departamento: destino });
      extEl.values = [...(extEl.values ?? []), destEl];
    }

    if (crearUsuario) {
      const userCreationEl = moddle.create('custom:UserCreation', { enabled: 'true' });
      extEl.values = [...(extEl.values ?? []), userCreationEl];
    }

    if (inicioFlujo) {
      const starterEl = moddle.create('custom:FlowStarter', { enabled: 'true' });
      extEl.values = [...(extEl.values ?? []), starterEl];
    }

    modeling.updateProperties(element, { extensionElements: extEl });
  }

  /**
   * Establece o borra la condición (FormalExpression) en un SequenceFlow.
   * Si expression está vacía elimina la condición.
   */
  setConditionExpression(element: any, expression: string): void {
    if (!this.modeler) return;
    const moddle   = this.modeler.get('moddle');
    const modeling = this.modeler.get('modeling');

    if (expression.trim()) {
      const formalExpression = moddle.create('bpmn:FormalExpression', {
        body: expression.trim(),
      });
      modeling.updateProperties(element, { conditionExpression: formalExpression });
    } else {
      modeling.updateProperties(element, { conditionExpression: undefined });
    }
  }

  /**
   * Marca o desmarca este SequenceFlow como flujo predeterminado del gateway origen.
   * Al marcarlo como default se borra la conditionExpression (el default no lleva condición).
   */
  setDefaultFlow(flowElement: any, isDefault: boolean): void {
    if (!this.modeler) return;
    const modeling        = this.modeler.get('modeling');
    const elementRegistry = this.modeler.get('elementRegistry');

    const sourceId = flowElement.businessObject?.sourceRef?.id;
    if (!sourceId) return;
    const sourceElement = elementRegistry.get(sourceId);
    if (!sourceElement) return;

    if (isDefault) {
      modeling.updateProperties(sourceElement, { default: flowElement.businessObject });
      modeling.updateProperties(flowElement, { conditionExpression: undefined });
    } else {
      if (sourceElement.businessObject?.default === flowElement.businessObject) {
        modeling.updateProperties(sourceElement, { default: null });
      }
    }
  }

  /**
   * Extrae nodos y conexiones del diagrama actual para persistirlos en el backend.
   * Se llama antes de cada guardado para que MongoDB siempre tenga los arrays sincronizados
   * con el xmlBpmn y el motor de workflow pueda ejecutar el flujo.
   */
  extractElementsForBackend(): { nodos: any[], conexiones: any[] } {
    const elementRegistry = this.modeler?.get('elementRegistry');
    if (!elementRegistry) return { nodos: [], conexiones: [] };

    const allElements: any[] = elementRegistry.getAll();

    // Construir mapa nodeId → laneId usando los flowNodeRef de cada Lane
    const laneMap: Record<string, string> = {};
    for (const el of allElements) {
      if (el.type === 'bpmn:Lane') {
        const refs: any[] = el.businessObject?.flowNodeRef ?? [];
        for (const ref of refs) {
          laneMap[ref.id] = el.id;
        }
      }
    }

    const NODE_TYPES = new Set([
      'bpmn:UserTask', 'bpmn:StartEvent', 'bpmn:EndEvent',
      'bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:Task', 'bpmn:ServiceTask',
    ]);

    const nodos: any[] = [];
    const conexiones: any[] = [];

    for (const el of allElements) {
      const bo = el.businessObject;
      if (!bo) continue;
      const type: string = bo.$type ?? '';

      if (NODE_TYPES.has(type)) {
        let idDepartamento: string | null = null;
        let formSchema: { fields: any[] } | null = null;
        const idDepartamentosDestino: string[] = [];
        let crearUsuarioCliente = false;
        let inicioFlujo = false;
        const extensions: any[] = bo.extensionElements?.values ?? [];

        for (const ext of extensions) {
          if (ext.$type === 'custom:Assignee') {
            idDepartamento = ext.departamento ?? null;
          }
          if (ext.$type === 'custom:DestinationDepartment') {
            if (ext.departamento) idDepartamentosDestino.push(ext.departamento);
          }
          if (ext.$type === 'custom:UserCreation') {
            crearUsuarioCliente = ext.enabled === 'true' || ext.enabled === true;
          }
          if (ext.$type === 'custom:FlowStarter') {
            inicioFlujo = ext.enabled === 'true' || ext.enabled === true;
          }
          if (ext.$type === 'custom:FormFields') {
            const fields = (ext.fields ?? []).map((f: any) => ({
              name: f.id ?? `f_${Math.random()}`,
              label: f.label ?? '',
              ayuda: f.ayuda ?? '',
              type: f.type ?? 'text',
              required: f.required === 'true' || f.required === true,
              defaultValue: null,
            }));
            formSchema = { fields };
          }
        }

        nodos.push({
          id: bo.id,
          type: type.replace('bpmn:', ''),
          label: bo.name ?? bo.id,
          idDepartamento,
          idDepartamentosDestino: idDepartamentosDestino.length > 0 ? idDepartamentosDestino : null,
          idUsuarioAsignado: null,
          formSchema,
          crearUsuarioCliente,
          inicioFlujo,
          timeoutHours: 24,
          x: el.x ?? 0,
          y: el.y ?? 0,
          laneId: laneMap[bo.id] ?? null,
        });
      }

      if (type === 'bpmn:SequenceFlow') {
        const condition: string | null = bo.conditionExpression?.body ?? null;
        conexiones.push({
          id: bo.id,
          sourceNodeId: bo.sourceRef?.id ?? '',
          targetNodeId: bo.targetRef?.id ?? '',
          condition,
          label: bo.name ?? null,
        });
      }
    }

    return { nodos, conexiones };
  }

  /** XML inicial vacío con un Pool + los lanes indicados */
  getEmptyXml(titulo: string, laneNames: string[] = ['Departamento']): string {
    const lanes = laneNames.length > 0 ? laneNames : ['Departamento'];
    const LANE_H = 160;
    const POOL_X = 130, POOL_Y = 80, POOL_W = 900;
    const LANE_X = 160, LANE_W = 870;
    const poolHeight = LANE_H * lanes.length;

    const laneSetItems = lanes.map((name, i) => {
      const id = `Lane_${i + 1}`;
      return i === 0
        ? `      <bpmn:lane id="${id}" name="${name}">
        <bpmn:flowNodeRef>StartEvent_1</bpmn:flowNodeRef>
      </bpmn:lane>`
        : `      <bpmn:lane id="${id}" name="${name}"/>`;
    }).join('\n');

    const laneShapes = lanes.map((_, i) => {
      const id = `Lane_${i + 1}`;
      const y = POOL_Y + i * LANE_H;
      return `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}" isHorizontal="true">
        <dc:Bounds x="${LANE_X}" y="${y}" width="${LANE_W}" height="${LANE_H}"/>
      </bpmndi:BPMNShape>`;
    }).join('\n');

    const startEventY = POOL_Y + Math.floor(LANE_H / 2) - 18;

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  targetNamespace="http://bpmn.io/schema/bpmn"
                  id="Definitions_1">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Pool_1" name="${titulo}" processRef="Process_1"/>
  </bpmn:collaboration>
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
${laneSetItems}
    </bpmn:laneSet>
    <bpmn:startEvent id="StartEvent_1" name="Inicio"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1" isHorizontal="true">
        <dc:Bounds x="${POOL_X}" y="${POOL_Y}" width="${POOL_W}" height="${poolHeight}"/>
      </bpmndi:BPMNShape>
${laneShapes}
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="222" y="${startEventY}" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
  }
}

export interface LaneSummary {
  id: string;
  label: string;
}
