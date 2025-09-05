#!/bin/bash

# A script to build all packages and package the VS Code extension.
# This script should be run from the root of the monorepo.

set -e # Exit immediately if a command exits with a non-zero status.

# --- Configuration ---
EXTENSION_DIR="vscode-extension"

# --- Helper Functions ---
print_status() {
  echo -e "\033[0;34m[INFO]\033[0m $1"
}

print_success() {
  echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

print_error() {
  echo -e "\033[0;31m[ERROR]\033[0m $1"
  exit 1
}

# --- Main Script ---

# 1. Ensure we are in the root directory
if [ ! -f "pnpm-workspace.yaml" ]; then
  print_error "This script must be run from the root of the lintx monorepo."
fi

# 2. Check if vsce is installed
if ! command -v vsce &> /dev/null; then
  print_error "vsce is not installed. Please run 'pnpm add -g @vscode/vsce' to install it."
fi

# 3. Build all packages
print_status "Building all packages..."
pnpm run build

# 4. Package the extension
print_status "Packaging the VS Code extension..."
cd "$EXTENSION_DIR"
vsce package --no-dependencies
cd ..

# 5. Report success
VSIX_FILE=$(ls $EXTENSION_DIR/*.vsix 2>/dev/null | head -1)
if [ -z "$VSIX_FILE" ]; then
  print_error "Packaging failed. No .vsix file found."
fi

print_success "Extension packaged successfully: $VSIX_FILE"
print_status "To install locally, run: code --install-extension $VSIX_FILE"

# 6. Handle publishing (optional)
if [[ "$1" == "--publish" || "$1" == "-p" ]]; then
  print_status "Publishing to the VS Code Marketplace..."
  cd "$EXTENSION_DIR"
  vsce publish
  cd ..
  print_success "Extension published."
fi