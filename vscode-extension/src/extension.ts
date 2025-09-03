import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('lintx.openStructuralEditor', async () => {
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

    panel.webview.html = await getWebviewHtml(panel.webview, context);

    panel.webview.onDidReceiveMessage(async (msg) => {
      const { type, requestId, payload } = msg || {};
      try {
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
          panel.webview.postMessage({ type, requestId, payload: { name: path.basename(uri.fsPath), content: Array.from(data) } });
          return;
        }
        if (type === 'getSample') {
          // Try to load sample files from structural-editor/public or dist
          const protoUri = vscode.Uri.joinPath(context.extensionUri, '..', 'structural-editor', 'public', 'sample.proto');
          const binUri = vscode.Uri.joinPath(context.extensionUri, '..', 'structural-editor', 'public', 'sample.bin');
          const schemaBytes = await vscode.workspace.fs.readFile(protoUri);
          const dataBytes = await vscode.workspace.fs.readFile(binUri);
          panel.webview.postMessage({ type, requestId, payload: { schema: Buffer.from(schemaBytes).toString('utf-8'), data: Array.from(dataBytes) } });
          return;
        }
        if (type === 'saveData') {
          const name: string = payload?.name || 'data.bin';
          const content: number[] = payload?.content || [];
          const saveUri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(name), filters: { 'Binary Data': ['bin'] } });
          if (saveUri) {
            await vscode.workspace.fs.writeFile(saveUri, Buffer.from(new Uint8Array(content)));
          }
          panel.webview.postMessage({ type, requestId, payload: true });
          return;
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(err?.message || String(err));
        panel.webview.postMessage({ type, requestId, payload: { error: err?.message || String(err) } });
      }
    });
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

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

