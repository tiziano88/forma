import * as vscode from "vscode";
import * as path from "path";

class StructuralDocument implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _documentData: Uint8Array;
  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChangeContent = new vscode.EventEmitter<void>();
  public readonly onDidChangeContent = this._onDidChangeContent.event;

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

  public get uri() {
    return this._uri;
  }
  public get documentData(): Uint8Array {
    return this._documentData;
  }

  public makeEdit(newContent: Uint8Array) {
    const oldContent = this._documentData;
    this._documentData = newContent;

    this._onDidChange.fire({
      label: "Update",
      undo: () => {
        this.revert(oldContent);
      },
      redo: () => {
        this.makeEdit(newContent);
      },
    });
  }

  public revert(newContent: Uint8Array) {
    this._documentData = newContent;
    this._onDidChangeContent.fire();
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidChange.dispose();
    this._onDidChangeContent.dispose();
  }
}

class StructuralEditorProvider
  implements vscode.CustomEditorProvider<StructuralDocument>
{
  public static register(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
  ): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      "forma.structuralEditor",
      new StructuralEditorProvider(context, outputChannel),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<StructuralDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  constructor(
    private readonly _context: vscode.ExtensionContext,
    private readonly _outputChannel: vscode.OutputChannel
  ) {}

  async openCustomDocument(uri: vscode.Uri): Promise<StructuralDocument> {
    const data = await vscode.workspace.fs.readFile(uri).then(
      (res) => res,
      () => new Uint8Array()
    );
    const document = new StructuralDocument(uri, data);

    const listener = document.onDidChange((e) => {
      this._onDidChangeCustomDocument.fire({ document, ...e });
    });
    document.onDidDispose(() => listener.dispose());

    return document;
  }

  async resolveCustomEditor(
    document: StructuralDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "media"),
      ],
    };
    webviewPanel.webview.html = await getWebviewHtml(
      webviewPanel.webview,
      this._context
    );

    const changeSubscription = document.onDidChangeContent(() => {
      webviewPanel.webview.postMessage({
        type: "updateContent",
        payload: Array.from(document.documentData),
      });
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "ready": {
          const session = await resolveSessionFromConfig(
            document.uri,
            this._outputChannel,
            this._context
          );
          const initPayload = await prepareInitPayload(document, session);
          this._outputChannel.appendLine(
            `[INIT] Sending initWithConfig with data size: ${initPayload.data.length}`
          );
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

  async saveCustomDocument(
    doc: StructuralDocument,
    cancel: vscode.CancellationToken
  ): Promise<void> {
    this._outputChannel.appendLine(
      `[SAVE] Triggered for: ${doc.uri.toString()}`
    );
    await this.saveCustomDocumentAs(doc, doc.uri, cancel);
  }

  async saveCustomDocumentAs(
    doc: StructuralDocument,
    dest: vscode.Uri,
    cancel: vscode.CancellationToken
  ): Promise<void> {
    if (cancel.isCancellationRequested) {
      return;
    }
    await vscode.workspace.fs.writeFile(dest, doc.documentData);
  }

  async revertCustomDocument(
    doc: StructuralDocument,
    cancel: vscode.CancellationToken
  ): Promise<void> {
    const fileData = await vscode.workspace.fs.readFile(doc.uri);
    doc.revert(fileData);
  }

  async backupCustomDocument(
    doc: StructuralDocument,
    ctx: vscode.CustomDocumentBackupContext,
    cancel: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await this.saveCustomDocumentAs(doc, ctx.destination, cancel);
    return { id: ctx.destination.toString(), delete: async () => {} };
  }
}

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Forma");
  outputChannel.appendLine("Forma extension is activating.");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    StructuralEditorProvider.register(context, outputChannel)
  );
}

async function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): Promise<string> {
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

async function prepareInitPayload(
  document: StructuralDocument,
  session: { schemaUri?: vscode.Uri; typeName?: string }
): Promise<any> {
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

async function resolveSessionFromConfig(
  target: vscode.Uri,
  outputChannel: vscode.OutputChannel,
  context: vscode.ExtensionContext
): Promise<{ schemaUri?: vscode.Uri; typeName?: string }> {
  outputChannel.appendLine(`[CONFIG] Resolving session for: ${target.fsPath}`);
  const baseName = path.basename(target.fsPath);

  // Special case: if the file is named config.forma.binpb, use the bundled schema.
  if (baseName === "config.forma.binpb") {
    outputChannel.appendLine("[CONFIG] Matched special config file. Using bundled schema.");
    return {
      schemaUri: vscode.Uri.joinPath(context.extensionUri, "media", "schemas", "config.proto"),
      typeName: "forma.config.Config",
    };
  }

  // Best-effort: look for a .proto file with the same base name next to the data file.
  const dir = vscode.Uri.joinPath(target, "..");
  const protoFileName = `${path.basename(target.fsPath, path.extname(target.fsPath))}.proto`;
  const protoUri = vscode.Uri.joinPath(dir, protoFileName);

  try {
    await vscode.workspace.fs.stat(protoUri);
    outputChannel.appendLine(
      `[CONFIG] Found matching schema: ${protoUri.fsPath}`
    );
    return { schemaUri: protoUri };
  } catch {
    outputChannel.appendLine(
      `[CONFIG] No matching schema found at: ${protoUri.fsPath}`
    );
  }

  outputChannel.appendLine(
    `[CONFIG] No configuration found. User will need to load schema manually.`
  );
  return {};
}
