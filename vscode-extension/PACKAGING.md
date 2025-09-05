# Packaging and Publishing the Forma VS Code Extension

## Quick Start

### Package the Extension

```bash
./package-extension.sh
```

### Package and Publish

```bash
./package-extension.sh --publish
```

## Manual Steps

### 1. Install Dependencies

```bash
npm run install:deps
```

### 2. Build Everything

```bash
npm run build          # Build the TypeScript extension
npm run build:webview  # Build the Svelte webview app
```

### 3. Package

```bash
npm run package
```

### 4. Publish (Optional)

```bash
npm run publish
```

## Prerequisites

1. **Install vsce globally** (recommended):

   ```bash
   npm install -g @vscode/vsce
   ```

2. **Publisher Account**: To publish to the VS Code Marketplace, you need:
   - A Visual Studio Marketplace publisher account
   - A Personal Access Token (PAT) from Azure DevOps
   - Run `vsce login <publisher-name>` first

## Package.json Scripts

- `npm run build` - Build the extension TypeScript
- `npm run build:webview` - Build the Svelte webview app
- `npm run package` - Build and package into .vsix file
- `npm run publish` - Package and publish to marketplace
- `npm run install:deps` - Install dependencies for both projects
- `npm run clean` - Clean build artifacts

## Testing Locally

After packaging, you can install the extension locally:

```bash
code --install-extension forma-structural-editor-0.0.1.vsix
```

## File Structure

The extension requires both components:

- `/out/extension.js` - The main extension code
- `/../structural-editor/dist/` - The built Svelte webview app

## Troubleshooting

### Build Fails

- Check that both `vscode-extension` and `structural-editor` dependencies are installed
- Ensure TypeScript compilation succeeds
- Verify Svelte build creates `dist/index.html`

### Packaging Fails

- Make sure `vsce` is installed
- Check that `out/extension.js` exists
- Verify all required files are present

### Publishing Fails

- Ensure you're logged in: `vsce login <publisher>`
- Update publisher name in `package.json`
- Check version number is incremented
