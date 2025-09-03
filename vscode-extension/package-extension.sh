#!/bin/bash

# Package and Publish VS Code Extension Script
set -e

echo "🔧 Building Lintx VS Code Extension..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "src/extension.ts" ]; then
    print_error "This script must be run from the vscode-extension directory"
    exit 1
fi

# Install dependencies if needed
print_status "Installing dependencies..."
npm run install:deps

# Clean previous builds
print_status "Cleaning previous builds..."
npm run clean

# Build the extension and webview
print_status "Building extension and webview..."
npm run build
npm run build:webview

# Check if build was successful
if [ ! -f "out/extension.js" ]; then
    print_error "Extension build failed - out/extension.js not found"
    exit 1
fi

if [ ! -f "../structural-editor/dist/index.html" ]; then
    print_error "Webview build failed - structural-editor/dist/index.html not found"
    exit 1
fi

# Check if vsce is available
if ! command -v vsce &> /dev/null; then
    if ! npx vsce --version &> /dev/null; then
        print_error "vsce is not installed. Run: npm install -g @vscode/vsce"
        exit 1
    fi
    VSCE_CMD="npx vsce"
else
    VSCE_CMD="vsce"
fi

# Package the extension
print_status "Packaging extension..."
$VSCE_CMD package

# Check if package was created
VSIX_FILE=$(ls *.vsix 2>/dev/null | head -1)
if [ -z "$VSIX_FILE" ]; then
    print_error "Extension packaging failed - no .vsix file found"
    exit 1
fi

print_success "Extension packaged successfully: $VSIX_FILE"

# Ask if user wants to publish
if [ "$1" == "--publish" ] || [ "$1" == "-p" ]; then
    print_warning "Publishing extension to VS Code Marketplace..."
    read -p "Are you sure you want to publish? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $VSCE_CMD publish
        print_success "Extension published successfully!"
    else
        print_status "Publishing cancelled"
    fi
fi

print_success "Done! Extension package: $VSIX_FILE"
print_status "To install locally: code --install-extension $VSIX_FILE"