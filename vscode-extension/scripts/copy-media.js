const fs = require('fs-extra');
const path = require('path');

// This script is run from the vscode-extension directory.
// We want to copy from ../structural-editor/dist to ./media

const projectRoot = path.resolve(__dirname, '..', '..'); // Resolve path to the monorepo root

const sourceDir = path.join(projectRoot, 'structural-editor', 'dist');
const targetDir = path.join(projectRoot, 'vscode-extension', 'media');

const sampleBinSource = path.join(projectRoot, 'structural-editor', 'public', 'sample.binpb');
const sampleBinTarget = path.join(targetDir, 'sample.binpb');

const sampleProtoSource = path.join(projectRoot, 'structural-editor', 'public', 'sample.proto');
const sampleProtoTarget = path.join(targetDir, 'sample.proto');

try {
  console.log(`Cleaning target directory: ${targetDir}`);
  fs.emptyDirSync(targetDir);

  console.log(`Copying webview from ${sourceDir} to ${targetDir}`);
  fs.copySync(sourceDir, targetDir);

  console.log(`Copying sample files...`);
  fs.copySync(sampleBinSource, sampleBinTarget);
  fs.copySync(sampleProtoSource, sampleProtoTarget);

  console.log('Successfully copied webview assets.');
} catch (err) {
  console.error('Error copying webview assets:', err);
  process.exit(1);
}
