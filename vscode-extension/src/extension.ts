import * as vscode from 'vscode';
import * as path from 'path';

type PanelSession = {
  dataUri?: vscode.Uri;
  schemaUri?: vscode.Uri;
  typeName?: string;
  pendingInit?: { schema: string; data: number[]; typeName?: string; dataName?: string; schemaName?: string } | null;
};

export function activate(context: vscode.ExtensionContext) {
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
    const session = await resolveSessionFromConfig(target);
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
  const dir = vscode.Uri.joinPath(target, '..');
  const entries = await vscode.workspace.fs.readDirectory(dir);
  // Look for *.lintx or lintx.txt
  const configCandidates = entries
    .filter(([name, type]) => type === vscode.FileType.File && (name.endsWith('.lintx') || name.toLowerCase() === 'lintx.txt'))
    .map(([name]) => name);

  let configUri: vscode.Uri | undefined;
  for (const name of configCandidates) {
    const uri = vscode.Uri.joinPath(dir, name);
    const content = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
    const cfg = parseKeyValueConfig(content);
    const dataName = cfg['data'] || cfg['file'] || cfg['binary'] || '';
    if (!dataName || path.basename(target.fsPath) === dataName || path.basename(target.fsPath) === path.basename(dataName)) {
      // match
      configUri = uri;
      const session: { dataUri?: vscode.Uri; schemaUri?: vscode.Uri; typeName?: string } = { dataUri: target };
      if (cfg['schema']) session.schemaUri = vscode.Uri.joinPath(dir, cfg['schema']);
      if (cfg['type']) session.typeName = cfg['type'];
      return session;
    }
  }
  // No config matched; still return session using target; typeName may be undefined
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
