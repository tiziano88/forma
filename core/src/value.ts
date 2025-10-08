/**
 * Abstract value representation for structured data.
 *
 * A Value is a format-independent data tree that can represent any data
 * conforming to a Schema. It's the common intermediate representation
 * between specific formats (JSON, YAML, protobuf binary, etc.).
 */

import type { Schema, Type } from './schema.js';
import { resolveRef } from './schema.js';

// ---------------------------------------------------------------------------
// Default value creation
// ---------------------------------------------------------------------------

/**
 * Create a default (empty) Value for a given schema Type.
 * Products get all fields populated with defaults. Sums pick the first variant.
 * Lists and maps start empty. Primitives get zero values.
 */
export function defaultValue(schema: Schema, type: Type): Value {
  switch (type.kind) {
    case 'primitive':
      switch (type.primitive) {
        case 'string': return { kind: 'string', value: '' };
        case 'bool': return { kind: 'bool', value: false };
        case 'int32': case 'int64': case 'uint32': case 'uint64':
          return { kind: 'int', value: 0 };
        case 'float32': case 'float64':
          return { kind: 'float', value: 0 };
        case 'bytes': return { kind: 'bytes', value: new Uint8Array() };
      }
      break;
    case 'product': {
      const fields: Record<string, Value> = {};
      for (const [fieldId, field] of Object.entries(type.fields)) {
        fields[fieldId] = defaultValue(schema, field.type);
      }
      return { kind: 'product', fields };
    }
    case 'sum': {
      const entries = Object.entries(type.variants);
      if (entries.length === 0) return { kind: 'null' };
      const [tag, variant] = entries[0];
      return {
        kind: 'sum',
        tag,
        payload: variant.payload ? defaultValue(schema, variant.payload) : null,
      };
    }
    case 'list': return { kind: 'list', elements: [] };
    case 'map': return { kind: 'map', entries: [] };
    case 'optional': return { kind: 'null' };
    case 'ref': {
      const resolved = resolveRef(schema, type.name);
      if (!resolved) return { kind: 'null' };
      return defaultValue(schema, resolved);
    }
  }
}

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

/** A format-independent data value. */
export type Value =
  | StringValue
  | BoolValue
  | IntValue
  | FloatValue
  | BytesValue
  | ProductValue
  | SumValue
  | ListValue
  | MapValue
  | NullValue;

export interface StringValue {
  readonly kind: 'string';
  readonly value: string;
}

export interface BoolValue {
  readonly kind: 'bool';
  readonly value: boolean;
}

/** Integer value (covers int32, uint32, int64, uint64). */
export interface IntValue {
  readonly kind: 'int';
  readonly value: number;
}

/** Floating-point value (covers float32, float64). */
export interface FloatValue {
  readonly kind: 'float';
  readonly value: number;
}

export interface BytesValue {
  readonly kind: 'bytes';
  readonly value: Uint8Array;
}

/** Product value: named fields, each with a value. */
export interface ProductValue {
  readonly kind: 'product';
  readonly fields: Record<string, Value>;
}

/** Sum value: one active variant identified by tag, with optional payload. */
export interface SumValue {
  readonly kind: 'sum';
  readonly tag: string;
  readonly payload: Value | null;
}

/** Homogeneous list of values. */
export interface ListValue {
  readonly kind: 'list';
  readonly elements: Value[];
}

/** Map of key-value pairs. */
export interface MapValue {
  readonly kind: 'map';
  readonly entries: [Value, Value][];
}

/** Null / absent value. */
export interface NullValue {
  readonly kind: 'null';
}

// ---------------------------------------------------------------------------
// Codec interface
// ---------------------------------------------------------------------------

/**
 * A Codec converts between a specific serialization format and the abstract
 * Value representation.
 *
 * Implementations would include: JSON, YAML, protobuf binary, etc.
 */
export interface Codec {
  /** Decode format-specific bytes into an abstract Value. */
  decode(bytes: Uint8Array, schema: Schema, typeName: string): Value;
  /** Encode an abstract Value into format-specific bytes. */
  encode(value: Value, schema: Schema, typeName: string): Uint8Array;
}

