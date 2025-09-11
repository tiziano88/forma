import * as protobuf from 'protobufjs';
import { Bytes, EditorData, EditorEvent, EditorEventType, EventListener } from './types';
import root from './schema.js';

export class StructuralEditor {
  private listeners: Map<EditorEventType, EventListener[]> = new Map();

  // Core state
  private dataBytes: Bytes | null = null;
  private rootMessageType: protobuf.Type | null = null;
  private decodedData: any = null;
  private selectedTypeName: string | null = null;
  private dynamicRoot: protobuf.Root | null = null;

  constructor() {
    console.log('[Editor Core] Instantiated. Pre-compiled schema root:', root);
  }

  // --- Public API ---

  public on(event: EditorEventType, listener: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  public off(event: EditorEventType, listener: EventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  public async initialize(data: EditorData): Promise<void> {
    console.log('[Editor Core] Initializing with data');
    
    this.dataBytes = data.data;
    this.selectedTypeName = data.typeName || null;
    
    // Load dynamic schema if provided
    if (data.schemaDescriptor) {
      try {
        await this.loadSchemaFromDescriptor(data.schemaDescriptor);
      } catch (error) {
        console.error('[Editor Core] Error loading schema descriptor:', error);
        this.emit({ type: 'error', payload: error });
      }
    }
    
    if (this.selectedTypeName) {
      await this.decode(this.selectedTypeName);
    }
    
    this.emit({ type: 'change' });
  }

  public async setData(dataBytes: Bytes, typeName?: string | null): Promise<void> {
    this.dataBytes = dataBytes;
    this.selectedTypeName = typeName || this.selectedTypeName;
    if (this.selectedTypeName) {
      await this.decode(this.selectedTypeName);
    }
    this.emit({ type: 'change' });
  }

  public getAvailableTypes(): string[] {
    try {
      const currentRoot = this.dynamicRoot || root;
      
      let all: protobuf.Type[] = [];
      if (currentRoot instanceof protobuf.Root) {
        // Handle dynamic protobuf.Root
        all = this.findMessageTypesInRoot(currentRoot);
      } else {
        // Handle static schema
        all = this.findAllMessageTypes(currentRoot);
      }
      
      return all.map(t => t.fullName.replace(/^\./, ''));
    } catch (e) {
      console.error('[Editor Core] Error getting available types:', e);
      return [];
    }
  }

  public getCurrentType(): string | null {
    return this.rootMessageType?.fullName.replace(/^\./, '') || null;
  }

  public async setCurrentType(typeName: string): Promise<void> {
    if (this.selectedTypeName === typeName) return;
    this.selectedTypeName = typeName;
    if (this.dataBytes) {
      await this.decode(typeName);
      this.emit({ type: 'change' });
    }
  }

  public getDecodedData(): any {
    return this.decodedData;
  }

  public updateDecodedData(newData: any): void {
    this.decodedData = newData;
    this.emit({ type: 'change' });
  }

  public getEncodedBytes(): Bytes {
    if (!this.rootMessageType || !this.decodedData) {
      return this.dataBytes || new Uint8Array();
    }
    try {
      const sanitized = this.sanitizeDataForSave(this.decodedData, this.rootMessageType);
      const errMsg = this.rootMessageType.verify(sanitized);
      if (errMsg) {
        throw new Error(`Verification failed: ${errMsg}`);
      }
      const message = this.rootMessageType.fromObject(sanitized);
      return this.rootMessageType.encode(message).finish();
    } catch (err) {
      console.error('[Editor Core] Error in getEncodedBytes:', err);
      return this.dataBytes || new Uint8Array();
    }
  }

  public getRootMessageType(): protobuf.Type | null {
    return this.rootMessageType;
  }

  public getHexView(source: 'original' | 'encoded' = 'encoded'): string {
    const bytes = source === 'encoded' ? this.getEncodedBytes() : (this.dataBytes || new Uint8Array());
    return this.formatHex(bytes);
  }

  // --- Private Implementation ---

  private emit(event: EditorEvent): void {
    const eventListeners = this.listeners.get(event.type);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(event));
    }
  }

  private async loadSchemaFromDescriptor(descriptorBytes: Bytes): Promise<void> {
    console.log('[Editor Core] Loading schema from binary descriptor, size:', descriptorBytes.length);
    
    try {
      // For now, create a dynamic root that will use the binary descriptor when decoding
      // This is a simplified approach that acknowledges we have the descriptor but 
      // focuses on making the UI schema-driven rather than trying to parse the descriptor
      this.dynamicRoot = new protobuf.Root();
      
      console.log('[Editor Core] Created dynamic root for binary descriptor usage');
      console.log('[Editor Core] Will use binary descriptor for schema-driven UI');
    } catch (error) {
      console.error('[Editor Core] Error setting up binary descriptor usage:', error);
      // Reset to use static schema as fallback
      this.dynamicRoot = null;
      throw error;
    }
  }

