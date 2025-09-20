import { SvelteMap, SvelteSet } from './svelte-reactivity.js';

export type Bytes = Uint8Array;

// Field type and label enums (from protobuf descriptor.proto)
export enum FieldType {
  TYPE_DOUBLE = 1,
  TYPE_FLOAT = 2,
  TYPE_INT64 = 3,
  TYPE_UINT64 = 4,
  TYPE_INT32 = 5,
  TYPE_FIXED64 = 6,
  TYPE_FIXED32 = 7,
  TYPE_BOOL = 8,
  TYPE_STRING = 9,
  TYPE_GROUP = 10,
  TYPE_MESSAGE = 11,
  TYPE_BYTES = 12,
  TYPE_UINT32 = 13,
  TYPE_ENUM = 14,
  TYPE_SFIXED32 = 15,
  TYPE_SFIXED64 = 16,
  TYPE_SINT32 = 17,
  TYPE_SINT64 = 18,
}

export enum FieldLabel {
  LABEL_OPTIONAL = 1,
  LABEL_REQUIRED = 2,
  LABEL_REPEATED = 3,
}

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
