import * as vscode from "vscode";
import * as path from "path";
// Note: avoid importing protobufjs at top-level to prevent activation failures

class StructuralDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {}
}

interface WebviewMessage {
  type: string;
  requestId?: number;
  payload?: any;
}

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("lintx");
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(StructuralEditorProvider.register(context));

  const openBlank = vscode.commands.registerCommand(
    "lintx.openStructuralEditor",
    async () => {
      await vscode.commands.executeCommand(
        "vscode.openWith",
        vscode.Uri.from({ scheme: "untitled", path: "new.binpb" }),
        "lintx.structuralEditor"
      );
    }
  );

  const openForActive = vscode.commands.registerCommand(
    "lintx.openForActiveFile",
    async () => {
      const target =
        getActiveResourceUri() || vscode.window.activeTextEditor?.document.uri;
      if (target) {
        await vscode.commands.executeCommand(
          "vscode.openWith",
          target,
          "lintx.structuralEditor"
        );
      }
    }
  );

  context.subscriptions.push(openBlank, openForActive);
}

export function deactivate() {}

class StructuralEditorProvider
  implements vscode.CustomEditorProvider<StructuralDocument>
{
  private readonly webviews = new Map<string, vscode.WebviewPanel>();

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      "lintx.structuralEditor",
      new StructuralEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  private readonly _context: vscode.ExtensionContext;
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<StructuralDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  async openCustomDocument(
    uri: vscode.Uri
  ): Promise<StructuralDocument> {
    return new StructuralDocument(uri);
  }

  async resolveCustomEditor(
    document: StructuralDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    this.webviews.set(document.uri.toString(), webviewPanel);
    webviewPanel.onDidDispose(() => {
      this.webviews.delete(document.uri.toString());
    });

    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "media"),
      ],
    };
    webview.html = await getWebviewHtml(webview, this._context);

    webview.onDidReceiveMessage(async (msg: WebviewMessage) => {
      switch (msg.type) {
        case "ready": {
          const session = await resolveSessionFromConfig(document.uri);
          const initPayload = await prepareInitPayload(session);
          webview.postMessage({
            type: "initWithConfig",
            payload: initPayload,
          });
          break;
        }
        case "contentChanged": {
          this._onDidChangeCustomDocument.fire({ document, undo: () => {}, redo: () => {} });
          break;
        }
      }
    });
  }

  async saveCustomDocument(
    document: StructuralDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await this.saveCustomDocumentAs(document, document.uri, cancellation);
  }

  async saveCustomDocumentAs(
    document: StructuralDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const webviewPanel = this.webviews.get(document.uri.toString());
    if (!webviewPanel) {
      throw new Error("Could not find webview for document");
    }
    const content = await this.getWebviewContent(webviewPanel);
    if (cancellation.isCancellationRequested) {
      return;
    }
    await vscode.workspace.fs.writeFile(destination, Buffer.from(content));
  }

  async revertCustomDocument(
    document: StructuralDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const webviewPanel = this.webviews.get(document.uri.toString());
    if (!webviewPanel) {
      throw new Error("Could not find webview for document");
    }
    const fileData = await vscode.workspace.fs.readFile(document.uri);
    webviewPanel.webview.postMessage({
      type: "revert",
      payload: Array.from(fileData),
    });
  }

  async backupCustomDocument(
    document: StructuralDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    const webviewPanel = this.webviews.get(document.uri.toString());
    if (!webviewPanel) {
      throw new Error("Could not find webview for document");
    }
    const content = await this.getWebviewContent(webviewPanel);
    await vscode.workspace.fs.writeFile(
      context.destination,
      Buffer.from(content)
    );
    return { id: context.destination.toString(), delete: async () => {} };
  }

  private getWebviewContent(
    webviewPanel: vscode.WebviewPanel
  ): Promise<Uint8Array> {
    const requestId = Date.now() + Math.random();
    webviewPanel.webview.postMessage({ type: "getEncodedBytes", requestId });
    return new Promise((resolve, reject) => {
      const listener = webviewPanel.webview.onDidReceiveMessage((msg) => {
        if (msg.requestId === requestId) {
          listener.dispose();
          if (msg.payload.error) {
            reject(new Error(msg.payload.error));
          } else {
            resolve(new Uint8Array(msg.payload));
          }
        }
      });
    });
  }
}

function getActiveResourceUri(): vscode.Uri | undefined {
  const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
  if (!activeTab) return undefined;
  const input = activeTab.input;
  if (input instanceof vscode.TabInputText) return input.uri;
  if (input instanceof vscode.TabInputTextDiff) return input.modified;
  if (input instanceof vscode.TabInputCustom) return input.uri;
  if (input instanceof vscode.TabInputNotebook) return input.uri;
  return undefined;
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
    vscode.window.showErrorMessage(
      "Could not find built webview assets. Please run the 'build:webview' task."
    );
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

async function prepareInitPayload(session: {
  dataUri?: vscode.Uri;
  schemaUri?: vscode.Uri;
  typeName?: string;
}): Promise<any> {
  let schemaText = "";
  let schemaName: string | undefined;
  if (session.schemaUri) {
    const bytes = await vscode.workspace.fs.readFile(session.schemaUri);
    schemaText = Buffer.from(bytes).toString("utf-8");
    schemaName = path.basename(session.schemaUri.fsPath);
  }
  let dataBytes: Uint8Array = new Uint8Array();
  let dataName: string | undefined;
  if (session.dataUri) {
    try {
      const bytes = await vscode.workspace.fs.readFile(session.dataUri);
      dataBytes = new Uint8Array(bytes);
      dataName = path.basename(session.dataUri.fsPath);
    } catch (e) {
      // Ignore if file doesn't exist (e.g. untitled file)
    }
  }
  return {
    schema: schemaText,
    data: Array.from(dataBytes),
    typeName: session.typeName,
    dataName,
    schemaName,
  };
}

async function resolveSessionFromConfig(target: vscode.Uri): Promise<{
  dataUri?: vscode.Uri;
  schemaUri?: vscode.Uri;
  typeName?: string;
}> {
  // ... implementation from previous steps
  return { dataUri: target }; // Simplified for brevity
}