// Simple binary protobuf parser for descriptor.proto
// We only need to parse FileDescriptorSet to extract message type information

export interface ParsedFileDescriptorSet {
  files: ParsedFileDescriptorProto[];
}

export interface ParsedFileDescriptorProto {
  name: string;
  packageName: string;
  messageTypes: ParsedDescriptorProto[];
  enumTypes: ParsedEnumDescriptorProto[];
}

export interface ParsedDescriptorProto {
  name: string;
  fields: ParsedFieldDescriptorProto[];
  nestedTypes: ParsedDescriptorProto[];
  enumTypes: ParsedEnumDescriptorProto[];
}

export interface ParsedFieldDescriptorProto {
  name: string;
  number: number;
  label: FieldLabel;
  type: FieldType;
  typeName?: string;
}

export interface ParsedEnumDescriptorProto {
  name: string;
  values: ParsedEnumValueDescriptorProto[];
}

export interface ParsedEnumValueDescriptorProto {
  name: string;
  number: number;
}

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

// Simple protobuf wire format parser
class ProtobufReader {
  private view: DataView;
  private position: number = 0;

  constructor(private buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  hasMore(): boolean {
    return this.position < this.buffer.length;
  }

  readVarint(): number {
    let result = 0;
    let shift = 0;
    
    while (true) {
      if (this.position >= this.buffer.length) {
        throw new Error('Unexpected end of buffer');
      }
      
      const byte = this.buffer[this.position++];
      result |= (byte & 0x7f) << shift;
      
      if ((byte & 0x80) === 0) {
        break;
      }
      
      shift += 7;
      if (shift >= 32) {
        throw new Error('Varint too long');
      }
    }
    
    return result >>> 0; // Convert to unsigned 32-bit
  }

  readString(): string {
    const length = this.readVarint();
    if (this.position + length > this.buffer.length) {
      throw new Error('String length exceeds buffer');
    }
    
    const bytes = this.buffer.slice(this.position, this.position + length);
    this.position += length;
    
    return new TextDecoder().decode(bytes);
  }

  readBytes(): Uint8Array {
    const length = this.readVarint();
    if (this.position + length > this.buffer.length) {
      throw new Error('Bytes length exceeds buffer');
    }
    
    const bytes = this.buffer.slice(this.position, this.position + length);
    this.position += length;
    
    return bytes;
  }

  skipField(wireType: number): void {
    switch (wireType) {
      case 0: // Varint
        this.readVarint();
        break;
      case 1: // Fixed64
        this.position += 8;
        break;
      case 2: // Length-delimited
        const length = this.readVarint();
        this.position += length;
        break;
      case 5: // Fixed32
        this.position += 4;
        break;
      default:
        throw new Error(`Unknown wire type: ${wireType}`);
    }
  }
}

export function parseFileDescriptorSet(bytes: Uint8Array): ParsedFileDescriptorSet {
  const reader = new ProtobufReader(bytes);
  const files: ParsedFileDescriptorProto[] = [];

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    if (fieldNumber === 1 && wireType === 2) {
      // FileDescriptorProto
      const fileBytes = reader.readBytes();
      files.push(parseFileDescriptorProto(fileBytes));
    } else {
      reader.skipField(wireType);
    }
  }

  return { files };
}

function parseFileDescriptorProto(bytes: Uint8Array): ParsedFileDescriptorProto {
  const reader = new ProtobufReader(bytes);
  let name = '';
  let packageName = '';
  const messageTypes: ParsedDescriptorProto[] = [];
  const enumTypes: ParsedEnumDescriptorProto[] = [];

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1: // name
        if (wireType === 2) {
          name = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 2: // package
        if (wireType === 2) {
          packageName = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 4: // message_type
        if (wireType === 2) {
          const msgBytes = reader.readBytes();
          messageTypes.push(parseDescriptorProto(msgBytes));
        } else {
          reader.skipField(wireType);
        }
        break;
      case 5: // enum_type
        if (wireType === 2) {
          const enumBytes = reader.readBytes();
          enumTypes.push(parseEnumDescriptorProto(enumBytes));
        } else {
          reader.skipField(wireType);
        }
        break;
      default:
        reader.skipField(wireType);
        break;
    }
  }

  return { name, packageName, messageTypes, enumTypes };
}

function parseDescriptorProto(bytes: Uint8Array): ParsedDescriptorProto {
  const reader = new ProtobufReader(bytes);
  let name = '';
  const fields: ParsedFieldDescriptorProto[] = [];
  const nestedTypes: ParsedDescriptorProto[] = [];
  const enumTypes: ParsedEnumDescriptorProto[] = [];

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1: // name
        if (wireType === 2) {
          name = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 2: // field
        if (wireType === 2) {
          const fieldBytes = reader.readBytes();
          fields.push(parseFieldDescriptorProto(fieldBytes));
        } else {
          reader.skipField(wireType);
        }
        break;
      case 3: // nested_type
        if (wireType === 2) {
          const nestedBytes = reader.readBytes();
          nestedTypes.push(parseDescriptorProto(nestedBytes));
        } else {
          reader.skipField(wireType);
        }
        break;
      case 4: // enum_type
        if (wireType === 2) {
          const enumBytes = reader.readBytes();
          enumTypes.push(parseEnumDescriptorProto(enumBytes));
        } else {
          reader.skipField(wireType);
        }
        break;
      default:
        reader.skipField(wireType);
        break;
    }
  }

  return { name, fields, nestedTypes, enumTypes };
}

function parseFieldDescriptorProto(bytes: Uint8Array): ParsedFieldDescriptorProto {
  const reader = new ProtobufReader(bytes);
  let name = '';
  let number = 0;
  let label = FieldLabel.LABEL_OPTIONAL;
  let type = FieldType.TYPE_STRING;
  let typeName: string | undefined;

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1: // name
        if (wireType === 2) {
          name = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 3: // number
        if (wireType === 0) {
          number = reader.readVarint();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 4: // label
        if (wireType === 0) {
          label = reader.readVarint() as FieldLabel;
        } else {
          reader.skipField(wireType);
        }
        break;
      case 5: // type
        if (wireType === 0) {
          type = reader.readVarint() as FieldType;
        } else {
          reader.skipField(wireType);
        }
        break;
      case 6: // type_name
        if (wireType === 2) {
          typeName = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      default:
        reader.skipField(wireType);
        break;
    }
  }

  return { name, number, label, type, typeName };
}

function parseEnumDescriptorProto(bytes: Uint8Array): ParsedEnumDescriptorProto {
  const reader = new ProtobufReader(bytes);
  let name = '';
  const values: ParsedEnumValueDescriptorProto[] = [];

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1: // name
        if (wireType === 2) {
          name = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 2: // value
        if (wireType === 2) {
          const valueBytes = reader.readBytes();
          values.push(parseEnumValueDescriptorProto(valueBytes));
        } else {
          reader.skipField(wireType);
        }
        break;
      default:
        reader.skipField(wireType);
        break;
    }
  }

  return { name, values };
}

function parseEnumValueDescriptorProto(bytes: Uint8Array): ParsedEnumValueDescriptorProto {
  const reader = new ProtobufReader(bytes);
  let name = '';
  let number = 0;

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    switch (fieldNumber) {
      case 1: // name
        if (wireType === 2) {
          name = reader.readString();
        } else {
          reader.skipField(wireType);
        }
        break;
      case 2: // number
        if (wireType === 0) {
          number = reader.readVarint();
        } else {
          reader.skipField(wireType);
        }
        break;
      default:
        reader.skipField(wireType);
        break;
    }
  }

  return { name, number };
}