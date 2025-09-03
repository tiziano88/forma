import * as protobuf from 'protobufjs';

export type DecodeResult = {
  type: protobuf.Type;
  decoded: any;
};

export type DecodeOptions = {
  offset?: number;
  delimited?: boolean;
};

export function findTargetType(root: protobuf.Root | protobuf.Namespace, typeName?: string | null): protobuf.Type {
  if (typeName) {
    try {
      const t = (root as any).lookupType(typeName) as protobuf.Type;
      if (t) return t;
    } catch {
      // fall through to auto-pick
    }
  }
  const messageTypes = findAllMessageTypes(root);
  if (messageTypes.length === 0) throw new Error('No message types found in the schema.');
  return messageTypes[messageTypes.length - 1];
}

export function decodeWithSchema(schemaText: string, data: Uint8Array, typeName?: string | null, opts: DecodeOptions = {}): DecodeResult {
  const { root } = protobuf.parse(schemaText);
  const target = findTargetType(root, typeName);
  const slice = opts.offset ? data.subarray(opts.offset) : data;
  try {
    const message = opts.delimited ? target.decodeDelimited(slice) : target.decode(slice);
    const decoded = message.toJSON({ enums: String, defaults: true });
    return { type: target, decoded };
  } catch (e: any) {
    // Fallback: if not explicitly delimited and we hit a wire-type error, try delimited
    if (!opts.delimited && /invalid wire type/i.test(String(e?.message || e))) {
      const message = target.decodeDelimited(slice);
      const decoded = message.toJSON({ enums: String, defaults: true });
      return { type: target, decoded };
    }
    throw e;
  }
}

export function listMessageTypeNames(schemaText: string): string[] {
  const { root } = protobuf.parse(schemaText);
  const all = findAllMessageTypes(root);
  return all.map(t => t.fullName.replace(/^\./, ''));
}

export function encodeFrom(type: protobuf.Type, object: any): Uint8Array {
  const message = type.fromObject(object);
  const buffer = type.encode(message).finish();
  return buffer;
}

const numericTypes = new Set([
  'double', 'float', 'int32', 'uint32', 'sint32', 'fixed32', 'sfixed32',
  'int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'
]);

export function sanitizeDataForSave(data: any, type: protobuf.Type): any {
  if (!data || !type) return data;
  const result: { [k: string]: any } = {};

  for (const key in data) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

    const value = data[key];
    const field = (type.fields as any)[key] as protobuf.Field | undefined;

    if (!field) {
      result[key] = value;
      continue;
    }

    if (field.repeated && field.resolvedType instanceof protobuf.Type && Array.isArray(value)) {
      result[key] = value.map((item: any) => sanitizeDataForSave(item, field.resolvedType as protobuf.Type));
    } else if (field.resolvedType instanceof protobuf.Type && isObject(value)) {
      result[key] = sanitizeDataForSave(value, field.resolvedType as protobuf.Type);
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

function isObject(value: any) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findAllMessageTypes(ns: protobuf.Namespace | protobuf.Root): protobuf.Type[] {
  let types: protobuf.Type[] = [];
  for (const obj of (ns as any).nestedArray || []) {
    if (obj instanceof protobuf.Type) {
      types.push(obj);
    } else if (obj instanceof protobuf.Namespace) {
      types = types.concat(findAllMessageTypes(obj));
    }
  }
  return types;
}
