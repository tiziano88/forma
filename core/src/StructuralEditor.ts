import { parseFileDescriptorSet, ParsedDescriptorProto, ParsedFieldDescriptorProto, FieldType, FieldLabel } from './descriptor-parser.js';
import { Bytes, EditorData, EditorEvent, EditorEventType, EventListener, EnumType } from './types.js';
import * as jspb from 'google-protobuf';

// New two-layer IR system
interface FieldDef {
  name: string;
  number: number;
  type: FieldType;
  label: FieldLabel;
  typeName?: string; // Always fully qualified for MESSAGE types
}

interface MessageType {
  fullName: string;                    // "com.example.Outer.Inner"
  fields: Map<number, FieldDef>;       // field number -> field definition
  fieldNameToNumber: Map<string, number>; // field name -> field number
}

type TypeRegistry = Map<string, MessageType>; // "full.name" -> MessageType
type EnumRegistry = Map<string, EnumType>; // "full.name" -> EnumType

type InterpretedValue = 
  | string 
  | number 
  | boolean 
  | Uint8Array 
  | MessageValue;

interface MessageValue {
  type: MessageType;
  fields: Map<number, InterpretedValue[]>; // field number -> values (repeated = array)
  modifiedFields: Set<number>; // track changes
  
  // Methods
  getField<T extends InterpretedValue>(fieldNumber: number): T | undefined;
  getRepeatedField<T extends InterpretedValue>(fieldNumber: number): T[];
  setField<T extends InterpretedValue>(fieldNumber: number, value: T): void;
  addRepeatedField<T extends InterpretedValue>(fieldNumber: number, value: T): void;
  clearField(fieldNumber: number): void;
  hasField(fieldNumber: number): boolean;
  getSetFields(): number[];
  toObject(): Record<string, any>;
  toBytes(): Uint8Array;
  isModified(): boolean;
  getModifiedFieldNumbers(): number[];
  resetModifiedTracking(): void;
}

// MessageValue implementation class
class MessageValueImpl implements MessageValue {
  type: MessageType;
  fields: Map<number, InterpretedValue[]>;
  modifiedFields: Set<number>;

  constructor(messageType: MessageType) {
    this.type = messageType;
    this.fields = new Map();
    this.modifiedFields = new Set();
  }

  // Get field value (returns first value for non-repeated, undefined if not set)
  getField<T extends InterpretedValue>(fieldNumber: number): T | undefined {
    const values = this.fields.get(fieldNumber);
    if (!values || values.length === 0) return undefined;
    
    const fieldDef = this.type.fields.get(fieldNumber);
    if (fieldDef?.label === FieldLabel.LABEL_REPEATED) {
      throw new Error(`Use getRepeatedField for repeated field ${fieldNumber}`);
    }
    
    return values[0] as T;
  }

  // Get repeated field values
  getRepeatedField<T extends InterpretedValue>(fieldNumber: number): T[] {
    const values = this.fields.get(fieldNumber);
    if (!values) return [];
    
    const fieldDef = this.type.fields.get(fieldNumber);
    if (fieldDef?.label !== FieldLabel.LABEL_REPEATED) {
      throw new Error(`Field ${fieldNumber} is not repeated`);
    }
    
    return values as T[];
  }

  // Set field value (for non-repeated fields)
  setField<T extends InterpretedValue>(fieldNumber: number, value: T): void {
    const fieldDef = this.type.fields.get(fieldNumber);
    if (!fieldDef) {
      throw new Error(`Unknown field number: ${fieldNumber}`);
    }
    
    if (fieldDef.label === FieldLabel.LABEL_REPEATED) {
      throw new Error(`Use addRepeatedField for repeated field ${fieldNumber}`);
    }
    
    this.validateFieldValue(fieldDef, value);
    this.fields.set(fieldNumber, [value]);
    this.modifiedFields.add(fieldNumber);
  }

