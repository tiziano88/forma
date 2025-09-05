import * as vscode from "vscode";
import * as path from "path";
// Note: avoid importing protobufjs at top-level to prevent activation failures

// Webview message types
interface WebviewMessage {
  type: string;
  requestId: number;
  payload?: any;
}

interface ReadyMessage extends WebviewMessage {
  type: "ready";
  payload?: undefined;
}

interface PickFileMessage extends WebviewMessage {
  type: "pickFile";
  payload: { kind: "schema" | "data" };
}

interface GetSampleMessage extends WebviewMessage {
  type: "getSample";
  payload?: undefined;
}

interface SaveDataMessage extends WebviewMessage {
  type: "saveData";
  payload: { content: number[]; name?: string };
}

type IncomingMessage =
  | ReadyMessage
  | PickFileMessage
  | GetSampleMessage
  | SaveDataMessage;

type PanelSession = {
  dataUri?: vscode.Uri;
  schemaUri?: vscode.Uri;
  typeName?: string;
  pendingInit?: {
    schema: string;
    data: number[];
    typeName?: string;
    dataName?: string;
    schemaName?: string;
  } | null;
};

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("lintx");
  context.subscriptions.push(outputChannel);

  // Register the custom editor provider
  context.subscriptions.push(StructuralEditorProvider.register(context));

  // Register the standalone commands
  const openBlank = vscode.commands.registerCommand(
    "lintx.openStructuralEditor",
    async () => {
      // This command just opens a blank editor, which is handled by the custom editor
      // provider when it receives an empty document. We can trigger this by
      // opening an untitled file with our view type.
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
      let target: vscode.Uri | undefined =
        getActiveResourceUri() || vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
        });
        if (!picked || !picked[0]) return;
        target = picked[0];
      }
      await vscode.commands.executeCommand(
        "vscode.openWith",
        target,
        "lintx.structuralEditor"
      );
    }
  );

  context.subscriptions.push(openBlank, openForActive);
}

export function deactivate() {}

class StructuralEditorProvider implements vscode.CustomReadonlyEditorProvider {
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

  private readonly _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    outputChannel.appendLine(`[startup] Opening file: ${document.uri.fsPath}`);
    const session = await resolveSessionFromConfig(document.uri);
    outputChannel.appendLine(
      `[startup] Schema found: ${session.schemaUri?.fsPath || "none"}`
    );
    outputChannel.appendLine(
      `[startup] Message type: ${session.typeName || "auto-detect"}`
    );

    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "media"),
      ],
    };
    webview.html = await getWebviewHtml(webview, this._context);

    const sessionState: PanelSession = {
      dataUri: session.dataUri ?? document.uri,
      schemaUri: session.schemaUri,
      typeName: session.typeName,
      pendingInit: null,
    };

    const disposables: vscode.Disposable[] = [];
    webview.onDidReceiveMessage(
      async (msg: IncomingMessage) => {
        const { type, requestId, payload } = msg || {};
        try {
          if (type === "ready") {
            const initPayload = await prepareInitPayload(
              this._context,
              sessionState
            );
            sessionState.pendingInit = initPayload;
            webview.postMessage({
              type: "initWithConfig",
              requestId: 0,
              payload: initPayload,
            });
            sessionState.pendingInit = null;
            return;
          }
          if (type === "pickFile") {
            const isSchema = payload?.kind === "schema";
            const filters: { [name: string]: string[] } = isSchema
              ? { "Protobuf Schema": ["proto"] }
              : { "Binary Data": ["bin", "binpb"] };
            const chosen = await vscode.window.showOpenDialog({
              canSelectMany: false,
              filters,
            });
            if (!chosen || !chosen[0]) {
              webview.postMessage({
                type,
                requestId,
                payload: { name: "", content: [] },
              });
              return;
            }
            const uri = chosen[0];
            const data = await vscode.workspace.fs.readFile(uri);
            if (isSchema) sessionState.schemaUri = uri;
            else sessionState.dataUri = uri;
            webview.postMessage({
              type,
              requestId,
              payload: {
                name: path.basename(uri.fsPath),
                content: Array.from(data),
              },
            });
            return;
          }
          if (type === "getSample") {
            const protoUri = vscode.Uri.joinPath(
              this._context.extensionUri,
              "media",
              "sample.proto"
            );
            const binUri = vscode.Uri.joinPath(
              this._context.extensionUri,
              "media",
              "sample.binpb"
            );
            const schemaBytes = await vscode.workspace.fs.readFile(protoUri);
            const dataBytes = await vscode.workspace.fs.readFile(binUri);
            webview.postMessage({
              type,
              requestId,
              payload: {
                schema: Buffer.from(schemaBytes).toString("utf-8"),
                data: Array.from(dataBytes),
              },
            });
            return;
          }
          if (type === "saveData") {
            const content: number[] = payload?.content || [];
            const target = sessionState.dataUri ?? document.uri;
            await vscode.workspace.fs.writeFile(
              target,
              Buffer.from(new Uint8Array(content))
            );
            webview.postMessage({ type, requestId, payload: true });
            return;
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(err?.message || String(err));
          webview.postMessage({
            type,
            requestId,
            payload: { error: err?.message || String(err) },
          });
        }
      },
      undefined,
      disposables
    );

    webviewPanel.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
    });
  }
}

