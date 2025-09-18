import * as vscode from "vscode";
import * as path from "path";
import { Config } from "@lintx/core";

const MAX_CONFIG_SEARCH_DEPTH = 10;

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
    outputChannel.appendLine(
      "[REGISTER] Registering custom editor provider for viewType: forma.structuralEditor"
    );
    const provider = new StructuralEditorProvider(context, outputChannel);
    return vscode.window.registerCustomEditorProvider(
      "forma.structuralEditor",
      provider,
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
    this._outputChannel.appendLine(
      `[OPEN] Opening custom document: ${uri.fsPath}`
    );
    let data: Uint8Array;
    try {
      data = await vscode.workspace.fs.readFile(uri);
      this._outputChannel.appendLine(
        `[OPEN] Successfully read ${data.length} bytes from ${uri.fsPath}`
      );
    } catch (e) {
      this._outputChannel.appendLine(
        `[ERROR] Could not read file: ${uri.fsPath}. ${e}`
      );
      data = new Uint8Array();
    }

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
      try {
        switch (msg.type) {
          case "ready": {
            this._outputChannel.appendLine(
              `[READY] Received ready message for ${document.uri.fsPath}`
            );
            const session = await resolveSessionFromConfig(
              document.uri,
              this._outputChannel,
              this._context
            );
            const initPayload = await prepareInitPayload(document, session);
            this._outputChannel.appendLine(
              `[INIT] Sending initWithConfig with typeName: ${
                initPayload.typeName
              }, schemaDescriptor: ${
                initPayload.schemaDescriptor
                  ? `${initPayload.schemaDescriptor.length} bytes`
                  : "none"
              }, data: ${
                initPayload.data ? `${initPayload.data.length} bytes` : "none"
              }`
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
      } catch (error) {
        this._outputChannel.appendLine(
          `[ERROR] Error handling message ${msg.type}: ${error}`
        );
        console.error("Extension error:", error);
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
  const outputChannel = vscode.window.createOutputChannel(
    "Forma Structural Editor"
  );
  outputChannel.appendLine("Forma extension is activating.");
  outputChannel.show(); // Show the output channel immediately
  context.subscriptions.push(outputChannel);

  try {
    const provider = StructuralEditorProvider.register(context, outputChannel);
    context.subscriptions.push(provider);

    // Register command handlers
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "forma.openStructuralEditor",
        async () => {
          outputChannel.appendLine(
            "[COMMAND] Opening structural editor command triggered"
          );
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: "Open with Structural Editor",
            filters: {
              "Binary Files": ["bin", "binpb", "binarypb"],
              "All Files": ["*"],
            },
          });
          if (uris && uris.length > 0) {
            const uri = uris[0];
            outputChannel.appendLine(`[COMMAND] Opening file: ${uri.fsPath}`);
            await vscode.commands.executeCommand(
              "vscode.openWith",
              uri,
              "forma.structuralEditor"
            );
          }
        }
      )
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("forma.openForActiveFile", async () => {
        outputChannel.appendLine(
          "[COMMAND] Open for active file command triggered"
        );
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          const uri = activeEditor.document.uri;
          outputChannel.appendLine(
            `[COMMAND] Opening active file: ${uri.fsPath}`
          );
          await vscode.commands.executeCommand(
            "vscode.openWith",
            uri,
            "forma.structuralEditor"
          );
        } else {
          vscode.window.showInformationMessage(
            "No active file to open with Structural Editor"
          );
        }
      })
    );

    outputChannel.appendLine("Forma extension activated successfully.");
  } catch (error) {
    outputChannel.appendLine(`Error during activation: ${error}`);
    throw error;
  }
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
  session: { typeName?: string; schemaDescriptor?: Uint8Array }
): Promise<any> {
  return {
    data: Array.from(document.documentData),
    typeName: session.typeName,
    dataName: path.basename(document.uri.fsPath),
    schemaDescriptor: session.schemaDescriptor
      ? Array.from(session.schemaDescriptor)
      : undefined,
  };
}

