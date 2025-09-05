# Refactoring Plan: Extract Core Editor Logic

Our goal is to refactor the application to cleanly separate the core protobuf handling logic from the UI and platform-specific file operations.

### 1. Create the `core` Package

-   Create a new directory named `core`.
-   Initialize it as a new package with its own `package.json`.
-   This package will contain the pure, non-UI, non-I/O editor logic.

### 2. Implement the `StructuralEditor` Class in `core`

-   Create `core/src/StructuralEditor.ts`.
-   This class will be responsible for all Protobuf operations.
-   It will have **no knowledge of files, VS Code, or web APIs**.
-   **Public methods will include:**
    -   `setSchema(schemaText: string): Promise<void>`
    -   `setData(dataBytes: Uint8Array, typeName?: string | null): Promise<void>`
    -   `getDecodedData(): any`
    -   `updateDecodedData(newData: any): void`
    -   `getEncodedBytes(): Uint8Array`
    -   `getAvailableTypes(): string[]`
    -   `setCurrentType(typeName: string): Promise<void>`

### 3. Refactor the `structural-editor` Package (Webview UI)

-   This package will now be a "dumb" UI layer that consumes the `core` package.
-   Remove the business logic from `structural-editor/src/lib/core.ts` (it will be moved to the `core` package).
-   The main component (`App.svelte`) will:
    -   Instantiate the `StructuralEditor` class from `core`.
    -   Handle all user interactions (button clicks for "Load Schema", "Load Data", "Save").
    -   Perform all file I/O by communicating with the VS Code extension host.
    -   Call the appropriate methods on the `StructuralEditor` instance (e.g., after loading a file, it will call `editor.setData(fileBytes)`).
    -   Listen for events from the editor to re-render the UI when data changes.

### 4. Create the `web-app` Package (Standalone Web UI)

-   Create a new directory named `web-app`.
-   Initialize it as a new Svelte application.
-   This package will also consume the `core` package.
-   It will be very similar to `structural-editor`, but it will implement file I/O using standard browser APIs (like the File System Access API) instead of the VS Code webview bridge.

### 5. Update `pnpm-workspace.yaml`

-   Add the new `core` and `web-app` packages to the workspace configuration.
