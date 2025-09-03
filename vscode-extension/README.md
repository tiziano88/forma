Lintx Structural Editor (VS Code)

This extension hosts the Svelte-based structural editor inside a VS Code webview. It lets you:

- Open a panel via the command: "Open Structural Editor" (command id: `lintx.openStructuralEditor`).
- Load a `.proto` schema and a `.bin` data file via buttons in the UI.
- Edit values and save the encoded `.bin` back to disk.

Development

- Build the Svelte app in `../structural-editor` so `dist/` exists (e.g., `npm run build`).
- Run the extension in VS Code (F5). The extension reads `../structural-editor/dist/index.html` and rewrites asset URLs for the webview.

Notes

- In webview mode, file open/save is handled by the extension using `vscode.window.showOpenDialog` and `vscode.workspace.fs`.
- The Svelte app contains a bridge that uses `acquireVsCodeApi()` when running inside a VS Code webview; it falls back to the browser path otherwise.

