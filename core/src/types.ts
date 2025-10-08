import { SvelteMap, SvelteSet } from './svelte-reactivity.js';
import type {
  FieldDescriptorProto_Type,
  FieldDescriptorProto_Label,
} from './generated/config/descriptor.js';
import type {
  FieldPath as ProtoFieldPath,
  FieldPathSegment as ProtoFieldPathSegment,
  Comment as ProtoComment,
} from './generated/config/presentation.js';

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
  presentationData?: Bytes;
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
  deprecated?: boolean;
  comment?: string;
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

// Re-export presentation types for convenience
export type { ProtoFieldPath, ProtoFieldPathSegment, ProtoComment };
export type FieldPath = ProtoFieldPath;
export type FieldPathSegment = ProtoFieldPathSegment;
export type Comment = ProtoComment;

/**
 * PathKey utilities for comparing and manipulating FieldPath objects
 */
export class PathKey {
  /**
   * Check if two FieldPath objects are equal
   */
  static equals(a: FieldPath, b: FieldPath): boolean {
    if (a.segments.length !== b.segments.length) return false;

    for (let i = 0; i < a.segments.length; i++) {
      const segA = a.segments[i];
      const segB = b.segments[i];
      if (segA.fieldNumber !== segB.fieldNumber || segA.arrayIndex !== segB.arrayIndex) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a copy of a FieldPath
   */
  static clone(path: FieldPath): FieldPath {
    return {
      segments: path.segments.map(seg => ({
        fieldNumber: seg.fieldNumber,
        arrayIndex: seg.arrayIndex,
      })),
    };
  }

  /**
   * Append a segment to a path (returns new path)
   */
  static append(path: FieldPath, segment: FieldPathSegment): FieldPath {
    return {
      segments: [...path.segments, segment],
    };
  }

  /**
   * Get parent path (remove last segment, returns new path or null)
   */
  static parent(path: FieldPath): FieldPath | null {
    if (path.segments.length === 0) return null;
    return {
      segments: path.segments.slice(0, -1),
    };
  }

  /**
   * Check if pathA starts with pathB (pathB is a prefix of pathA)
   */
  static startsWith(pathA: FieldPath, pathB: FieldPath): boolean {
    if (pathB.segments.length > pathA.segments.length) return false;

    for (let i = 0; i < pathB.segments.length; i++) {
      const segA = pathA.segments[i];
      const segB = pathB.segments[i];
      if (segA.fieldNumber !== segB.fieldNumber || segA.arrayIndex !== segB.arrayIndex) {
        return false;
      }
    }

    return true;
  }
}