  // Add value to repeated field
  addRepeatedField<T extends InterpretedValue>(fieldNumber: number, value: T): void {
    const fieldDef = this.type.fields.get(fieldNumber);
    if (!fieldDef) {
      throw new Error(`Unknown field number: ${fieldNumber}`);
    }
    
    if (fieldDef.label !== FieldLabel.LABEL_REPEATED) {
      throw new Error(`Field ${fieldNumber} is not repeated`);
    }
    
    this.validateFieldValue(fieldDef, value);
    
    const existing = this.fields.get(fieldNumber) || [];
    existing.push(value);
    this.fields.set(fieldNumber, existing);
    this.modifiedFields.add(fieldNumber);
  }

  // Clear field
  clearField(fieldNumber: number): void {
    this.fields.delete(fieldNumber);
    this.modifiedFields.add(fieldNumber);
  }

  // Check if field is set
  hasField(fieldNumber: number): boolean {
    const values = this.fields.get(fieldNumber);
    return values !== undefined && values.length > 0;
  }

  // Get all set field numbers
  getSetFields(): number[] {
    return Array.from(this.fields.keys()).filter(fn => this.hasField(fn));
  }

  // Convert to display object (with field names)
  toObject(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [fieldNumber, values] of this.fields) {
      const fieldDef = this.type.fields.get(fieldNumber);
      if (!fieldDef || values.length === 0) continue;
      
      if (fieldDef.label === FieldLabel.LABEL_REPEATED) {
        result[fieldDef.name] = values.map(v => this.valueToObject(v));
      } else {
        result[fieldDef.name] = this.valueToObject(values[0]);
      }
    }
    
    return result;
  }

  // Convert to bytes
  toBytes(): Uint8Array {
    const writer = new jspb.BinaryWriter();
    
    // Sort by field number for deterministic output
    const sortedFields = Array.from(this.fields.keys()).sort((a, b) => a - b);
    
    for (const fieldNumber of sortedFields) {
      const fieldDef = this.type.fields.get(fieldNumber);
      const values = this.fields.get(fieldNumber);
      if (!fieldDef || !values || values.length === 0) continue;

      for (const value of values) {
        this.writeFieldValue(writer, fieldDef, value);
      }
    }
    
    return writer.getResultBuffer();
  }

  // Change tracking
  isModified(): boolean {
    return this.modifiedFields.size > 0;
  }

  getModifiedFieldNumbers(): number[] {
    return Array.from(this.modifiedFields);
  }

  resetModifiedTracking(): void {
    this.modifiedFields.clear();
  }

  // Private helpers
  private valueToObject(value: InterpretedValue): any {
    if (typeof value === 'object' && 'type' in value && 'fields' in value) {
      // It's a MessageValue
      return (value as MessageValue).toObject();
    } else if (value instanceof Uint8Array) {
      // Convert bytes to base64 for display
      return btoa(String.fromCharCode(...Array.from(value)));
    }
    return value;
  }

  private validateFieldValue(fieldDef: FieldDef, value: InterpretedValue): void {
    // Basic type validation
    switch (fieldDef.type) {
      case FieldType.TYPE_STRING:
        if (typeof value !== 'string') {
          throw new Error(`Field ${fieldDef.name} expects string, got ${typeof value}`);
        }
        break;
      case FieldType.TYPE_BOOL:
        if (typeof value !== 'boolean') {
          throw new Error(`Field ${fieldDef.name} expects boolean, got ${typeof value}`);
        }
        break;
      case FieldType.TYPE_INT32:
      case FieldType.TYPE_UINT32:
      case FieldType.TYPE_INT64:
      case FieldType.TYPE_UINT64:
      case FieldType.TYPE_DOUBLE:
      case FieldType.TYPE_FLOAT:
      case FieldType.TYPE_ENUM:
        if (typeof value !== 'number') {
          throw new Error(`Field ${fieldDef.name} expects number, got ${typeof value}`);
        }
        break;
      case FieldType.TYPE_BYTES:
        if (!(value instanceof Uint8Array)) {
          throw new Error(`Field ${fieldDef.name} expects Uint8Array, got ${typeof value}`);
        }
        break;
      case FieldType.TYPE_MESSAGE:
        if (typeof value !== 'object' || !('type' in value) || !('fields' in value)) {
          throw new Error(`Field ${fieldDef.name} expects MessageValue, got ${typeof value}`);
        }
        break;
    }
  }

  private writeFieldValue(writer: jspb.BinaryWriter, fieldDef: FieldDef, value: InterpretedValue): void {
    switch (fieldDef.type) {
      case FieldType.TYPE_STRING:
        writer.writeString(fieldDef.number, value as string);
        break;
      case FieldType.TYPE_INT32:
        writer.writeInt32(fieldDef.number, value as number);
        break;
      case FieldType.TYPE_UINT32:
        writer.writeUint32(fieldDef.number, value as number);
        break;
      case FieldType.TYPE_INT64:
        writer.writeInt64(fieldDef.number, value as number);
        break;
      case FieldType.TYPE_UINT64:
        writer.writeUint64(fieldDef.number, value as number);
        break;
      case FieldType.TYPE_BOOL:
        writer.writeBool(fieldDef.number, value as boolean);
        break;
      case FieldType.TYPE_FLOAT:
        writer.writeFloat(fieldDef.number, value as number);
        break;
      case FieldType.TYPE_DOUBLE:
        writer.writeDouble(fieldDef.number, value as number);
        break;
      case FieldType.TYPE_BYTES:
        writer.writeBytes(fieldDef.number, value as Uint8Array);
        break;
      case FieldType.TYPE_MESSAGE:
        const messageBytes = (value as MessageValue).toBytes();
        writer.writeBytes(fieldDef.number, messageBytes);
        break;
      case FieldType.TYPE_ENUM:
        writer.writeEnum(fieldDef.number, value as number);
        break;
    }
  }
}

