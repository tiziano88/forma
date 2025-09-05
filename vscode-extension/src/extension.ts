import * as vscode from "vscode";
import * as path from "path";

// The CustomDocument model that holds the binary data for a file.
class StructuralDocument implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _documentData: Uint8Array;

  // An event emitter that fires when the document's content changes.
  private readonly _onDidChangeContent = new vscode.EventEmitter<void>();
  public readonly onDidChangeContent = this._onDidChangeContent.event;

  // An event emitter that fires for VS Code's internal dirty tracking.
  private readonly _onDidChange = new vscode.EventEmitter<{
    readonly label: string;
    undo(): void;
    redo(): void;
  }>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(uri: vscode.Uri, initialContent: Uint8Array) {
    this._uri = uri;
    this._documentData = initialContent;
  }

  public get uri() { return this._uri; }
  public get documentData(): Uint8Array { return this._documentData; }

  // This is called by the provider when the webview sends updated content.
  public makeEdit(newContent: Uint8Array) {
    const oldContent = this._documentData;
    this._documentData = newContent;

    // Fire the event that tells VS Code the file is dirty.
    this._onDidChange.fire({
      label: "Update",
      undo: () => { this.makeEdit(oldContent); },
      redo: () => { this.makeEdit(newContent); },
    });
  }

  // This is called by the provider when VS Code reverts the file.
  public revert(newContent: Uint8Array) {
    this._documentData = newContent;
    // Fire the event that tells the webview to update itself.
    this._onDidChangeContent.fire();
  }

  dispose(): void {
    this._onDidChange.dispose();
    this._onDidChangeContent.dispose();
  }
}

// The provider, which acts as the controller connecting the document model and the webview.
class StructuralEditorProvider implements vscode.CustomEditorProvider<StructuralDocument> {
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new StructuralEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      "lintx.structuralEditor",
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public readonly onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<StructuralDocument>>().event;

  async openCustomDocument(uri: vscode.Uri): Promise<StructuralDocument> {
    const data = await vscode.workspace.fs.readFile(uri).then(res => res, () => new Uint8Array());
    return new StructuralDocument(uri, data);
  }

  async resolveCustomEditor(document: StructuralDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, "media")],
    };
    webviewPanel.webview.html = await getWebviewHtml(webviewPanel.webview, this._context);

    // Listener for when the document's content is changed by an external action (like revert).
    const changeSubscription = document.onDidChangeContent(() => {
      webviewPanel.webview.postMessage({
        type: "updateContent",
        payload: Array.from(document.documentData),
      });
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });

    // Handle messages from the webview.
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready": {
          const session = await resolveSessionFromConfig(document.uri);
          const initPayload = await prepareInitPayload(document, session);
          webviewPanel.webview.postMessage({
            type: "initWithConfig",
            payload: initPayload,
          });
          break;
        }
        case "contentChanged": {
          document.makeEdit(new Uint8Array(msg.payload));
          break;
        }
      }
    });
  }

  async saveCustomDocument(doc: StructuralDocument, cancel: vscode.CancellationToken): Promise<void> {
    await this.saveCustomDocumentAs(doc, doc.uri, cancel);
  }

  async saveCustomDocumentAs(doc: StructuralDocument, dest: vscode.Uri, cancel: vscode.CancellationToken): Promise<void> {
    if (cancel.isCancellationRequested) {
      return;
    }
    await vscode.workspace.fs.writeFile(dest, doc.documentData);
  }

  async revertCustomDocument(doc: StructuralDocument, cancel: vscode.CancellationToken): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(doc.uri);
    doc.revert(fileData);
  }

  async backupCustomDocument(doc: StructuralDocument, ctx: vscode.CustomDocumentBackupContext, cancel: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
    await this.saveCustomDocumentAs(doc, ctx.destination, cancel);
    return { id: ctx.destination.toString(), delete: async () => {} };
  }
}

// --- Activate Function ---
export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("lintx");
  outputChannel.appendLine("xxxyyyzzz: Lintx extension is activating.");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(StructuralEditorProvider.register(context));
}

// --- Helper Functions ---
async function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext): Promise<string> {
  const mediaRoot = vscode.Uri.joinPath(context.extensionUri, "media");
  const assetsRoot = vscode.Uri.joinPath(mediaRoot, "assets");
  const files = await vscode.workspace.fs.readDirectory(assetsRoot);
  const cssFile = files.find(([name]) => name.endsWith(".css"))?.[0];
  const jsFile = files.find(([name]) => name.endsWith(".js"))?.[0];

  if (!cssFile || !jsFile) {
    return "<body>Error: Could not find built webview assets.</body>";
  }

  const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsRoot, cssFile));
  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsRoot, jsFile));
  const cspSource = webview.cspSource;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Structural Editor</title>
        <meta http-equiv="Content-Security-Policy" content="
          default-src 'none';
          style-src ${cspSource};
          script-src ${cspSource} 'unsafe-eval';
          img-src ${cspSource} blob: data:;
          font-src ${cspSource};
        ">
        <link rel="stylesheet" crossorigin href="${cssUri}">
      </head>
      <body>
        <div id="app"></div>
        <script type="module" crossorigin src="${jsUri}"></script>
      </body>
    </html>
  `;
}

async function prepareInitPayload(document: StructuralDocument, session: { schemaUri?: vscode.Uri; typeName?: string }): Promise<any> {
  let schemaText = "";
  let schemaName: string | undefined;
  if (session.schemaUri) {
    const bytes = await vscode.workspace.fs.readFile(session.schemaUri);
    schemaText = Buffer.from(bytes).toString("utf-8");
    schemaName = path.basename(session.schemaUri.fsPath);
  }
  return {
    schema: schemaText,
    data: Array.from(document.documentData),
    typeName: session.typeName,
    dataName: path.basename(document.uri.fsPath),
    schemaName,
  };
}

async function resolveSessionFromConfig(target: vscode.Uri): Promise<{ schemaUri?: vscode.Uri; typeName?: string }> {
  // This is a placeholder for the logic that finds a matching .proto file.
  // For now, it just returns an empty session.
  return {};
}
