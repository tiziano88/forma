/**
 * Abstract schema system for algebraic data types.
 *
 * A schema describes the shape of structured data, independent of any
 * particular serialization format (protobuf, JSON, YAML, etc.).
 *
 * The type algebra:
 *   - Product types (A × B × C): structs/records — all fields present
 *   - Sum types (A + B + C): tagged unions — exactly one variant
 *   - Primitives: string, bool, integers, floats, bytes
 *   - Collections: list, map
 *   - Optional: nullable wrapper
 *   - Ref: named type reference (for recursion and cross-referencing)
 */

// ---------------------------------------------------------------------------
// Primitive kinds
// ---------------------------------------------------------------------------

/** The set of primitive (leaf) types. */
export type PrimitiveKind =
  | 'string'
  | 'bool'
  | 'int32'
  | 'int64'
  | 'uint32'
  | 'uint64'
  | 'float32'
  | 'float64'
  | 'bytes';

// ---------------------------------------------------------------------------
// Type algebra
// ---------------------------------------------------------------------------

/** A structural type in the algebra. */
export type Type =
  | PrimitiveType
  | ProductType
  | SumType
  | ListType
  | MapType
  | OptionalType
  | RefType;

export interface PrimitiveType {
  readonly kind: 'primitive';
  readonly primitive: PrimitiveKind;
}

/** Product type: all fields present (struct / record). */
export interface ProductType {
  readonly kind: 'product';
  readonly fields: Record<string, Field>;
}

/** Sum type: exactly one variant active (tagged union). */
export interface SumType {
  readonly kind: 'sum';
  readonly variants: Record<string, Variant>;
}

/** Homogeneous list. */
export interface ListType {
  readonly kind: 'list';
  readonly element: Type;
}

/** Key-value map. */
export interface MapType {
  readonly kind: 'map';
  readonly key: Type;
  readonly value: Type;
}

/** Nullable wrapper. */
export interface OptionalType {
  readonly kind: 'optional';
  readonly inner: Type;
}

