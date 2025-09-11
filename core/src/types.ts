export type Bytes = Uint8Array;

export interface EditorData {
  data: Bytes;
  typeName?: string | null;
  schemaDescriptor?: Bytes;
}

// Events the editor can emit for the UI to listen to
export type EditorEventType = 'change' | 'error';

export interface EditorEvent {
  type: EditorEventType;
  payload?: any;
}

export type EventListener = (event: EditorEvent) => void;