export class StructuralEditor {
  private listeners: Map<EditorEventType, EventListener[]> = new Map();

  // Core state
  private dataBytes: Bytes | null = null;
  private decodedData: MessageValue | null = null;
  private selectedTypeName: string | null = null;
  private typeRegistry: TypeRegistry = new Map();
  private enumRegistry: EnumRegistry = new Map();
  private schemaLoaded: boolean = false;

  constructor() {
    console.log('[Editor Core] Instantiated.');
  }

  // --- Public API ---

  public on = (event: EditorEventType, listener: EventListener): void => {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  public off = (event: EditorEventType, listener: EventListener): void => {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  public initialize = async (data: EditorData): Promise<void> => {
    console.log('[Editor Core] Initializing with data');
    
    this.dataBytes = data.data;
    this.selectedTypeName = data.typeName || null;
    
    if (data.schemaDescriptor) {
      try {
        await this.loadSchemaFromDescriptor(data.schemaDescriptor);
        this.schemaLoaded = true;
      } catch (error) {
        console.error('[Editor Core] Error loading schema descriptor:', error);
        this.emit({ type: 'error', payload: error });
        return;
      }
    }
    
    this.createDecodedView();
    this.emit({ type: 'change' });
  }

  public setData = async (dataBytes: Bytes, typeName?: string | null): Promise<void> => {
    this.dataBytes = dataBytes;
    this.selectedTypeName = typeName || this.selectedTypeName;
    this.createDecodedView();
    this.emit({ type: 'change' });
  }

  public getAvailableTypes = (): string[] => {
    return Array.from(this.typeRegistry.keys());
  }

  public getCurrentType = (): string | null => {
    return this.selectedTypeName;
  }

  public setCurrentType = async (typeName: string): Promise<void> => {
    if (this.selectedTypeName === typeName) return;
    this.selectedTypeName = typeName;
    this.createDecodedView();
    this.emit({ type: 'change' });
  }

  public getDecodedData = (): MessageValue | null => {
    return this.decodedData;
  }

  public updateDecodedData = (newData: any): void => {
    // This will require a more complex implementation to update the MessageValue
    this.emit({ type: 'change' });
  }

  public getEncodedBytes = (): Bytes => {
    if (!this.decodedData) {
      return this.dataBytes || new Uint8Array();
    }
    return this.decodedData.toBytes();
  }

  public getRootMessageType = (): MessageType | null => {
    if (!this.selectedTypeName) return null;
    return this.typeRegistry.get(this.selectedTypeName) || null;
  }

  public getTypeRegistry = (): TypeRegistry => {
    return this.typeRegistry;
  }

  public getEnumRegistry = (): EnumRegistry => {
    return this.enumRegistry;
  }

  public getHexView = (source: 'original' | 'encoded' = 'encoded'): string => {
    const bytes = source === 'encoded' ? this.getEncodedBytes() : (this.dataBytes || new Uint8Array());
    return this.formatHex(bytes);
  }

  // --- Private Implementation ---

  private emit = (event: EditorEvent): void => {
    const eventListeners = this.listeners.get(event.type);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(event));
    }
  }

