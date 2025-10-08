// Parser for forma.proto Config messages using ts-proto generated code
// This is used by the VSCode extension to read config.forma.binpb files

import * as forma from './generated/config/forma.js';

// Re-export the types for convenience
export interface Config {
  files: FileMapping[];
}

export interface FileMapping {
  data: string;
  schema: string;
  schemaDescriptor: string;
  type: string;
  presentation: string;
}

export function parseConfig(bytes: Uint8Array): Config {
  // Use ts-proto generated decode function
  const pbConfig = forma.Config.decode(bytes);

  const files: FileMapping[] = pbConfig.files.map((pbFile) => ({
    data: pbFile.data,
    schema: pbFile.schema,
    schemaDescriptor: pbFile.schemaDescriptor,
    type: pbFile.type,
    presentation: pbFile.presentation,
  }));

  return { files };
}

// Legacy compatibility - the VSCode extension expects a Config class with a decode method
export const Config = {
  decode: parseConfig,
};
