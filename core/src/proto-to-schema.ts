/**
 * Converts protobuf type/enum registries into the abstract Schema format,
 * producing both a Schema (structural, opaque IDs) and Annotations (display).
 *
 * For protobuf, we use the fully-qualified names as the opaque IDs for top-level
 * types, and field names as-is (since protobuf field names are already identifiers).
 */

import type { MessageType, EnumType, FieldDef } from './types.js';
import { FieldType, FieldLabel } from './types.js';
import type { Schema, Type, Field, Annotations, Annotation } from './schema.js';
import { t } from './schema.js';

/** Result of converting protobuf registries to abstract schema. */
export interface ProtoSchemaResult {
  schema: Schema;
  annotations: Annotations;
}

/**
 * Convert protobuf type and enum registries into an abstract Schema + Annotations.
 */
export function protoToSchema(
  typeRegistry: Map<string, MessageType>,
  enumRegistry: Map<string, EnumType>
): ProtoSchemaResult {
  const definitions: Record<string, Type> = {};
  const annotations: Record<string, Annotation> = {};

  // Convert each enum to a sum type (data-less variants)
  for (const [fullName, enumType] of enumRegistry) {
    const variants: Record<string, { number?: number }> = {};
    for (const [num, name] of enumType.values) {
      variants[name] = t.variant(undefined, { number: num });
      // Annotate each variant with its name
      annotations[name] = { name };
    }
    definitions[fullName] = t.sum(variants);
    // Annotate the enum type
    annotations[fullName] = { name: fullName };
  }

  // Convert each message to a product type
  for (const [fullName, messageType] of typeRegistry) {
    const fields: Record<string, Field> = {};
    for (const [, fieldDef] of messageType.fields) {
      fields[fieldDef.name] = convertField(fieldDef);
      // Annotate each field
      annotations[fieldDef.name] = {
        name: fieldDef.name,
        ...(fieldDef.comment ? { doc: fieldDef.comment } : {}),
      };
    }
    definitions[fullName] = t.product(fields);
    // Annotate the message type
    annotations[fullName] = { name: fullName };
  }

  return {
    schema: { definitions },
    annotations,
  };
}

/**
 * Convert a single protobuf FieldDef into an abstract Field.
 */
function convertField(fieldDef: FieldDef): Field {
  let fieldType = convertFieldType(fieldDef);

  // Wrap repeated fields in a list
  if (fieldDef.label === FieldLabel.LABEL_REPEATED) {
    fieldType = t.list(fieldType);
  }

  return t.field(fieldType, {
    number: fieldDef.number,
    deprecated: fieldDef.deprecated,
  });
}

/**
 * Convert a protobuf FieldType to an abstract Type.
 */
function convertFieldType(fieldDef: FieldDef): Type {
  switch (fieldDef.type) {
    case FieldType.TYPE_STRING:
      return t.string();
    case FieldType.TYPE_BOOL:
      return t.bool();
    case FieldType.TYPE_INT32:
    case FieldType.TYPE_SINT32:
    case FieldType.TYPE_SFIXED32:
      return t.int32();
    case FieldType.TYPE_UINT32:
    case FieldType.TYPE_FIXED32:
      return t.uint32();
    case FieldType.TYPE_INT64:
    case FieldType.TYPE_SINT64:
    case FieldType.TYPE_SFIXED64:
      return t.int64();
    case FieldType.TYPE_UINT64:
    case FieldType.TYPE_FIXED64:
      return t.uint64();
    case FieldType.TYPE_FLOAT:
      return t.float32();
    case FieldType.TYPE_DOUBLE:
      return t.float64();
    case FieldType.TYPE_BYTES:
      return t.bytes();
    case FieldType.TYPE_ENUM:
      // Reference the enum type by name
      return fieldDef.typeName ? t.ref(fieldDef.typeName) : t.int32();
    case FieldType.TYPE_MESSAGE:
      // Reference the message type by name
      return fieldDef.typeName ? t.ref(fieldDef.typeName) : t.bytes();
    default:
      // Unknown/group types fall back to bytes
      return t.bytes();
  }
}