  private loadSchemaFromDescriptor = async (descriptorBytes: Bytes): Promise<void> => {
    console.log('[Editor Core] Loading schema from binary descriptor, size:', descriptorBytes.length);
    
    try {
      const descriptorSet = parseFileDescriptorSet(descriptorBytes);
      this.typeRegistry = this.buildFlatTypeRegistry(descriptorSet);
      this.enumRegistry = this.buildEnumRegistry(descriptorSet);
      
      console.log('[Editor Core] Successfully loaded schema from descriptor. Found types:', Array.from(this.typeRegistry.keys()));
      console.log('[Editor Core] Found enums:', Array.from(this.enumRegistry.keys()));
      
      // Debug: Print the TypeRegistry structure
      this.printTypeRegistry();
    } catch (error) {
      console.error('[Editor Core] Error loading schema from descriptor:', error);
      this.typeRegistry.clear();
      throw error;
    }
  }

  private buildFlatTypeRegistry = (descriptorSet: any): TypeRegistry => {
    const registry = new Map<string, MessageType>();
    
    for (const file of descriptorSet.files) {
      const packageName = file.packageName || '';
      
      // Recursively process all message types, flattening them
      const processMessage = (msg: ParsedDescriptorProto, parentName: string) => {
        const fullName = parentName ? `${parentName}.${msg.name}` : `${packageName}.${msg.name}`;
        // Add leading dot for consistency with protobuf naming convention
        const fullNameWithDot = `.${fullName}`;
        
        const messageType: MessageType = {
          fullName: fullNameWithDot,
          fields: new Map(),
          fieldNameToNumber: new Map()
        };
        
        // Process fields
        for (const field of msg.fields) {
          const fieldDef: FieldDef = {
            name: field.name,
            number: field.number,
            type: field.type,
            label: field.label,
            typeName: field.typeName // Already fully qualified by protobuf parser
          };
          messageType.fields.set(field.number, fieldDef);
          messageType.fieldNameToNumber.set(field.name, field.number);
        }
        
        registry.set(fullNameWithDot, messageType);
        
        // Recursively process nested types (they become top-level in registry)
        for (const nested of msg.nestedTypes) {
          processMessage(nested, fullName);
        }
      };
      
      for (const message of file.messageTypes) {
        processMessage(message, packageName);
      }
    }
    
    return registry;
  }

  private buildEnumRegistry = (descriptorSet: any): EnumRegistry => {
    const registry = new Map<string, EnumType>();

    for (const file of descriptorSet.files) {
      const packageName = file.packageName || '';

      // Process top-level enums
      for (const enumProto of file.enumTypes || []) {
        const fullName = `.${packageName}.${enumProto.name}`;
        const enumType: EnumType = {
          fullName,
          values: new Map(),
          valuesByName: new Map()
        };

        for (const value of enumProto.values) {
          enumType.values.set(value.number, value.name);
          enumType.valuesByName.set(value.name, value.number);
        }

        registry.set(fullName, enumType);
      }

      // Recursively process nested enums in messages
      const processMessage = (msg: ParsedDescriptorProto, parentName: string) => {
        const fullName = parentName ? `${parentName}.${msg.name}` : `${packageName}.${msg.name}`;

        // Process nested enums
        for (const enumProto of msg.enumTypes || []) {
          const enumFullName = `.${fullName}.${enumProto.name}`;
          const enumType: EnumType = {
            fullName: enumFullName,
            values: new Map(),
            valuesByName: new Map()
          };

          for (const value of enumProto.values) {
            enumType.values.set(value.number, value.name);
            enumType.valuesByName.set(value.name, value.number);
          }

          registry.set(enumFullName, enumType);
        }

        // Recursively process nested types
        for (const nested of msg.nestedTypes) {
          processMessage(nested, fullName);
        }
      };

      for (const message of file.messageTypes) {
        processMessage(message, packageName);
      }
    }

    return registry;
  }

