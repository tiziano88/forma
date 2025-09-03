import * as vscode from 'vscode';
import * as path from 'path';
// Note: avoid importing protobufjs at top-level to prevent activation failures

type PanelSession = {
  dataUri?: vscode.Uri;
  schemaUri?: vscode.Uri;
  typeName?: string;
  pendingInit?: { schema: string; data: number[]; typeName?: string; dataName?: string; schemaName?: string } | null;
};

export function activate(context: vscode.ExtensionContext) {
  const out = vscode.window.createOutputChannel('lintx');
  const openBlank = vscode.commands.registerCommand('lintx.openStructuralEditor', async () => {
    const { panel } = await createPanel(context);
    // No pre-init; user can click buttons
    return panel;
  });

  const openForActive = vscode.commands.registerCommand('lintx.openForActiveFile', async () => {
    let target: vscode.Uri | undefined = getActiveResourceUri() || vscode.window.activeTextEditor?.document.uri;
    if (!target) {
      const picked = await vscode.window.showOpenDialog({ canSelectMany: false });
      if (!picked || !picked[0]) return;
      target = picked[0];
    }
    out.appendLine(`[openForActive] target=${target.fsPath}`);
    const session = await resolveSessionFromConfig(target);
    out.appendLine(`[resolve] dataUri=${session.dataUri?.fsPath ?? ''} schemaUri=${session.schemaUri?.fsPath ?? ''} type=${session.typeName ?? ''}`);
    const { panel, sessionState } = await createPanel(context, session);
    if (sessionState.pendingInit) {
      // If webview already signaled ready, flush now
      panel.webview.postMessage({ type: 'initWithConfig', requestId: 0, payload: sessionState.pendingInit });
      sessionState.pendingInit = null;
    }
    return panel;
  });

  context.subscriptions.push(openBlank, openForActive);
}

export function deactivate() {}

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

async function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext) {
  // Load the Svelte app from structural-editor/dist
  const distRoot = vscode.Uri.joinPath(context.extensionUri, '..', 'structural-editor', 'dist');
  const indexUri = vscode.Uri.joinPath(distRoot, 'index.html');
  let html = (await vscode.workspace.fs.readFile(indexUri)).toString();

  // Rewrite asset paths to use asWebviewUri
  const toWebviewUri = (p: string) => {
    const u = vscode.Uri.joinPath(distRoot, p);
    return webview.asWebviewUri(u).toString();
  };

  // naive replacements for href/src paths produced by Vite
  html = html.replace(/\shref=\"\/(.*?)\"/g, (m, p1) => ` href="${toWebviewUri(p1)}"`);
  html = html.replace(/\ssrc=\"\/(.*?)\"/g, (m, p1) => ` src="${toWebviewUri(p1)}"`);
  html = html.replace(/\shref=\"(assets\/.+?)\"/g, (m, p1) => ` href="${toWebviewUri(p1)}"`);
  html = html.replace(/\ssrc=\"(assets\/.+?)\"/g, (m, p1) => ` src="${toWebviewUri(p1)}"`);

  // Content Security Policy: allow scripts/styles from the webview
  const csp = `
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; script-src ${webview.cspSource} 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; connect-src ${webview.cspSource};">
  `;
  html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, csp);
  if (!/Content-Security-Policy/.test(html)) {
    html = html.replace(/<head>/, `<head>\n${csp}`);
  }

  return html;
}

async function createPanel(context: vscode.ExtensionContext, predefined?: { dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string }) {
  const panel = vscode.window.createWebviewPanel(
    'lintx.structuralEditor',
    'Structural Editor',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'media'),
        vscode.Uri.joinPath(context.extensionUri, '..', 'structural-editor', 'dist')
      ]
    }
  );

  const sessionState: PanelSession = { dataUri: predefined?.dataUri, schemaUri: predefined?.schemaUri, typeName: predefined?.typeName, pendingInit: null };

  panel.webview.onDidReceiveMessage(async (msg) => {
    const { type, requestId, payload } = msg || {};
    try {
      if (type === 'ready') {
        if (sessionState.dataUri) {
          const initPayload = await prepareInitPayload(context, sessionState);
          sessionState.pendingInit = initPayload;
          console.log('[lintx] sending initWithConfig', { dataName: initPayload?.data?.length, schemaLen: initPayload?.schema?.length, type: initPayload?.typeName });
          panel.webview.postMessage({ type: 'initWithConfig', requestId: 0, payload: initPayload });
          sessionState.pendingInit = null;
        }
        return;
      }
      if (type === 'pickFile') {
        const isSchema = payload?.kind === 'schema';
        const filters = isSchema ? { 'Protobuf Schema': ['proto'] } : { 'Binary Data': ['bin'] };
        const chosen = await vscode.window.showOpenDialog({ canSelectMany: false, filters });
        if (!chosen || !chosen[0]) {
          panel.webview.postMessage({ type, requestId, payload: { name: '', content: [] } });
          return;
        }
        const uri = chosen[0];
        const data = await vscode.workspace.fs.readFile(uri);
        if (isSchema) sessionState.schemaUri = uri; else sessionState.dataUri = uri;
        panel.webview.postMessage({ type, requestId, payload: { name: path.basename(uri.fsPath), content: Array.from(data) } });
        return;
      }
      if (type === 'getSample') {
        const protoUri = vscode.Uri.joinPath(context.extensionUri, '..', 'structural-editor', 'public', 'sample.proto');
        const binUri = vscode.Uri.joinPath(context.extensionUri, '..', 'structural-editor', 'public', 'sample.bin');
        const schemaBytes = await vscode.workspace.fs.readFile(protoUri);
        const dataBytes = await vscode.workspace.fs.readFile(binUri);
        panel.webview.postMessage({ type, requestId, payload: { schema: Buffer.from(schemaBytes).toString('utf-8'), data: Array.from(dataBytes) } });
        return;
      }
      if (type === 'saveData') {
        const content: number[] = payload?.content || [];
        if (sessionState.dataUri) {
          await vscode.workspace.fs.writeFile(sessionState.dataUri, Buffer.from(new Uint8Array(content)));
          panel.webview.postMessage({ type, requestId, payload: true });
          return;
        } else {
          const name: string = payload?.name || 'data.bin';
          const saveUri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(name), filters: { 'Binary Data': ['bin'] } });
          if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(new Uint8Array(content)));
          }
          panel.webview.postMessage({ type, requestId, payload: true });
          return;
        }
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(err?.message || String(err));
      panel.webview.postMessage({ type, requestId, payload: { error: err?.message || String(err) } });
    }
  });

  panel.webview.html = await getWebviewHtml(panel.webview, context);

  return { panel, sessionState };
}

