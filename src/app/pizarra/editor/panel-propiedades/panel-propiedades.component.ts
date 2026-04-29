import { Component, Input, OnChanges, OnInit, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BpmnService, FormFieldDef } from '../../services/bpmn.service';
import { AdminService, DepartamentoResponse } from '../../../core/services/admin.service';

const FIELD_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'text',    label: 'Texto',        icon: '✏️' },
  { value: 'number',  label: 'Número',       icon: '🔢' },
  { value: 'date',    label: 'Fecha',        icon: '📅' },
  { value: 'image',   label: 'Imagen',       icon: '📷' },
  { value: 'file',    label: 'Archivo (PDF)', icon: '📎' },
  { value: 'boolean', label: 'Sí / No',      icon: '☑️' },
];

@Component({
  selector: 'app-panel-propiedades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './panel-propiedades.component.html',
})
export class PanelPropiedadesComponent implements OnInit, OnChanges {
  @Input() elemento: any = null;
  @Input() editable = true;

  tipo = signal('');
  nombre = signal('');
  esUserTask = signal(false);

  // ── SequenceFlow / Compuerta exclusiva ────────────────────────────────
  esSequenceFlow = signal(false);
  sourceEsGatewayExclusivo = signal(false);
  esDefaultFlow = signal(false);
  condicion = signal('');

  // Departamentos
  departamentos = signal<DepartamentoResponse[]>([]);
  deptSeleccionado = signal<string>('');
  deptDestinos = signal<string[]>([]);

  // Campos del formulario dinámico
  campos = signal<FormFieldDef[]>([]);
  readonly tiposCampo = FIELD_TYPES;

  // Crear usuario cliente desde esta tarea
  crearUsuarioCliente = signal(false);
  inicioFlujo = signal(false);
  readonly mostrarCrearUsuario = computed(() => {
    const codigo = this.deptSeleccionado();
    if (!codigo) return false;
    const dep = this.departamentos().find(d => d.codigo === codigo);
    return dep?.rolAsignado === 'ADM_DISENADOR';
  });

  constructor(
    private bpmnService: BpmnService,
    private adminService: AdminService,
  ) {}