function getActiveResourceUri(): vscode.Uri | undefined {
  const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
  if (!activeTab) return undefined;
  const input = activeTab.input;
  // Text editors
  if (input instanceof vscode.TabInputText) return input.uri;
  if (input instanceof vscode.TabInputTextDiff) return input.modified;
  // Custom editors (e.g., binary viewers)
  if (input instanceof vscode.TabInputCustom) return input.uri;
  // Notebooks (rare for our case)
  if (input instanceof vscode.TabInputNotebook) return input.uri;
  return undefined;
}

async function getWebviewHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): Promise<string> {
  // In production, we'll load the pre-built Svelte app from the media directory.
  // This is created by the `pnpm run build:webview` script.
  const mediaRoot = vscode.Uri.joinPath(context.extensionUri, "media");
  const assetsRoot = vscode.Uri.joinPath(mediaRoot, "assets");

  // Find the actual CSS and JS files in the 'assets' directory.
  // Vite generates filenames with hashes, so we can't hardcode them.
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
          script-src ${cspSource};
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
  _context: vscode.ExtensionContext,
  session: PanelSession
) {
  let schemaText = "";
  let schemaName: string | undefined;
  if (!session.schemaUri) {
    // best-effort: look for a .proto next to dataUri
    if (session.dataUri) {
      const dir = vscode.Uri.joinPath(session.dataUri, "..");
      const entries = await vscode.workspace.fs.readDirectory(dir);
      const protos = entries
        .filter(
          ([name, type]: [string, vscode.FileType]) =>
            type === vscode.FileType.File &&
            name.toLowerCase().endsWith(".proto")
        )
        .map(([name]: [string, vscode.FileType]) => name);
      let chosen: string | undefined;
      if (protos.length === 1) chosen = protos[0];
      else if (protos.length > 1) {
        const base = path.basename(
          session.dataUri.fsPath,
          path.extname(session.dataUri.fsPath)
        );
        chosen =
          protos.find((p) => path.basename(p, ".proto") === base) || protos[0];
      }
      if (chosen) session.schemaUri = vscode.Uri.joinPath(dir, chosen);
    }
  }
  if (session.schemaUri) {
    const bytes = await vscode.workspace.fs.readFile(session.schemaUri);
    schemaText = Buffer.from(bytes).toString("utf-8");
    schemaName = path.basename(session.schemaUri.fsPath);
  }
  let dataBytes: Uint8Array = new Uint8Array();
  let dataName: string | undefined;
  if (session.dataUri) {
    const bytes = await vscode.workspace.fs.readFile(session.dataUri);
    dataBytes = new Uint8Array(bytes);
    dataName = path.basename(session.dataUri.fsPath);
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
  // 1) Try directory-local lintx.binpb first
  const dataDir = vscode.Uri.joinPath(target, "..");
  const lintxBinpb = vscode.Uri.joinPath(dataDir, "lintx.binpb");

  try {
    const configBytes = await vscode.workspace.fs.readFile(lintxBinpb);
    outputChannel.appendLine(
      `[startup] Found lintx.binpb in same directory: ${lintxBinpb.fsPath}`
    );
    const mappings = await parseBinaryLintx(new Uint8Array(configBytes));
    if (mappings && mappings.length > 0) {
      outputChannel.appendLine(
        `[startup] Parsed ${mappings.length} mapping(s):`
      );
      mappings.forEach((mapping, index) => {
        outputChannel.appendLine(
          `  [${index}] data: "${mapping.data || "none"}", schema: "${
            mapping.schema || "none"
          }", type: "${mapping.type || "none"}"`
        );
      });
      const session = pickSessionFromMappings(mappings, dataDir, target);
      if (session) {
        outputChannel.appendLine(
          `[startup] Using configuration from lintx.binpb`
        );
        return session;
      } else {
        outputChannel.appendLine(
          `[startup] No matching configuration found for file: ${target.fsPath}`
        );
      }
    } else {
      outputChannel.appendLine(
        `[startup] Failed to parse lintx.binpb or no mappings found`
      );
    }
  } catch {
    // This is an expected failure if the file doesn't exist, so we don't need to log it.
  }

  // 2) Fallback to just the target
  return { dataUri: target };
}

// ---- Binary .lintx config support (protobuf) ----
const LINTX_PROTO = `syntax = "proto3"; package lintx; message FileMapping { string data = 1; string schema = 2; string type = 3; } message Config { repeated FileMapping files = 1; }`;

type LintxFileMapping = { data?: string; schema?: string; type?: string };

async function parseBinaryLintx(
  bytes: Uint8Array
): Promise<LintxFileMapping[] | null> {
  // Lazy-load protobufjs to avoid activation failure if dep missing
  let protobuf: any;
  try {
    protobuf = require("protobufjs");
  } catch {
    return null; // dependency not available; caller will fall back
  }
  try {
    const { root } = protobuf.parse(LINTX_PROTO);
    const Type = root.lookupType("lintx.Config");
    const msg = Type.decode(bytes);
    const obj = Type.toObject(msg, { defaults: false }) as any;
    const out: LintxFileMapping[] = [];
    if (Array.isArray(obj.files) && obj.files.length) {
      for (const f of obj.files) {
        const mapping: LintxFileMapping = {};
        if (typeof f?.data === "string") mapping.data = f.data;
        if (typeof f?.schema === "string") mapping.schema = f.schema;
        if (typeof f?.type === "string") mapping.type = f.type;
        out.push(mapping);
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}
function pickSessionFromMappings(
  cfgs: LintxFileMapping[],
  baseDir: vscode.Uri,
  target: vscode.Uri
): { dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string } | null {
  function makeUri(baseDir: vscode.Uri, p: string): vscode.Uri {
    if (path.isAbsolute(p)) return vscode.Uri.file(p);
    return vscode.Uri.joinPath(baseDir, p);
  }

  function buildSessionFromMapping(cfg: LintxFileMapping): {
    dataUri?: vscode.Uri;
    schemaUri?: vscode.Uri;
    typeName?: string;
  } | null {
    const session: {
      dataUri?: vscode.Uri;
      schemaUri?: vscode.Uri;
      typeName?: string;
    } = {};

    const dataPath = cfg.data?.trim();
    const schemaPath = cfg.schema?.trim();
    const typeName = cfg.type?.trim();

    if (schemaPath) session.schemaUri = makeUri(baseDir, schemaPath);

    // If config specifies a data path, ensure it matches the target by basename or full path
    if (dataPath && dataPath.length > 0) {
      const dataUri = makeUri(baseDir, dataPath);
      const baseMatch =
        path.basename(target.fsPath) === path.basename(dataUri.fsPath);
      const fullMatch = target.fsPath === dataUri.fsPath;
      if (!baseMatch && !fullMatch) return null; // not intended for this target
      session.dataUri = target; // honor the exact file the user opened
    } else {
      // No data in config; assume generic config applicable to current target
      session.dataUri = target;
    }

    if (typeName) session.typeName = typeName;
    return session;
  }

  // Prefer mappings where data matches target by basename or full path
  const matches: LintxFileMapping[] = [];
  const generics: LintxFileMapping[] = [];
  for (const c of cfgs) {
    if (c.data && c.data.trim().length) {
      const uri = makeUri(baseDir, c.data.trim());
      const baseMatch =
        path.basename(target.fsPath) === path.basename(uri.fsPath);
      const fullMatch = target.fsPath === uri.fsPath;
      if (baseMatch || fullMatch) matches.push(c);
    } else {
      generics.push(c);
    }
  }
  const chosen = matches[0] || generics[0];
  return chosen ? buildSessionFromMapping(chosen) : null;
}