async function prepareInitPayload(context: vscode.ExtensionContext, session: PanelSession) {
  let schemaText = '';
  let schemaName: string | undefined;
  if (!session.schemaUri) {
    // best-effort: look for a .proto next to dataUri
    if (session.dataUri) {
      const dir = vscode.Uri.joinPath(session.dataUri, '..');
      const entries = await vscode.workspace.fs.readDirectory(dir);
      const protos = entries.filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.proto')).map(([name]) => name);
      let chosen: string | undefined;
      if (protos.length === 1) chosen = protos[0];
      else if (protos.length > 1) {
        const base = path.basename(session.dataUri.fsPath, path.extname(session.dataUri.fsPath));
        chosen = protos.find(p => path.basename(p, '.proto') === base) || protos[0];
      }
      if (chosen) session.schemaUri = vscode.Uri.joinPath(dir, chosen);
    }
  }
  if (session.schemaUri) {
    const bytes = await vscode.workspace.fs.readFile(session.schemaUri);
    schemaText = Buffer.from(bytes).toString('utf-8');
    schemaName = path.basename(session.schemaUri.fsPath);
  }
  let dataBytes: Uint8Array = new Uint8Array();
  let dataName: string | undefined;
  if (session.dataUri) {
    const bytes = await vscode.workspace.fs.readFile(session.dataUri);
    dataBytes = new Uint8Array(bytes);
    dataName = path.basename(session.dataUri.fsPath);
  }
  return { schema: schemaText, data: Array.from(dataBytes), typeName: session.typeName, dataName, schemaName };
}

async function resolveSessionFromConfig(target: vscode.Uri): Promise<{ dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string }> {
  // 1) Try directory-local configs
  const local = await tryResolveConfigInDir(vscode.Uri.joinPath(target, '..'), target);
  if (local) return local;
  // 2) Try workspace root configs
  const root = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (root) {
    const fromRoot = await tryResolveConfigInDir(root, target, /*isWorkspaceRoot*/ true);
    if (fromRoot) return fromRoot;
  }
  // 3) Fallback to just the target
  return { dataUri: target };
}

function parseKeyValueConfig(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    out[key] = val;
  }
  return out;
}

// ---- Binary .lintx config support (protobuf) ----
const LINTX_PROTO = `syntax = "proto3"; package lintx; message FileMapping { string data = 1; string schema = 2; string type = 3; } message Config { repeated FileMapping files = 1; }`;

type LintxFileMapping = { data?: string; schema?: string; type?: string };