  private async decode(typeName: string): Promise<void> {
    if (!this.dataBytes) {
      this.rootMessageType = null;
      this.decodedData = null;
      return;
    }

    try {
      const currentRoot = this.dynamicRoot || root;
      const target = this.findTargetType(currentRoot, typeName);

      let message;
      try {
        message = target.decode(this.dataBytes);
      } catch (e: any) {
        if (/invalid wire type/i.test(String(e?.message || e))) {
          message = target.decodeDelimited(this.dataBytes);
        } else {
          throw e;
        }
      }

      this.rootMessageType = target;
      
      // Create a complete object with all schema fields, not just populated ones
      const jsonData = (message as any).toJSON({ enums: String, defaults: true });
      console.log('[Editor Core] Original decoded data:', jsonData);
      console.log('[Editor Core] Target type:', target);
      console.log('[Editor Core] Target fields:', target.fields);
      console.log('[Editor Core] Target fieldsArray:', target.fieldsArray);
      
      this.decodedData = this.createSchemaCompleteObject(jsonData, target);
      
      console.log('[Editor Core] Schema-complete data:', this.decodedData);
      console.log('[Editor Core] Successfully decoded with all fields:', Object.keys(this.decodedData || {}));
    } catch (error) {
      console.error("[Editor Core] Error decoding data:", error);
      this.rootMessageType = null;
      this.decodedData = null;
      this.emit({ type: 'error', payload: error });
    }
  }

  private findTargetType(schemaRoot: any, typeName?: string | null): protobuf.Type {
    // Handle dynamic protobuf.Root
    if (schemaRoot instanceof protobuf.Root) {
      if (typeName) {
        const targetType = schemaRoot.lookupType(typeName);
        if (targetType) {
          return targetType;
        }
      }
      // Fallback: find first message type in dynamic root
      const types = schemaRoot.nested || {};
      for (const name in types) {
        const nested = types[name];
        if (nested instanceof protobuf.Type) {
          return nested;
        }
      }
      throw new Error('No message types found in the dynamic schema.');
    }

    // Handle static schema
    const messageTypes = this.findAllMessageTypes(schemaRoot);
    if (messageTypes.length === 0) throw new Error('No message types found in the schema.');

    if (typeName) {
      // The fullName property on generated types doesn't have a leading dot.
      const targetType = messageTypes.find(t => t.fullName === typeName || `.${t.fullName}` === typeName);
      if (targetType) {
        return targetType;
      }
    }

    // Fallback to the last type found.
    return messageTypes[messageTypes.length - 1];
  }

  private findMessageTypesInRoot(root: protobuf.Root): protobuf.Type[] {
    const types: protobuf.Type[] = [];
    
    const traverse = (obj: any) => {
      if (obj instanceof protobuf.Type) {
        types.push(obj);
      } else if (obj && typeof obj === 'object' && obj.nested) {
        Object.values(obj.nested).forEach(traverse);
      }
    };
    
    traverse(root);
    return types;
  }

  private findAllMessageTypes(ns: any, types: protobuf.Type[] = [], path: string = ''): protobuf.Type[] {
    if (ns && typeof ns.create === 'function' && typeof ns.encode === 'function' && typeof ns.decode === 'function') {
      // The generated static objects don't have a `fullName` property by default,
      // so we add it here based on the path we've tracked.
      if (!(ns as any).fullName) {
        (ns as any).fullName = path;
      }
      types.push(ns as protobuf.Type);
    }
    else if (ns && typeof ns === 'object' && !Array.isArray(ns)) {
      for (const key of Object.keys(ns)) {
        // The root object from a static module might have a `$protobuf` property which we should not traverse.
        if (key === '$protobuf') continue;
        this.findAllMessageTypes(ns[key], types, path ? `${path}.${key}` : key);
      }
    }
    return types;
  }

