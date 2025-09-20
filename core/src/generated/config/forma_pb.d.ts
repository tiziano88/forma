// package: forma.config
// file: config/forma.proto

import * as jspb from 'google-protobuf';

export class FileMapping extends jspb.Message {
  getData(): string;
  setData(value: string): void;

  getSchema(): string;
  setSchema(value: string): void;

  getSchemaDescriptor(): string;
  setSchemaDescriptor(value: string): void;

  getType(): string;
  setType(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): FileMapping.AsObject;
  static toObject(
    includeInstance: boolean,
    msg: FileMapping
  ): FileMapping.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: FileMapping,
    writer: jspb.BinaryWriter
  ): void;
  static deserializeBinary(bytes: Uint8Array): FileMapping;
  static deserializeBinaryFromReader(
    message: FileMapping,
    reader: jspb.BinaryReader
  ): FileMapping;
}

export namespace FileMapping {
  export type AsObject = {
    data: string;
    schema: string;
    schemaDescriptor: string;
    type: string;
  };
}

export class Config extends jspb.Message {
  clearFilesList(): void;
  getFilesList(): Array<FileMapping>;
  setFilesList(value: Array<FileMapping>): void;
  addFiles(value?: FileMapping, index?: number): FileMapping;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Config.AsObject;
  static toObject(includeInstance: boolean, msg: Config): Config.AsObject;
  static extensions: { [key: number]: jspb.ExtensionFieldInfo<jspb.Message> };
  static extensionsBinary: {
    [key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>;
  };
  static serializeBinaryToWriter(
    message: Config,
    writer: jspb.BinaryWriter
  ): void;
  static deserializeBinary(bytes: Uint8Array): Config;
  static deserializeBinaryFromReader(
    message: Config,
    reader: jspb.BinaryReader
  ): Config;
}

export namespace Config {
  export type AsObject = {
    filesList: Array<FileMapping.AsObject>;
  };
}
