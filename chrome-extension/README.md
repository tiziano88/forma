# Forma Chrome Extension

View protobuf binary files beautifully on GitHub (and other sites in the future).

## Features

- 🎯 **Auto-detection**: Automatically detects `.binpb`, `.bin`, and `.binarypb` files on GitHub
- 🎨 **Beautiful rendering**: Tree view with syntax highlighting (same as CLI)
- 📦 **Config auto-discovery**: Finds `config.forma.binpb` in parent directories
- 🌓 **Dark mode**: Respects GitHub's dark mode
- ⚡ **Fast**: Uses the same parsing logic as the web app and VS Code extension

## Installation

### Development Build

```bash
cd /Users/tzn/src/lintx
pnpm install
pnpm --filter @lintx/chrome-extension build
```

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension/dist` directory

## Usage

1. Navigate to any `.binpb` file on GitHub
2. The extension will automatically replace the raw view with a formatted tree view
3. If a `config.forma.binpb` is found in a parent directory, it will be used automatically
4. Otherwise, you can upload a schema descriptor manually

## How It Works

The extension:

1. **Detects** protobuf files on GitHub by checking URL patterns
2. **Downloads** the binary data via the raw.githubusercontent.com URL
3. **Searches** for config files in parent directories
4. **Parses** the data using `@lintx/core` (same parser as web/CLI/VS Code)
5. **Renders** a beautiful tree view with syntax highlighting

## Supported Sites

Current:
- ✅ GitHub (blob view and raw view)

Future:
- 🔜 GitLab
- 🔜 Bitbucket
- 🔜 Local file:// URLs

## Architecture

```
content.ts        # Runs on GitHub pages, detects files
├─ Detects .binpb files
├─ Downloads binary data
├─ Finds config files
└─ Injects viewer UI

styles.css        # GitHub-matching styles with dark mode
viewer.html       # Optional standalone viewer page
```

## Development

```bash
# Watch mode (rebuilds on file changes)
pnpm --filter @lintx/chrome-extension dev

# Production build
pnpm --filter @lintx/chrome-extension build

# Clean
pnpm --filter @lintx/chrome-extension clean
```

## TODO

- [ ] Implement schema upload functionality
- [ ] Parse config.forma.binpb and auto-load schemas
- [ ] Add type selector for files with multiple message types
- [ ] Support for inline schema descriptors (embedded in config)
- [ ] GitLab support
- [ ] Bitbucket support
- [ ] Options page for user preferences
