/**
 * Extensión Moddle para bpmn-js.
 * Define el namespace "custom" que almacena:
 *   - custom:FormFields  → contenedor de campos del formulario dinámico
 *   - custom:Field       → un campo individual (label, type, required, ayuda)
 *   - custom:Assignee    → departamento responsable del UserTask
 *   - custom:DestinationDepartment → departamento destino (documentos)
 *   - custom:FlowStarter → marca la tarea que puede iniciar el flujo
 *   - custom:UserCreation → habilita crear usuario cliente en la tarea
 *
 * El XML resultante dentro de <bpmn:extensionElements> queda así:
 *
 *   <custom:formFields>
 *     <custom:field id="f1" label="Foto cedula" type="image" required="true" ayuda="Foto del carnet"/>
 *   </custom:formFields>
 *   <custom:assignee departamento="AT"/>
 *   <custom:destinationDepartment departamento="DOC"/>
 *   <custom:flowStarter enabled="true"/>
 *   <custom:userCreation enabled="true"/>
 */
export const CUSTOM_MODDLE = {
  name: 'custom',
  uri: 'http://workflow-app/schema/bpmn/custom',
  prefix: 'custom',
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'FormFields',
      superClass: ['Element'],
      properties: [
        {
          name: 'fields',
          isMany: true,
          type: 'Field',
        },
      ],
    },
    {
      name: 'Field',
      superClass: ['Element'],
      properties: [
        { name: 'id',       isAttr: true, type: 'String' },
        { name: 'label',    isAttr: true, type: 'String' },
        { name: 'type',     isAttr: true, type: 'String' },
        { name: 'required', isAttr: true, type: 'String' },
        { name: 'ayuda',    isAttr: true, type: 'String' },
      ],
    },
    {
      name: 'Assignee',
      superClass: ['Element'],
      properties: [
        { name: 'departamento', isAttr: true, type: 'String' },
      ],
    },
    {
      name: 'DestinationDepartment',
      superClass: ['Element'],
      properties: [
        { name: 'departamento', isAttr: true, type: 'String' },
      ],
    },
    {
      name: 'FlowStarter',
      superClass: ['Element'],
      properties: [
        { name: 'enabled', isAttr: true, type: 'String' },
      ],
    },
    {
      name: 'UserCreation',
      superClass: ['Element'],
      properties: [
        { name: 'enabled', isAttr: true, type: 'String' },
      ],
    },
  ],
};