  ngOnInit(): void {
    this.adminService.getDepartamentos().subscribe({
      next: deps => this.departamentos.set(deps),
      error: () => {},
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['elemento']) return;

    const el = this.elemento;
    if (!el) {
      this.tipo.set('');
      this.nombre.set('');
      this.esUserTask.set(false);
      this.esSequenceFlow.set(false);
      this.sourceEsGatewayExclusivo.set(false);
      this.esDefaultFlow.set(false);
      this.condicion.set('');
      this.campos.set([]);
      this.deptSeleccionado.set('');
      this.deptDestinos.set([]);
      this.crearUsuarioCliente.set(false);
      this.inicioFlujo.set(false);
      return;
    }

    const type: string = el.type ?? el.businessObject?.$type ?? '';
    this.tipo.set(this.labelTipo(type));

    const isSeqFlow = type === 'bpmn:SequenceFlow';
    const isUserTask = type === 'bpmn:UserTask';

    this.esUserTask.set(isUserTask);
    this.esSequenceFlow.set(isSeqFlow);

    if (isSeqFlow) {
      // SequenceFlow no tiene "nombre" editable relevante en el diagrama
      this.nombre.set(el.businessObject?.name ?? '');
      const bo = el.businessObject;
      const sourceType: string = bo?.sourceRef?.$type ?? '';
      this.sourceEsGatewayExclusivo.set(sourceType === 'bpmn:ExclusiveGateway');
      this.esDefaultFlow.set(bo?.sourceRef?.default === bo);
      this.condicion.set(bo?.conditionExpression?.body ?? '');
      this.campos.set([]);
      this.deptSeleccionado.set('');
      this.deptDestinos.set([]);
      this.inicioFlujo.set(false);
    } else {
      this.nombre.set(el.businessObject?.name ?? '');
      this.sourceEsGatewayExclusivo.set(false);
      this.esDefaultFlow.set(false);
      this.condicion.set('');
      if (isUserTask) {
        this.leerExtensiones();
      } else {
        this.campos.set([]);
        this.deptSeleccionado.set('');
        this.deptDestinos.set([]);
        this.crearUsuarioCliente.set(false);
        this.inicioFlujo.set(false);
      }
    }
  }

  // ── Leer extensiones desde el XML del elemento ─────────────────────────

  private leerExtensiones(): void {
    const bo = this.elemento?.businessObject;
    if (!bo) return;

    const ext: any[] = bo.extensionElements?.values ?? [];

    // Leer campos del formulario
    const formFieldsEl = ext.find((e: any) => e.$type === 'custom:FormFields');
    if (formFieldsEl?.fields?.length > 0) {
      this.campos.set(
        formFieldsEl.fields.map((f: any) => ({
          id:       f.id ?? `f_${Date.now()}_${Math.random()}`,
          label:    f.label ?? '',
          ayuda:    f.ayuda ?? '',
          tipo:     f.type ?? 'text',
          requerido: f.required === 'true' || f.required === true,
        }))
      );
    } else {
      this.campos.set([]);
    }

    // Leer departamento asignado
    const assigneeEl = ext.find((e: any) => e.$type === 'custom:Assignee');
    this.deptSeleccionado.set(assigneeEl?.departamento ?? '');

    // Leer departamento destino
    const destEls = ext.filter((e: any) => e.$type === 'custom:DestinationDepartment');
    const destinos = destEls
      .map((e: any) => e?.departamento ?? '')
      .filter((d: string) => d.length > 0);
    this.deptDestinos.set(destinos);

    // Leer flag de creación de usuario
    const userCreationEl = ext.find((e: any) => e.$type === 'custom:UserCreation');
    this.crearUsuarioCliente.set(userCreationEl?.enabled === 'true' || userCreationEl?.enabled === true);

    // Leer flag de inicio del flujo
    const starterEl = ext.find((e: any) => e.$type === 'custom:FlowStarter');
    this.inicioFlujo.set(starterEl?.enabled === 'true' || starterEl?.enabled === true);
  }

  // ── Etiqueta de tipo ───────────────────────────────────────────────────

  private labelTipo(type: string): string {
    const map: Record<string, string> = {
      'bpmn:Task':             'Tarea',
      'bpmn:UserTask':         'Tarea de usuario',
      'bpmn:ServiceTask':      'Tarea de servicio',
      'bpmn:ExclusiveGateway': 'Compuerta exclusiva (XOR)',
      'bpmn:ParallelGateway':  'Compuerta paralela (AND)',
      'bpmn:StartEvent':       'Evento de inicio',
      'bpmn:EndEvent':         'Evento de fin',
      'bpmn:SequenceFlow':     'Flujo de secuencia',
      'bpmn:Lane':             'Carril',
      'bpmn:Participant':      'Pool',
    };
    return map[type] ?? type.replace('bpmn:', '');
  }

  // ── Actualizar label en el canvas ──────────────────────────────────────

  actualizarNombre(): void {
    if (!this.elemento || !this.editable) return;
    const modeling = this.bpmnService.getModeling();
    if (modeling) {
      modeling.updateLabel(this.elemento, this.nombre());
    }
  }

  // ── Operaciones sobre campos ───────────────────────────────────────────

  agregarCampo(): void {
    const nuevo: FormFieldDef = {
      id:       `f_${Date.now()}`,
      label:    '',
      ayuda:    '',
      tipo:     'text',
      requerido: true,
    };
    // Guardamos inmediatamente para reservar el slot en el businessObject.
    // Así, aunque el usuario aún no escriba la etiqueta, el campo no se pierde
    // cuando otros eventos disparen persistirExtensiones().
    this.campos.update(c => [...c, nuevo]);
    this.persistirExtensiones();
  }

  eliminarCampo(index: number): void {
    this.campos.update(c => c.filter((_, i) => i !== index));
    this.persistirExtensiones();
  }

  // El blur fuerza sincronía de la señal antes de persistir porque [(ngModel)]
  // muta el objeto interno sin notificar la señal — hacemos una copia superficial.
  onCampoBlur(): void {
    this.campos.update(c => [...c]);
    this.persistirExtensiones();
  }

  onTipoCampoChange(): void {
    // El ngModelChange ya actualizó campo.tipo en el objeto; solo persistimos.
    this.persistirExtensiones();
  }

  onRequeridoChange(): void {
    this.persistirExtensiones();
  }

  onDeptChange(): void {
    if (!this.mostrarCrearUsuario()) {
      this.crearUsuarioCliente.set(false);
    }
    if (!this.deptSeleccionado()) {
      this.inicioFlujo.set(false);
    }
    this.persistirExtensiones();
  }

  onCrearUsuarioChange(): void {
    this.persistirExtensiones();
  }

  onInicioFlujoChange(): void {
    this.persistirExtensiones();
  }

  onDeptDestinoChange(index: number, value: string): void {
    this.deptDestinos.update(list => list.map((d, i) => (i === index ? value : d)));
    this.persistirExtensiones();
  }

  agregarDeptDestino(): void {
    this.deptDestinos.update(list => [...list, '']);
    this.persistirExtensiones();
  }

  eliminarDeptDestino(index: number): void {
    this.deptDestinos.update(list => list.filter((_, i) => i !== index));
    this.persistirExtensiones();
  }

  // ── Condición del SequenceFlow ─────────────────────────────────────────

  actualizarCondicion(): void {
    if (!this.elemento || !this.editable) return;
    this.bpmnService.setConditionExpression(this.elemento, this.condicion());
  }

  toggleDefaultFlow(event: Event): void {
    if (!this.elemento || !this.editable) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.esDefaultFlow.set(checked);
    this.bpmnService.setDefaultFlow(this.elemento, checked);
    if (checked) {
      this.condicion.set(''); // el flujo predeterminado no lleva condición
    }
  }

  aplicarAtajo(valor: string): void {
    this.condicion.set(valor);
    this.actualizarCondicion();
  }

  private persistirExtensiones(): void {
    if (!this.elemento || !this.editable) return;
    this.bpmnService.setUserTaskExtensions(
      this.elemento,
      this.deptSeleccionado(),
      this.deptDestinos(),
      this.campos(),
      this.crearUsuarioCliente(),
      this.inicioFlujo(),
    );
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────

  iconTipo(tipo: string): string {
    return FIELD_TYPES.find(t => t.value === tipo)?.icon ?? '📝';
  }

  trackById(_: number, campo: FormFieldDef): string {
    return campo.id;
  }
}

