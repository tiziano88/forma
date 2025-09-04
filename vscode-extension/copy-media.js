const fs = require('fs-extra');
const path = require('path');

const root = path.resolve(__dirname, '..');
const structuralEditorDist = path.join(root, 'structural-editor', 'dist');
const structuralEditorPublic = path.join(root, 'structural-editor', 'public');
const mediaDir = path.join(__dirname, 'media');

fs.copySync(structuralEditorDist, mediaDir, { overwrite: true });
// Copy sample files from public directory
const sampleBinPath = path.join(structuralEditorPublic, 'sample.binpb');
const sampleProtoPath = path.join(structuralEditorPublic, 'sample.proto');
if (fs.existsSync(sampleBinPath)) {
  fs.copySync(sampleBinPath, path.join(mediaDir, 'sample.binpb'), { overwrite: true });
}
if (fs.existsSync(sampleProtoPath)) {
  fs.copySync(sampleProtoPath, path.join(mediaDir, 'sample.proto'), { overwrite: true });
}