async function parseBinaryLintx(bytes: Uint8Array): Promise<LintxFileMapping[] | null> {
  // Lazy-load protobufjs to avoid activation failure if dep missing
  let protobuf: any;
  try {
    protobuf = await import('protobufjs');
  } catch {
    return null; // dependency not available; caller will fall back
  }
  try {
    const { root } = protobuf.parse(LINTX_PROTO);
    const Type = root.lookupType('lintx.Config');
    const msg = Type.decode(bytes);
    const obj = Type.toObject(msg, { defaults: false }) as any;
    const out: LintxFileMapping[] = [];
    if (Array.isArray(obj.files) && obj.files.length) {
      for (const f of obj.files) {
        const m: LintxFileMapping = {};
        if (typeof f?.data === 'string') m.data = f.data;
        if (typeof f?.schema === 'string') m.schema = f.schema;
        if (typeof f?.type === 'string') m.type = f.type;
        out.push(m);
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

async function tryResolveConfigInDir(baseDir: vscode.Uri, target: vscode.Uri, isWorkspaceRoot = false): Promise<{ dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string } | null> {
  let entries: [string, vscode.FileType][] = [];
  try {
    entries = await vscode.workspace.fs.readDirectory(baseDir);
  } catch {
    return null;
  }
  const names = entries
    .filter(([name, type]) => type === vscode.FileType.File)
    .map(([name]) => name);

  // Prefer *.lintx (binary) over lintx.txt
  const binaryCandidates = names.filter(n => n.toLowerCase().endsWith('.lintx'));
  for (const name of binaryCandidates) {
    const uri = vscode.Uri.joinPath(baseDir, name);
    const bytes = new Uint8Array(await vscode.workspace.fs.readFile(uri));
    const cfgs = await parseBinaryLintx(bytes);
    if (cfgs && cfgs.length) {
      const session = pickSessionFromMappings(cfgs, baseDir, target);
      if (session) return session;
    } else {
      // Legacy: some repos may store text in a .lintx file; try KV parse
      try {
        const content = Buffer.from(bytes).toString('utf-8');
        const kv = parseKeyValueConfig(content);
        const cfg2: LintxFileMapping = { data: kv['data'] || kv['file'] || kv['binary'], schema: kv['schema'], type: kv['type'] };
        const session = buildSessionFromMapping(cfg2, baseDir, target);
        if (session) return session;
      } catch {
        // ignore
      }
    }
  }

  // Fallback: lintx.txt (legacy text)
  const legacy = names.find(n => n.toLowerCase() === 'lintx.txt');
  if (legacy) {
    const uri = vscode.Uri.joinPath(baseDir, legacy);
    const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
    const cfgKV = parseKeyValueConfig(content);
    const cfg: LintxFileMapping = { data: cfgKV['data'] || cfgKV['file'] || cfgKV['binary'], schema: cfgKV['schema'], type: cfgKV['type'] };
    const session = buildSessionFromMapping(cfg, baseDir, target);
    if (session) return session;
  }
  return null;
}
function pickSessionFromMappings(cfgs: LintxFileMapping[], baseDir: vscode.Uri, target: vscode.Uri): { dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string } | null {
  // Prefer mappings where data matches target by basename or full path
  const matches: LintxFileMapping[] = [];
  const generics: LintxFileMapping[] = [];
  for (const c of cfgs) {
    if (c.data && c.data.trim().length) {
      const uri = makeUri(baseDir, c.data.trim());
      const baseMatch = path.basename(target.fsPath) === path.basename(uri.fsPath);
      const fullMatch = target.fsPath === uri.fsPath;
      if (baseMatch || fullMatch) matches.push(c);
    } else {
      generics.push(c);
    }
  }
  const chosen = matches[0] || generics[0];
  return chosen ? buildSessionFromMapping(chosen, baseDir, target) : null;
}

function buildSessionFromMapping(cfg: LintxFileMapping, baseDir: vscode.Uri, target: vscode.Uri): { dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string } | null {
  const session: { dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string } = {};

  const dataPath = cfg.data?.trim();
  const schemaPath = cfg.schema?.trim();
  const typeName = cfg.type?.trim();

  if (schemaPath) session.schemaUri = makeUri(baseDir, schemaPath);

  // If config specifies a data path, ensure it matches the target by basename or full path
  if (dataPath && dataPath.length > 0) {
    const dataUri = makeUri(baseDir, dataPath);
    const baseMatch = path.basename(target.fsPath) === path.basename(dataUri.fsPath);
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

function makeUri(baseDir: vscode.Uri, p: string): vscode.Uri {
  if (path.isAbsolute(p)) return vscode.Uri.file(p);
  return vscode.Uri.joinPath(baseDir, p);
}
