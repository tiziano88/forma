import { SvelteMap, SvelteSet } from './svelte-reactivity.js';
import type {
  FieldDescriptorProto_Type,
  FieldDescriptorProto_Label,
} from './generated/config/descriptor.js';

export type Bytes = Uint8Array;

// Re-export generated enums from descriptor.proto for convenience
export {
  FieldDescriptorProto_Type as FieldType,
  FieldDescriptorProto_Label as FieldLabel,
} from './generated/config/descriptor.js';

// Type aliases for use within this file
type FieldType = FieldDescriptorProto_Type;
type FieldLabel = FieldDescriptorProto_Label;

// Runtime constant to ensure this module generates JS output
export const TYPES_MODULE_VERSION = '1.0.0';

export interface EditorData {
  data: Bytes;
  typeName?: string | null;
  schemaDescriptor?: Bytes;
}

// Events the editor can emit for the UI to listen to
export type EditorEventType = 'change' | 'error';

export interface EditorEvent {
  type: EditorEventType;
  payload?: unknown;
}

export type EventListener = (event: EditorEvent) => void;

// MessageValue and MessageType interfaces for the new IR system
export interface FieldDef {
  name: string;
  number: number;
  type: FieldType;
  label: FieldLabel;
  typeName?: string;
}

export interface MessageType {
  fullName: string;
  fields: Map<number, FieldDef>;
  fieldNameToNumber: Map<string, number>;
}

export interface EnumType {
  fullName: string;
  values: Map<number, string>; // number -> name mapping
  valuesByName: Map<string, number>; // name -> number mapping
}

export type InterpretedValue = string | number | boolean | Bytes | MessageValue;

export interface MessageValue {
  type: MessageType;
  fields: SvelteMap<number, InterpretedValue[]>;
  modifiedFields: SvelteSet<number>;

  getField<T extends InterpretedValue>(fieldNumber: number): T | undefined;
  getRepeatedField<T extends InterpretedValue>(fieldNumber: number): T[];
  setField<T extends InterpretedValue>(fieldNumber: number, value: T): void;
  addRepeatedField<T extends InterpretedValue>(
    fieldNumber: number,
    value: T
  ): void;
  clearField(fieldNumber: number): void;
  hasField(fieldNumber: number): boolean;
  getSetFields(): number[];
  toObject(): Record<string, unknown>;
  toBytes(): Uint8Array;
  isModified(): boolean;
  getModifiedFieldNumbers(): number[];
  resetModifiedTracking(): void;
}
