// Manually defined interfaces to avoid protobuf.js import issues.
// Based on the structure of google.protobuf.DescriptorProto and related types.

export interface IFieldDescriptorProto {
  name?: string | null;
  number?: number | null;
  label?: number | null;
  type?: number | null;
  typeName?: string | null;
  defaultValue?: string | null;
  oneofIndex?: number | null;
  jsonName?: string | null;
  options?: any | null;
  proto3Optional?: boolean | null;
}

export interface IDescriptorProto {
  name?: string | null;
  field?: IFieldDescriptorProto[] | null;
  nestedType?: IDescriptorProto[] | null;
  enumType?: any[] | null;
  extensionRange?: any[] | null;
  extension?: any[] | null;
  oneofDecl?: any[] | null;
  options?: any | null;
  reservedRange?: any[] | null;
  reservedName?: string[] | null;
}

export interface IFileDescriptorProto {
  name?: string | null;
  package?: string | null;
  dependency?: string[] | null;
  publicDependency?: number[] | null;
  weakDependency?: number[] | null;
  messageType?: IDescriptorProto[] | null;
  enumType?: any[] | null;
  service?: any[] | null;
  extension?: any[] | null;
  options?: any | null;
  sourceCodeInfo?: any | null;
  syntax?: string | null;
}

export interface IFileDescriptorSet {
  file: IFileDescriptorProto[];
}