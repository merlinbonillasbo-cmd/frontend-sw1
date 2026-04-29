/**
 * Traducciones al español para bpmn-js.
 * Cubre: paleta, menú contextual, "Change element" y tipos de elemento.
 */
export const ES_TRANSLATIONS: Record<string, string> = {

  // ── Herramientas de paleta ──────────────────────────────────────────────
  'Activate the hand tool':                'Activar herramienta mano',
  'Activate the lasso tool':               'Activar herramienta lazo',
  'Activate the create/remove space tool': 'Crear / eliminar espacio',
  'Activate global connect tool':          'Herramienta de conexión global',

  // ── Crear elementos (paleta, tooltips) ─────────────────────────────────
  'Create StartEvent':                     'Crear Evento de Inicio',
  'Create EndEvent':                       'Crear Evento de Fin',
  'Create Intermediate/Boundary Event':    'Crear Evento Intermedio / de Límite',
  'Create Task':                           'Crear Tarea',
  'Create DataObjectReference':            'Crear Referencia de Objeto de Datos',
  'Create DataStoreReference':             'Crear Almacén de Datos',
  'Create expanded SubProcess':            'Crear SubProceso expandido',
  'Create Participant/BlackBox Pool':       'Crear Participante / Pool',
  'Create Group':                          'Crear Grupo',
  'Create {type}':                         'Crear {type}',

  // ── Menú contextual principal ───────────────────────────────────────────
  'Append {type}':                         'Agregar {type}',
  'Append EndEvent':                       'Agregar Evento de Fin',
  'Append Task':                           'Agregar Tarea',
  'Append Gateway':                        'Agregar Compuerta',
  'Append Intermediate/Boundary Event':    'Agregar Evento Intermedio',
  'Add Lane above':                        'Agregar carril arriba',
  'Add Lane below':                        'Agregar carril abajo',
  'Divide into two Lanes':                 'Dividir en dos carriles',
  'Divide into three Lanes':               'Dividir en tres carriles',
  'Change element':                        'Cambiar elemento',
  'Edit':                                  'Editar',
  'Edit label':                            'Editar etiqueta',
  'Delete':                                'Eliminar',
  'Connect using Association':             'Conectar con Asociación',
  'Connect using Sequence/MessageFlow or Association': 'Conectar con Flujo o Asociación',
  'Connect using DataInputAssociation':    'Conectar con Asociación de Entrada',

  // ── Nombres de elementos BPMN ───────────────────────────────────────────
  'Task':                                  'Tarea',
  'User Task':                             'Tarea de Usuario',
  'Service Task':                          'Tarea de Servicio',
  'Script Task':                           'Tarea de Script',
  'Business Rule Task':                    'Tarea de Regla de Negocio',
  'Manual Task':                           'Tarea Manual',
  'Send Task':                             'Tarea de Envío',
  'Receive Task':                          'Tarea de Recepción',
  'Call Activity':                         'Actividad de Llamada',
  'Sub Process':                           'SubProceso',
  'Sub Process (collapsed)':               'SubProceso (colapsado)',
  'Collapsed Sub Process':                 'SubProceso colapsado',
  'Expanded Sub Process':                  'SubProceso expandido',
  'Start Event':                           'Evento de Inicio',
  'End Event':                             'Evento de Fin',
  'Intermediate Event':                    'Evento Intermedio',
  'Intermediate Throw Event':              'Evento Intermedio de Lanzamiento',
  'Intermediate Catch Event':              'Evento Intermedio de Captura',
  'Boundary Event':                        'Evento de Límite',
  'Gateway':                               'Compuerta',
  'Exclusive Gateway':                     'Compuerta Exclusiva (XOR)',
  'Parallel Gateway':                      'Compuerta Paralela (AND)',
  'Inclusive Gateway':                     'Compuerta Inclusiva (OR)',
  'Complex Gateway':                       'Compuerta Compleja',
  'Event Based Gateway':                   'Compuerta Basada en Eventos',
  'Sequence Flow':                         'Flujo de Secuencia',
  'Message Flow':                          'Flujo de Mensaje',
  'Association':                           'Asociación',
  'Data Association':                      'Asociación de Datos',
  'Data Object Reference':                 'Referencia de Objeto de Datos',
  'Data Store Reference':                  'Referencia de Almacén de Datos',
  'Data Output Association':               'Asociación de Salida de Datos',
  'Data Input Association':                'Asociación de Entrada de Datos',
  'Pool':                                  'Pool',
  'Lane':                                  'Carril',
  'Group':                                 'Grupo',
  'Text Annotation':                       'Anotación de Texto',
  'Participant':                           'Participante',

  // ── Tipos de eventos (submenú "Change element") ─────────────────────────
  'None':                                  'Ninguno',
  'Message':                               'Mensaje',
  'Timer':                                 'Temporizador',
  'Error':                                 'Error',
  'Escalation':                            'Escalada',
  'Cancel':                                'Cancelar',
  'Compensation':                          'Compensación',
  'Conditional':                           'Condicional',
  'Signal':                                'Señal',
  'Terminate':                             'Terminación',
  'Link':                                  'Enlace',

  // ── Panel de propiedades ────────────────────────────────────────────────
  'Id':                                    'ID',
  'Name':                                  'Nombre',
  'Element Type':                          'Tipo de Elemento',
  'General':                               'General',

  // ── Errores / validación ────────────────────────────────────────────────
  'An error occurred while rendering the diagram':
    'Error al renderizar el diagrama',
  'no diagram to display':
    'No hay diagrama para mostrar',
};

/**
 * Módulo bpmn-js compatible con additionalModules.
 * Registra la función `translate` que devuelve textos en español.
 */
export const bpmnEsModule = {
  translate: [
    'value',
    function translateEs(template: string, replacements?: Record<string, string>): string {
      const translated = ES_TRANSLATIONS[template] ?? template;
      if (!replacements) return translated;
      return translated.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const val = replacements[key];
        // Si el valor reemplazado es a su vez un nombre de elemento, traducirlo también
        return (val && ES_TRANSLATIONS[val]) ? ES_TRANSLATIONS[val] : (val ?? `{${key}}`);
      });
    },
  ],
};
