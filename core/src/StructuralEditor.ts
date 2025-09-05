import * as protobuf from 'protobufjs';
import { Bytes, EditorData, EditorEvent, EditorEventType, EventListener } from './types';

export class StructuralEditor {
  private listeners: Map<EditorEventType, EventListener[]> = new Map();

  // Core state
  private schemaText: string | null = null;
  private dataBytes: Bytes | null = null;
  private rootMessageType: protobuf.Type | null = null;
  private decodedData: any = null;
  private selectedTypeName: string | null = null;

  constructor() {}

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
    this.schemaText = data.schemaText;
    this.dataBytes = data.data;
    this.selectedTypeName = data.typeName || null;
    await this.decodeData();
    this.emit({ type: 'change' });
  }

  public async setSchema(schemaText: string): Promise<void> {
    this.schemaText = schemaText;
    this.rootMessageType = null;
    this.decodedData = null;
    this.selectedTypeName = null; // Reset type name on new schema
    if (this.dataBytes) {
      await this.decodeData();
    }
    this.emit({ type: 'change' });
  }

  public async setData(dataBytes: Bytes, typeName?: string | null): Promise<void> {
    this.dataBytes = dataBytes;
    this.selectedTypeName = typeName || this.selectedTypeName;
    if (this.schemaText) {
      await this.decodeData();
    }
    this.emit({ type: 'change' });
  }

  public getAvailableTypes(): string[] {
    if (!this.schemaText) return [];
    try {
      const { root } = protobuf.parse(this.schemaText);
      const all = this.findAllMessageTypes(root);
      return all.map(t => t.fullName.replace(/^\./, ''));
    } catch {
      return [];
    }
  }

  public getCurrentType(): string | null {
    return this.rootMessageType?.fullName.replace(/^\./, '') || null;
  }

  public async setCurrentType(typeName: string): Promise<void> {
    if (this.selectedTypeName === typeName) return;
    this.selectedTypeName = typeName;
    if (this.schemaText && this.dataBytes) {
      await this.decodeData();
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
      this.emit({ type: 'error', payload: err });
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

  private async decodeData(): Promise<void> {
    if (!this.schemaText || !this.dataBytes) {
      this.rootMessageType = null;
      this.decodedData = null;
      return;
    }

    try {
      const { root } = protobuf.parse(this.schemaText);
      const target = this.findTargetType(root, this.selectedTypeName);

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
      this.decodedData = (message as any).toJSON({ enums: String, defaults: true });
    } catch (error) {
      console.error("Error decoding data:", error);
      this.rootMessageType = null;
      this.decodedData = null;
      this.emit({ type: 'error', payload: error });
    }
  }

  private findTargetType(root: protobuf.Root, typeName?: string | null): protobuf.Type {
    if (typeName) {
      try {
        const t = root.lookupType(typeName);
        if (t) return t;
      } catch {
        // fall through
      }
    }
    const messageTypes = this.findAllMessageTypes(root);
    if (messageTypes.length === 0) throw new Error('No message types found in the schema.');
    return messageTypes[messageTypes.length - 1];
  }

  private findAllMessageTypes(ns: protobuf.Namespace | protobuf.Root): protobuf.Type[] {
    let types: protobuf.Type[] = [];
    for (const obj of (ns as any).nestedArray || []) {
      if (obj instanceof protobuf.Type) {
        types.push(obj);
      } else if (obj instanceof protobuf.Namespace) {
        types = types.concat(this.findAllMessageTypes(obj));
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
