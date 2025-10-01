// Parser for forma.proto Config messages using generated protobuf code
// This is used by the VSCode extension to read config.forma.binpb files

import type * as FormaPb from './generated/config/forma_pb.js';

// Lazy-load the protobuf module to avoid browser compatibility issues
let forma_pb: typeof FormaPb | null = null;

function loadFormaPb(): typeof FormaPb {
  if (forma_pb) return forma_pb;

  // Use dynamic require for CommonJS interop (Node.js only)
  if (typeof require === 'undefined') {
    throw new Error('forma-parser can only be used in Node.js environment');
  }

  // @ts-ignore - accessing global require
  forma_pb = require('./generated/config/forma_pb.js') as typeof FormaPb;
  return forma_pb;
}

// Re-export the types for convenience
export interface Config {
  files: FileMapping[];
}

export interface FileMapping {
  data: string;
  schema: string;
  schemaDescriptor: string;
  type: string;
}

export function parseConfig(bytes: Uint8Array): Config {
  // Load the protobuf module (Node.js only)
  const pb = loadFormaPb();

  // Access the protobuf classes from the generated module
  const pbConfig = pb.Config.deserializeBinary(bytes);
  const pbFiles = pbConfig.getFilesList();

  const files: FileMapping[] = pbFiles.map((pbFile) => ({
    data: pbFile.getData(),
    schema: pbFile.getSchema(),
    schemaDescriptor: pbFile.getSchemaDescriptor(),
    type: pbFile.getType(),
  }));

  return { files };
}

// Legacy compatibility - the VSCode extension expects a Config class with a decode method
export const Config = {
  decode: parseConfig,
};