  private printTypeRegistry = (): void => {
    console.log('\n=== TypeRegistry Structure ===');
    for (const [typeName, messageType] of this.typeRegistry) {
      console.log(`\nMessageType: ${typeName}`);
      console.log('  Fields:');
      for (const [fieldNumber, fieldDef] of messageType.fields) {
        const typeStr = fieldDef.typeName || `${FieldType[fieldDef.type]}`;
        const labelStr = fieldDef.label === FieldLabel.LABEL_REPEATED ? 'repeated ' : '';
        console.log(`    ${fieldNumber}: ${labelStr}${typeStr} ${fieldDef.name}`);
      }
    }
    console.log('=== End TypeRegistry ===\n');
  }

  private createDecodedView = (): void => {
    console.log('[Editor Core] createDecodedView called');
    console.log('  dataBytes:', this.dataBytes ? `${this.dataBytes.length} bytes` : 'null');
    console.log('  schemaLoaded:', this.schemaLoaded);
    console.log('  selectedTypeName:', this.selectedTypeName);
    
    if (!this.dataBytes || !this.schemaLoaded) {
      this.decodedData = null;
      console.log('[Editor Core] Early return - missing data or schema');
      return;
    }

    const messageType = this.selectedTypeName ? this.typeRegistry.get(this.selectedTypeName) : null;
    console.log('  messageType found:', messageType ? messageType.fullName : 'null');
    
    if (!messageType) {
      this.decodedData = null;
      console.log('[Editor Core] Early return - no message type');
      return;
    }

    try {
      console.log('[Editor Core] Starting message parsing...');
      this.decodedData = this.parseMessage(this.dataBytes, messageType);
      console.log('[Editor Core] Message parsing successful');
      
      // Debug: Print the parsed MessageValue
      this.printMessageValue(this.decodedData);
    } catch (error) {
      console.error('[Editor Core] Error parsing message:', error);
      console.error('[Editor Core] Error stack:', (error as Error).stack);
      this.emit({ type: 'error', payload: error });
      this.decodedData = null;
    }
  }

  // Direct parsing from bytes + MessageType → MessageValue
  private parseMessage = (bytes: Uint8Array, messageType: MessageType): MessageValue => {
    console.log(`[Editor Core] Parsing message of ${bytes.length} bytes for type ${messageType.fullName}`);
    const reader = new jspb.BinaryReader(bytes);
    const messageValue = new MessageValueImpl(messageType);

    let fieldCount = 0;
    while (reader.nextField()) {
      if (reader.isEndGroup()) {
        break;
      }
      const fieldNumber = reader.getFieldNumber();
      const fieldDef = messageType.fields.get(fieldNumber);
      fieldCount++;
      
      console.log(`[Editor Core] Found field ${fieldNumber}, fieldDef:`, fieldDef ? fieldDef.name : 'unknown');
      
      if (!fieldDef) {
        console.log(`[Editor Core] Skipping unknown field ${fieldNumber}`);
        reader.skipField(); // Unknown field
        continue;
      }

      // Directly interpret based on schema type
      const value = this.parseFieldValue(reader, fieldDef);
      console.log(`[Editor Core] Parsed field ${fieldNumber} (${fieldDef.name}):`, value);
      
      if (fieldDef.label === FieldLabel.LABEL_REPEATED) {
        messageValue.addRepeatedField(fieldNumber, value);
      } else {
        messageValue.setField(fieldNumber, value);
      }
    }

    console.log(`[Editor Core] Finished parsing. Found ${fieldCount} fields total.`);
    return messageValue;
  }

