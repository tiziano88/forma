# Lintx Structural Editor (VS Code)

This extension hosts the Svelte-based structural editor inside a VS Code webview. It lets you:

- Open a panel via the command: "Open Structural Editor" (command id: `lintx.openStructuralEditor`).
- Load a `.proto` schema and a `.bin` data file via buttons in the UI.
- Edit values and save the encoded `.bin` back to disk.

## Development Setup

This project is a `pnpm` monorepo containing the `structural-editor` (a Svelte web app) and the `vscode-extension`.

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/installation)
- [Visual Studio Code](https://code.visualstudio.com/)

### 2. Install Dependencies

Clone the repository and run the following command in the root directory to install all dependencies for both the editor and the extension:

```bash
pnpm install
```

### 3. Compile and Debug

Everything is configured for a reliable debugging experience in VS Code.

1.  Open the `vscode-extension` folder in VS Code.
2.  Go to the **Run and Debug** view (you can use the shortcut `Cmd+Shift+D` on macOS or `Ctrl+Shift+D` on Windows/Linux).
3.  Select the **"Run Extension"** launch configuration from the dropdown menu.
4.  Press **F5** or click the green play button to start debugging.

This will automatically trigger a pre-launch task that builds the Svelte webview and copies the assets, then launches a new Extension Development Host window with the extension running.

### Making a Change and Seeing it

The workflow is simple and reliable:

1.  **Make a code change** in either the `structural-editor` or `vscode-extension` source files.
2.  **Stop the debugger** if it is running (Shift+F5).
3.  **Start a new debugging session** by pressing **F5**. The pre-launch task will automatically rebuild the UI.
4.  **If your UI changes are not visible**, it is likely due to VS Code's webview cache. To fix this, open the Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`) in the **debugged VS Code window** and run the `Developer: Reload Window` command. This will force the webview to load the new files.
