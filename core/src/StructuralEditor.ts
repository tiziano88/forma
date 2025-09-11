import * as protobuf from 'protobufjs';
import 'protobufjs/ext/descriptor';
import { Bytes, EditorData, EditorEvent, EditorEventType, EventListener } from './types';

export class StructuralEditor {
  private listeners: Map<EditorEventType, EventListener[]> = new Map();

  // Core state
  private dataBytes: Bytes | null = null;
  private rootMessageType: protobuf.Type | null = null;
  private decodedData: any = null;
  private selectedTypeName: string | null = null;
  private dynamicRoot: protobuf.Root | null = null;

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

  public setData = async (dataBytes: Bytes, typeName?: string | null): Promise<void> => {
    this.dataBytes = dataBytes;
    this.selectedTypeName = typeName || this.selectedTypeName;
    if (this.selectedTypeName) {
      await this.decode(this.selectedTypeName);
    }
    this.emit({ type: 'change' });
  }

  public getAvailableTypes = (): string[] => {
    try {
      if (!this.dynamicRoot) return [];
      const all = this.findMessageTypesInRoot(this.dynamicRoot);
      return all.map(t => t.fullName.replace(/^\./, ''));
    } catch (e) {
      console.error('[Editor Core] Error getting available types:', e);
      return [];
    }
  }

  public getCurrentType = (): string | null => {
    return this.rootMessageType?.fullName.replace(/^\./, '') || null;
  }

  public setCurrentType = async (typeName: string): Promise<void> => {
    if (this.selectedTypeName === typeName) return;
    this.selectedTypeName = typeName;
    if (this.dataBytes) {
      await this.decode(typeName);
      this.emit({ type: 'change' });
    }
  }

  public getDecodedData = (): any => {
    return this.decodedData;
  }

  public updateDecodedData = (newData: any): void => {
    this.decodedData = newData;
    this.emit({ type: 'change' });
  }

  public getEncodedBytes = (): Bytes => {
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

  public getRootMessageType = (): protobuf.Type | null => {
    return this.rootMessageType;
  }

  public getHexView = (source: 'original' | 'encoded' = 'encoded'): string => {
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
      this.dynamicRoot = (protobuf.Root as any).fromDescriptor(descriptorBytes);
      console.log('[Editor Core] Successfully loaded schema from descriptor.');
    } catch (error) {
      console.error('[Editor Core] Error loading schema from descriptor:', error);
      this.dynamicRoot = null;
      throw error;
    }
  }

  private async decode(typeName: string): Promise<void> {
    if (!this.dataBytes || !this.dynamicRoot) {
      this.rootMessageType = null;
      this.decodedData = null;
      return;
    }

    try {
      const target = this.findTargetType(this.dynamicRoot, typeName);

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
      
      const jsonData = (message as any).toJSON({ enums: String, defaults: true });
      this.decodedData = this.createSchemaCompleteObject(jsonData, target);
      
      console.log('[Editor Core] Successfully decoded with all fields:', Object.keys(this.decodedData || {}));
    } catch (error) {
      console.error("[Editor Core] Error decoding data:", error);
      this.rootMessageType = null;
      this.decodedData = null;
      this.emit({ type: 'error', payload: error });
    }
  }

  private findTargetType(schemaRoot: protobuf.Root, typeName?: string | null): protobuf.Type {
    if (typeName) {
      const targetType = schemaRoot.lookupType(typeName);
      if (targetType) {
        return targetType;
      }
    }
    const types = this.findMessageTypesInRoot(schemaRoot);
    if (types.length > 0) {
      return types[0];
    }
    throw new Error('No message types found in the dynamic schema.');
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

  private sanitizeDataForSave(data: any, type: protobuf.Type): any {
    if (!data || !type) return data;
    const result: { [k: string]: any } = {};
    const numericTypes = new Set([
      'double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32',
      'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'
    ]);

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
    if (!type) {
      return data;
    }
    
    const result = data ? { ...data } : {};
    
    if (type.fieldsArray && type.fieldsArray.length > 0) {
      for (const field of type.fieldsArray) {
        if (!(field.name in result)) {
          result[field.name] = this.getDefaultValueForField(field);
        } else if (field.resolvedType instanceof protobuf.Type && result[field.name] && typeof result[field.name] === 'object') {
          if (field.repeated && Array.isArray(result[field.name])) {
            result[field.name] = result[field.name].map((item: any) => 
              this.createSchemaCompleteObject(item, field.resolvedType as protobuf.Type)
            );
          } else {
            result[field.name] = this.createSchemaCompleteObject(result[field.name], field.resolvedType as protobuf.Type);
          }
        }
      }
    }
    return result;
  }

  private getDefaultValueForField(field: protobuf.Field): any {
    if (field.repeated) {
      return [];
    }
    
    if (field.resolvedType instanceof protobuf.Type) {
      return undefined;
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
