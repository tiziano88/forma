// Simple parser for forma.proto Config messages
// This is used by the VSCode extension to read config.forma.binpb files

export interface Config {
  files: FileMapping[]
}

export interface FileMapping {
  data: string
  schema: string
  schemaDescriptor: string
  type: string
}

// Simple protobuf wire format parser for Config messages
class ProtobufReader {
  private position: number = 0

  constructor(private buffer: Uint8Array) {}

  hasMore(): boolean {
    return this.position < this.buffer.length
  }

  readVarint(): number {
    let result = 0
    let shift = 0

    while (true) {
      if (this.position >= this.buffer.length) {
        throw new Error('Unexpected end of buffer')
      }

      const byte = this.buffer[this.position++]
      result |= (byte & 0x7f) << shift

      if ((byte & 0x80) === 0) {
        break
      }

      shift += 7
      if (shift >= 32) {
        throw new Error('Varint too long')
      }
    }

    return result >>> 0
  }

  readString(): string {
    const length = this.readVarint()
    if (this.position + length > this.buffer.length) {
      throw new Error('String length exceeds buffer')
    }

    const bytes = this.buffer.slice(this.position, this.position + length)
    this.position += length

    return new TextDecoder().decode(bytes)
  }

  readBytes(): Uint8Array {
    const length = this.readVarint()
    if (this.position + length > this.buffer.length) {
      throw new Error('Bytes length exceeds buffer')
    }

    const bytes = this.buffer.slice(this.position, this.position + length)
    this.position += length

    return bytes
  }

  skipField(wireType: number): void {
    switch (wireType) {
      case 0: // Varint
        this.readVarint()
        break
      case 1: // Fixed64
        this.position += 8
        break
      case 2: // Length-delimited
        const length = this.readVarint()
        this.position += length
        break
      case 5: // Fixed32
        this.position += 4
        break
      default:
        throw new Error(`Unknown wire type: ${wireType}`)
    }
  }
}

export function parseConfig(bytes: Uint8Array): Config {
  const reader = new ProtobufReader(bytes)
  const files: FileMapping[] = []

  while (reader.hasMore()) {
    const tag = reader.readVarint()
    const fieldNumber = tag >>> 3
    const wireType = tag & 0x7

    if (fieldNumber === 1 && wireType === 2) {
      // FileMapping
      const fileMappingBytes = reader.readBytes()
      files.push(parseFileMapping(fileMappingBytes))
    } else {
      reader.skipField(wireType)
    }
  }

  return { files }
}

function parseFileMapping(bytes: Uint8Array): FileMapping {
  const reader = new ProtobufReader(bytes)
  let data = ''
  let schema = ''
  let schemaDescriptor = ''
  let type = ''

  while (reader.hasMore()) {
    const tag = reader.readVarint()
    const fieldNumber = tag >>> 3
    const wireType = tag & 0x7

    switch (fieldNumber) {
      case 1: // data
        if (wireType === 2) {
          data = reader.readString()
        } else {
          reader.skipField(wireType)
        }
        break
      case 2: // schema
        if (wireType === 2) {
          schema = reader.readString()
        } else {
          reader.skipField(wireType)
        }
        break
      case 3: // type
        if (wireType === 2) {
          type = reader.readString()
        } else {
          reader.skipField(wireType)
        }
        break
      case 4: // schemaDescriptor
        if (wireType === 2) {
          schemaDescriptor = reader.readString()
        } else {
          reader.skipField(wireType)
        }
        break
      default:
        reader.skipField(wireType)
        break
    }
  }

  return { data, schema, schemaDescriptor, type }
}

// Legacy compatibility - the VSCode extension expects a Config class with a decode method
export const Config = {
  decode: parseConfig,
}