/** Named reference to a type defined in a Schema. */
export interface RefType {
  readonly kind: 'ref';
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Field & Variant descriptors
// ---------------------------------------------------------------------------

/** A field in a product type. */
export interface Field {
  readonly type: Type;
  /** Wire tag for binary format compatibility (e.g. protobuf field number). */
  readonly number?: number;
  /** Whether this field is deprecated. */
  readonly deprecated?: boolean;
}

/** A variant in a sum type. */
export interface Variant {
  /** Payload type. Absent means a data-less variant (plain enum value). */
  readonly payload?: Type;
  /** Wire tag for binary format compatibility. */
  readonly number?: number;
}

// ---------------------------------------------------------------------------
// Schema (collection of named type definitions)
// ---------------------------------------------------------------------------

/** A complete schema: a set of named type definitions. */
export interface Schema {
  readonly definitions: Record<string, Type>;
  /** Optional name of the root/entry-point type. */
  readonly root?: string;
}

// ---------------------------------------------------------------------------
// Annotations (display layer)
// ---------------------------------------------------------------------------

/** Display metadata for a single schema element (type, field, or variant). */
export interface Annotation {
  /** Human-readable name. */
  readonly name: string;
  /** Documentation / description. */
  readonly doc?: string;
  /** Display color (CSS). */
  readonly color?: string;
  /** Icon identifier. */
  readonly icon?: string;
}

/**
 * Maps opaque element IDs → display metadata.
 * Keys are the same opaque IDs used in Schema.definitions, ProductType.fields,
 * and SumType.variants.
 */
export type Annotations = Readonly<Record<string, Annotation>>;

// ---------------------------------------------------------------------------
// Schema utilities
// ---------------------------------------------------------------------------

/**
 * Resolve a type reference within a schema.
 * Returns the resolved Type, or undefined if the name is not defined.
 */
export function resolveRef(schema: Schema, name: string): Type | undefined {
  return schema.definitions[name];
}

/**
 * Fully resolve a type: if it's a ref, follow it (recursively) to the
 * concrete type. Returns undefined if a dangling ref is encountered.
 * Detects cycles and returns undefined if a cycle is found.
 */
export function resolveType(
  schema: Schema,
  type: Type,
  seen?: Set<string>
): Type | undefined {
  if (type.kind !== 'ref') return type;
  const visited = seen ?? new Set<string>();
  if (visited.has(type.name)) return undefined; // cycle
  visited.add(type.name);
  const resolved = schema.definitions[type.name];
  if (resolved === undefined) return undefined;
  return resolveType(schema, resolved, visited);
}

/**
 * Validate a schema: check that every ref points to an existing definition.
 * Returns a list of error messages (empty = valid).
 */
export function validateSchema(schema: Schema): string[] {
  const errors: string[] = [];
  const defined = new Set(Object.keys(schema.definitions));

  function checkType(type: Type, path: string): void {
    switch (type.kind) {
      case 'primitive':
        break;
      case 'ref':
        if (!defined.has(type.name)) {
          errors.push(`${path}: ref '${type.name}' is not defined`);
        }
        break;
      case 'optional':
        checkType(type.inner, `${path}.inner`);
        break;
      case 'list':
        checkType(type.element, `${path}.element`);
        break;
      case 'map':
        checkType(type.key, `${path}.key`);
        checkType(type.value, `${path}.value`);
        break;
      case 'product':
        for (const [name, field] of Object.entries(type.fields)) {
          checkType(field.type, `${path}.${name}`);
        }
        break;
      case 'sum':
        for (const [tag, variant] of Object.entries(type.variants)) {
          if (variant.payload) {
            checkType(variant.payload, `${path}.${tag}`);
          }
        }
        break;
    }
  }

  for (const [name, type] of Object.entries(schema.definitions)) {
    checkType(type, name);
  }

  if (schema.root !== undefined && !defined.has(schema.root)) {
    errors.push(`root type '${schema.root}' is not defined`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Constructor helpers (namespace `t`)
// ---------------------------------------------------------------------------

/** Convenient constructors for building types. */
export const t = {
  // Primitives
  string(): PrimitiveType {
    return { kind: 'primitive', primitive: 'string' };
  },
  bool(): PrimitiveType {
    return { kind: 'primitive', primitive: 'bool' };
  },
  int32(): PrimitiveType {
    return { kind: 'primitive', primitive: 'int32' };
  },
  int64(): PrimitiveType {
    return { kind: 'primitive', primitive: 'int64' };
  },
  uint32(): PrimitiveType {
    return { kind: 'primitive', primitive: 'uint32' };
  },
  uint64(): PrimitiveType {
    return { kind: 'primitive', primitive: 'uint64' };
  },
  float32(): PrimitiveType {
    return { kind: 'primitive', primitive: 'float32' };
  },
  float64(): PrimitiveType {
    return { kind: 'primitive', primitive: 'float64' };
  },
  bytes(): PrimitiveType {
    return { kind: 'primitive', primitive: 'bytes' };
  },

  // Composites
  product(fields: Record<string, Field>): ProductType {
    return { kind: 'product', fields };
  },
  sum(variants: Record<string, Variant>): SumType {
    return { kind: 'sum', variants };
  },
  list(element: Type): ListType {
    return { kind: 'list', element };
  },
  map(key: Type, value: Type): MapType {
    return { kind: 'map', key, value };
  },
  optional(inner: Type): OptionalType {
    return { kind: 'optional', inner };
  },
  ref(name: string): RefType {
    return { kind: 'ref', name };
  },

  // Shorthand: field with just a type
  field(type: Type, opts?: Omit<Field, 'type'>): Field {
    return { type, ...opts };
  },

  // Shorthand: variant with optional payload
  variant(payload?: Type, opts?: Omit<Variant, 'payload'>): Variant {
    return { payload, ...opts };
  },
} as const;

// ---------------------------------------------------------------------------
// UI / rendering helpers
// ---------------------------------------------------------------------------

const NUMERIC_PRIMITIVES: ReadonlySet<PrimitiveKind> = new Set([
  'int32', 'int64', 'uint32', 'uint64', 'float32', 'float64',
]);

/** True if the field type is a list (i.e. repeated). */
export function isFieldRepeated(field: Field): boolean {
  return field.type.kind === 'list';
}

/** Get the element type of a repeated field, or the field type itself. */
export function getElementType(field: Field): Type {
  return field.type.kind === 'list' ? field.type.element : field.type;
}

/** Extract the ref name from a type, if it's a ref (optionally unwrapping list). */
export function getRefName(type: Type): string | undefined {
  if (type.kind === 'ref') return type.name;
  if (type.kind === 'list' && type.element.kind === 'ref') return type.element.name;
  return undefined;
}

/** True if the given type resolves to a product (message) type. */
export function isMessageField(schema: Schema, field: Field): boolean {
  const inner = getElementType(field);
  if (inner.kind === 'product') return true;
  if (inner.kind === 'ref') {
    const resolved = resolveType(schema, inner);
    return resolved?.kind === 'product';
  }
  return false;
}

/** True if the given type resolves to a sum (enum) type. */
export function isEnumField(schema: Schema, field: Field): boolean {
  const inner = getElementType(field);
  if (inner.kind === 'sum') return true;
  if (inner.kind === 'ref') {
    const resolved = resolveType(schema, inner);
    return resolved?.kind === 'sum';
  }
  return false;
}

/** True if the type is a numeric primitive. */
export function isNumericPrimitive(type: Type): boolean {
  return type.kind === 'primitive' && NUMERIC_PRIMITIVES.has(type.primitive);
}

/** True if the type is a bool primitive. */
export function isBoolPrimitive(type: Type): boolean {
  return type.kind === 'primitive' && type.primitive === 'bool';
}

/** True if the type is a bytes primitive. */
export function isBytesPrimitive(type: Type): boolean {
  return type.kind === 'primitive' && type.primitive === 'bytes';
}

/** True if the type is any primitive. */
export function isPrimitive(type: Type): boolean {
  return type.kind === 'primitive';
}

/** Human-readable display name for a type (for badges/pills). */
export function displayTypeName(type: Type): string {
  switch (type.kind) {
    case 'primitive': return type.primitive;
    case 'ref': return type.name;
    case 'list': return `repeated ${displayTypeName(type.element)}`;
    case 'map': return `map<${displayTypeName(type.key)}, ${displayTypeName(type.value)}>`;
    case 'optional': return `optional ${displayTypeName(type.inner)}`;
    case 'product': return 'message';
    case 'sum': return 'enum';
  }
}
