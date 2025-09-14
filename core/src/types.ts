export type Bytes = Uint8Array;

export interface EditorData {
  data: Bytes;
  typeName?: string | null;
  schemaDescriptor?: Bytes;
}

// Events the editor can emit for the UI to listen to
export type EditorEventType = 'change' | 'error';

export interface EditorEvent {
  type: EditorEventType;
  payload?: any;
}

export type EventListener = (event: EditorEvent) => void;

// MessageValue and MessageType interfaces for the new IR system
export interface FieldDef {
  name: string;
  number: number;
  type: string;
  label: string;
  typeName?: string;
}

export interface MessageType {
  fullName: string;
  fields: Map<number, FieldDef>;
  fieldNameToNumber: Map<string, number>;
}

export type InterpretedValue = string | number | boolean | MessageValue;

export interface MessageValue {
  type: MessageType;
  fields: Map<number, InterpretedValue[]>;
  modifiedFields: Set<number>;

  getField<T extends InterpretedValue>(fieldNumber: number): T | undefined;
  getFieldArray<T extends InterpretedValue>(fieldNumber: number): T[];
  setField<T extends InterpretedValue>(fieldNumber: number, value: T): void;
  setFieldArray<T extends InterpretedValue>(fieldNumber: number, values: T[]): void;
  hasField(fieldNumber: number): boolean;
  clearField(fieldNumber: number): void;
  getAllFieldNumbers(): number[];
  isModified(fieldNumber: number): boolean;
  toObject(): Record<string, any>;
}