// ---------------------------------------------------------------------------
// Structural equality
// ---------------------------------------------------------------------------

/** Deep structural equality for Values. */
export function valueEquals(a: Value, b: Value): boolean {
  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case 'string':
      return a.value === (b as StringValue).value;
    case 'bool':
      return a.value === (b as BoolValue).value;
    case 'int':
      return a.value === (b as IntValue).value;
    case 'float':
      return a.value === (b as FloatValue).value;
    case 'null':
      return true;
    case 'bytes': {
      const bb = b as BytesValue;
      if (a.value.length !== bb.value.length) return false;
      for (let i = 0; i < a.value.length; i++) {
        if (a.value[i] !== bb.value[i]) return false;
      }
      return true;
    }
    case 'product': {
      const bp = b as ProductValue;
      const aKeys = Object.keys(a.fields);
      const bKeys = Object.keys(bp.fields);
      if (aKeys.length !== bKeys.length) return false;
      for (const key of aKeys) {
        if (!(key in bp.fields)) return false;
        if (!valueEquals(a.fields[key], bp.fields[key])) return false;
      }
      return true;
    }
    case 'sum': {
      const bs = b as SumValue;
      if (a.tag !== bs.tag) return false;
      if (a.payload === null && bs.payload === null) return true;
      if (a.payload === null || bs.payload === null) return false;
      return valueEquals(a.payload, bs.payload);
    }
    case 'list': {
      const bl = b as ListValue;
      if (a.elements.length !== bl.elements.length) return false;
      for (let i = 0; i < a.elements.length; i++) {
        if (!valueEquals(a.elements[i], bl.elements[i])) return false;
      }
      return true;
    }
    case 'map': {
      const bm = b as MapValue;
      if (a.entries.length !== bm.entries.length) return false;
      // Order-sensitive comparison (maps as ordered lists of pairs)
      for (let i = 0; i < a.entries.length; i++) {
        if (
          !valueEquals(a.entries[i][0], bm.entries[i][0]) ||
          !valueEquals(a.entries[i][1], bm.entries[i][1])
        ) {
          return false;
        }
      }
      return true;
    }
  }
}

// ---------------------------------------------------------------------------
// Conversion to plain JS objects
// ---------------------------------------------------------------------------

/**
 * Convert a Value to a plain JavaScript object.
 * Useful for debugging, display, and JSON serialization.
 */
export function valueToJSON(value: Value): unknown {
  switch (value.kind) {
    case 'string':
      return value.value;
    case 'bool':
      return value.value;
    case 'int':
      return value.value;
    case 'float':
      return value.value;
    case 'null':
      return null;
    case 'bytes':
      // Encode as base64
      return btoa(String.fromCharCode(...Array.from(value.value)));
    case 'product': {
      const obj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value.fields)) {
        obj[key] = valueToJSON(val);
      }
      return obj;
    }
    case 'sum':
      return {
        [value.tag]: value.payload !== null ? valueToJSON(value.payload) : null,
      };
    case 'list':
      return value.elements.map(valueToJSON);
    case 'map':
      return value.entries.map(([k, val]) => [valueToJSON(k), valueToJSON(val)]);
  }
}

// ---------------------------------------------------------------------------
// Constructor helpers (namespace `v`)
// ---------------------------------------------------------------------------

/** Convenient constructors for building values. */
export const v = {
  string(value: string): StringValue {
    return { kind: 'string', value };
  },
  bool(value: boolean): BoolValue {
    return { kind: 'bool', value };
  },
  int(value: number): IntValue {
    return { kind: 'int', value };
  },
  float(value: number): FloatValue {
    return { kind: 'float', value };
  },
  bytes(value: Uint8Array): BytesValue {
    return { kind: 'bytes', value };
  },
  product(fields: Record<string, Value>): ProductValue {
    return { kind: 'product', fields };
  },
  sum(tag: string, payload: Value | null = null): SumValue {
    return { kind: 'sum', tag, payload };
  },
  list(elements: Value[]): ListValue {
    return { kind: 'list', elements };
  },
  map(entries: [Value, Value][]): MapValue {
    return { kind: 'map', entries };
  },
  null(): NullValue {
    return { kind: 'null' };
  },
} as const;