  private parseFieldValue = (reader: jspb.BinaryReader, fieldDef: FieldDef): InterpretedValue => {
    switch (fieldDef.type) {
      case FieldType.TYPE_STRING:
        return reader.readString();
      case FieldType.TYPE_BYTES:
        return reader.readBytes();
      case FieldType.TYPE_BOOL:
        return reader.readBool();
      case FieldType.TYPE_INT32:
      case FieldType.TYPE_SINT32:
      case FieldType.TYPE_SFIXED32:
        return reader.readInt32();
      case FieldType.TYPE_UINT32:
      case FieldType.TYPE_FIXED32:
        return reader.readUint32();
      case FieldType.TYPE_INT64:
      case FieldType.TYPE_SINT64:
      case FieldType.TYPE_SFIXED64:
        return parseInt(reader.readInt64String()); // Convert to number for simplicity
      case FieldType.TYPE_UINT64:
      case FieldType.TYPE_FIXED64:
        return parseInt(reader.readUint64String()); // Convert to number for simplicity
      case FieldType.TYPE_FLOAT:
        return reader.readFloat();
      case FieldType.TYPE_DOUBLE:
        return reader.readDouble();
      case FieldType.TYPE_MESSAGE:
        // Directly parse nested message using schema
        return this.parseNestedMessage(reader, fieldDef);
      case FieldType.TYPE_ENUM:
        return reader.readEnum();
      default:
        reader.skipField();
        throw new Error(`Unsupported field type: ${fieldDef.type}`);
    }
  }

  private parseNestedMessage = (reader: jspb.BinaryReader, fieldDef: FieldDef): MessageValue => {
    const nestedBytes = reader.readBytes();
    const nestedType = this.typeRegistry.get(fieldDef.typeName || '');
    if (!nestedType) {
      throw new Error(`Unknown message type: ${fieldDef.typeName}`);
    }
    
    return this.parseMessage(nestedBytes, nestedType);
  }

  private printMessageValue = (messageValue: MessageValue): void => {
    console.log('\n=== Parsed MessageValue ===');
    console.log('Type:', messageValue.type.fullName);
    console.log('Raw fields map:', messageValue.fields);
    console.log('Set fields:', messageValue.getSetFields());
    console.log('Object representation (with field names):');
    console.log(JSON.stringify(messageValue.toObject(), null, 2));
    
    // Show individual field values
    console.log('Individual field values:');
    for (const fieldNumber of messageValue.getSetFields()) {
      const fieldDef = messageValue.type.fields.get(fieldNumber);
      if (fieldDef) {
        if (fieldDef.label === FieldLabel.LABEL_REPEATED) {
          console.log(`  ${fieldNumber} (${fieldDef.name}):`, messageValue.getRepeatedField(fieldNumber));
        } else {
          console.log(`  ${fieldNumber} (${fieldDef.name}):`, messageValue.getField(fieldNumber));
        }
      }
    }
    console.log('=== End MessageValue ===\n');
  }

  createEmptyMessage(typeName: string): MessageValue | null {
    const messageType = this.typeRegistry.get(typeName);
    if (!messageType) {
      return null;
    }
    return new MessageValueImpl(messageType);
  }

  private formatHex = (data: Uint8Array, cols = 16): string => {
    let out: string[] = [];
    for (let i = 0; i < data.length; i += cols) {
      const slice = data.subarray(i, Math.min(i + cols, data.length));
      const addr = i.toString(16).toUpperCase().padStart(8, '0');
      const hex = Array.from(slice).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      const pad = '   '.repeat(cols - slice.length);
      const ascii = Array.from(slice).map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
      out.push(`${addr}  ${hex}${pad}  |${ascii}|`);
    }
    return out.join('\n');
  }
}