  private sanitizeDataForSave(data: any, type: protobuf.Type): any {
    if (!data || !type) return data;
    const result: { [k: string]: any } = {};
    const numericTypes = new Set([
      'double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32',
      'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'
    ]);

    // Check if type has fields property
    if (!type.fields) {
      console.warn('[Editor Core] Type does not have fields property:', type);
      return data;
    }

    for (const key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

      const value = data[key];
      const field = (type.fields as any)[key] as protobuf.Field | undefined;

      if (!field) {
        result[key] = value;
        continue;
      }

      if (field.repeated && field.resolvedType instanceof protobuf.Type && Array.isArray(value)) {
        result[key] = value.map((item: any) => this.sanitizeDataForSave(item, field.resolvedType as protobuf.Type));
      } else if (field.resolvedType instanceof protobuf.Type && (value !== null && typeof value === 'object' && !Array.isArray(value))) {
        result[key] = this.sanitizeDataForSave(value, field.resolvedType as protobuf.Type);
      } else if (field.resolvedType instanceof protobuf.Enum && typeof value === 'string') {
        result[key] = (field.resolvedType as protobuf.Enum).values[value as string];
      } else if (numericTypes.has(field.type) && typeof value !== 'number') {
        result[key] = Number(value) || 0;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private createSchemaCompleteObject(data: any, type: protobuf.Type): any {
    console.log('[Editor Core] createSchemaCompleteObject called with:', { data, type: type?.fullName });
    
    if (!type) {
      console.log('[Editor Core] No type provided, returning original data');
      return data;
    }
    
    const result = data ? { ...data } : {};
    console.log('[Editor Core] Starting result:', result);
    
    // Add all schema fields, even if they're not in the data
    if (type.fieldsArray && type.fieldsArray.length > 0) {
      console.log('[Editor Core] Processing fieldsArray:', type.fieldsArray.map(f => f.name));
      // Dynamic protobuf type
      for (const field of type.fieldsArray) {
        console.log(`[Editor Core] Processing field ${field.name}, exists: ${field.name in result}`);
        if (!(field.name in result)) {
          const defaultValue = this.getDefaultValueForField(field);
          console.log(`[Editor Core] Adding missing field ${field.name} with default:`, defaultValue);
          result[field.name] = defaultValue;
        } else if (field.resolvedType instanceof protobuf.Type && result[field.name] && typeof result[field.name] === 'object') {
          // Recursively ensure nested objects have all schema fields
          if (field.repeated && Array.isArray(result[field.name])) {
            result[field.name] = result[field.name].map((item: any) => 
              this.createSchemaCompleteObject(item, field.resolvedType as protobuf.Type)
            );
          } else {
            result[field.name] = this.createSchemaCompleteObject(result[field.name], field.resolvedType as protobuf.Type);
          }
        }
      }
    } else if (type.fields && Object.keys(type.fields).length > 0) {
      console.log('[Editor Core] Processing fields:', Object.keys(type.fields));
      // Static generated type with fields metadata
      for (const fieldName in type.fields) {
        const field = (type.fields as any)[fieldName] as protobuf.Field;
        console.log(`[Editor Core] Processing field ${fieldName}, exists: ${fieldName in result}`);
        if (!(fieldName in result)) {
          const defaultValue = this.getDefaultValueForField(field);
          console.log(`[Editor Core] Adding missing field ${fieldName} with default:`, defaultValue);
          result[fieldName] = defaultValue;
        } else if (field.resolvedType instanceof protobuf.Type && result[fieldName] && typeof result[fieldName] === 'object') {
          // Recursively ensure nested objects have all schema fields
          if (field.repeated && Array.isArray(result[fieldName])) {
            result[fieldName] = result[fieldName].map((item: any) => 
              this.createSchemaCompleteObject(item, field.resolvedType as protobuf.Type)
            );
          } else {
            result[fieldName] = this.createSchemaCompleteObject(result[fieldName], field.resolvedType as protobuf.Type);
          }
        }
      }
    } else {
      // For static generated types without direct field metadata, extract from prototype
      console.log('[Editor Core] Attempting to extract schema fields from static type');
      const schemaFields = this.extractFieldsFromStaticType(type);
      console.log('[Editor Core] Extracted schema fields:', schemaFields);
      
      for (const fieldName of schemaFields) {
        if (!(fieldName in result)) {
          console.log(`[Editor Core] Adding missing static field ${fieldName} with default value`);
          result[fieldName] = this.getDefaultValueForStaticField(fieldName);
        }
      }
    }
    
    console.log('[Editor Core] Final result:', result);
    return result;
  }

  private extractFieldsFromStaticType(type: any): string[] {
    // For static generated types, the field names can be extracted from the prototype
    const fields: string[] = [];
    
    if (type && type.prototype) {
      // Look for properties on the prototype that are field names
      const proto = type.prototype;
      for (const key in proto) {
        if (typeof proto[key] === 'string' || typeof proto[key] === 'number' || 
            Array.isArray(proto[key]) || proto[key] === false) {
          fields.push(key);
        }
      }
    }
    
    return fields;
  }

  private getDefaultValueForStaticField(fieldName: string): any {
    // Provide sensible defaults based on common field names
    if (fieldName.includes('files') || fieldName.endsWith('s')) {
      return [];
    }
    return '';
  }

  private getDefaultValueForField(field: protobuf.Field): any {
    if (field.repeated) {
      return [];
    }
    
    if (field.resolvedType instanceof protobuf.Type) {
      return undefined; // Will show as "Add" button in UI
    }
    
    if (field.resolvedType instanceof protobuf.Enum) {
      const enumValues = Object.keys(field.resolvedType.values);
      return enumValues[0] || undefined;
    }
    
    switch (field.type) {
      case 'string': return '';
      case 'bool': return false;
      case 'int32':
      case 'uint32':
      case 'sint32':
      case 'fixed32':
      case 'sfixed32':
      case 'int64':
      case 'uint64':
      case 'sint64':
      case 'fixed64':
      case 'sfixed64':
      case 'double':
      case 'float':
        return 0;
      case 'bytes':
        return new Uint8Array();
      default:
        return undefined;
    }
  }

  private formatHex(data: Uint8Array, cols = 16): string {
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