async function findNearestConfig(
  target: vscode.Uri,
  maxDepth: number,
  outputChannel: vscode.OutputChannel
): Promise<vscode.Uri | undefined> {
  if (target.scheme !== "file") {
    outputChannel.appendLine(
      `[CONFIG] Skipping config search for non-file URI: ${target.toString()}`
    );
    return undefined;
  }

  let currentDir = path.dirname(target.fsPath);
  const visited = new Set<string>();

  for (let depth = 0; depth <= maxDepth; depth++) {
    const normalizedDir = path.normalize(currentDir);
    if (visited.has(normalizedDir)) {
      break;
    }
    visited.add(normalizedDir);

    const candidatePath = path.join(currentDir, "config.forma.binpb");
    const candidateUri = vscode.Uri.file(candidatePath);
    try {
      const stat = await vscode.workspace.fs.stat(candidateUri);
      if (stat.type === vscode.FileType.File) {
        outputChannel.appendLine(
          `[CONFIG] Found config at depth ${depth}: ${candidateUri.fsPath}`
        );
        return candidateUri;
      }
    } catch (error) {
      // Ignore missing files and continue walking up the tree.
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  outputChannel.appendLine(
    `[CONFIG] No config.forma.binpb found within ${maxDepth} directories of ${target.fsPath}`
  );
  return undefined;
}

async function resolveSessionFromConfig(
  target: vscode.Uri,
  outputChannel: vscode.OutputChannel,
  context: vscode.ExtensionContext
): Promise<{ typeName?: string; schemaDescriptor?: Uint8Array }> {
  outputChannel.appendLine(`[CONFIG] Resolving session for: ${target.fsPath}`);

  // If the target file is exactly "config.forma.binpb", use the built-in schema
  if (path.basename(target.fsPath) === "config.forma.binpb") {
    outputChannel.appendLine(
      `[CONFIG] Target is config.forma.binpb, using built-in schema`
    );
    try {
      const schemaPath = vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "schemas",
        "config.desc"
      );
      const schemaDescriptor = await vscode.workspace.fs.readFile(schemaPath);
      outputChannel.appendLine(
        `[CONFIG] Loaded built-in schema descriptor: ${schemaPath.fsPath}`
      );
      return {
        typeName: ".forma.config.Config",
        schemaDescriptor,
      };
    } catch (e) {
      outputChannel.appendLine(`[CONFIG] Error loading built-in schema: ${e}`);
    }
  }

  const configUri = await findNearestConfig(
    target,
    MAX_CONFIG_SEARCH_DEPTH,
    outputChannel
  );

  if (configUri) {
    try {
      const configBytes = await vscode.workspace.fs.readFile(configUri);
      outputChannel.appendLine(
        `[CONFIG] Loaded config file: ${configUri.fsPath}`
      );

      const decodedConfig = Config.decode(configBytes);
      outputChannel.appendLine(
        `[CONFIG] Decoded config: ${JSON.stringify(decodedConfig, null, 2)}`
      );

      const configDir = path.dirname(configUri.fsPath);
      const targetPath = path.normalize(target.fsPath);

      for (const mapping of decodedConfig.files) {
        const mappingDataRelative = mapping.data || "";
        const mappingDataPath = path.normalize(
          path.isAbsolute(mappingDataRelative)
            ? mappingDataRelative
            : path.join(configDir, mappingDataRelative)
        );

        if (mappingDataPath === targetPath) {
          outputChannel.appendLine(
            `[CONFIG] Found mapping for: ${target.fsPath}`
          );

          let schemaDescriptor: Uint8Array | undefined;
          if (mapping.schemaDescriptor) {
            const schemaPath = path.isAbsolute(mapping.schemaDescriptor)
              ? mapping.schemaDescriptor
              : path.join(configDir, mapping.schemaDescriptor);
            try {
              schemaDescriptor = await vscode.workspace.fs.readFile(
                vscode.Uri.file(schemaPath)
              );
              outputChannel.appendLine(
                `[CONFIG] Loaded schema descriptor: ${schemaPath}`
              );
            } catch (e) {
              outputChannel.appendLine(
                `[CONFIG] Error loading schema descriptor: ${e}`
              );
            }
          }

          return {
            typeName: mapping.type || undefined,
            schemaDescriptor,
          };
        }
      }
    } catch (e) {
      outputChannel.appendLine(
        `[CONFIG] Error reading or parsing config file: ${e}`
      );
    }
  }

  outputChannel.appendLine(
    `[CONFIG] No configuration found. User will need to select type manually.`
  );
  return {};
}
