export type Bytes = Uint8Array;

export type StructuralEditorInit = {
  schemaText: string;
  data: Bytes;
  typeName?: string | null;
  schemaName?: string;
  dataName?: string;
};

export type SaveCallback = (content: Bytes, suggestedName?: string) => Promise<void>;

export type StructuralViewerProps = {
  init?: StructuralEditorInit | null;
  onSave?: SaveCallback;
};

export type FilePickResult = { name: string; content: Bytes } | { name: string; text: string };

