/**
 * Viewer script that renders protobuf data
 * Uses @lintx/core for parsing and rendering
 */

import { StructuralEditor } from '@lintx/core';
import type { FileMapping } from '@lintx/core';
import { parseConfig } from '@lintx/core/dist/forma-parser.js';

// Mock Svelte runes for browser environment
(window as any).$state = function (initialValue: any) {
  return initialValue;
};

(window as any).$derived = function (computation: any) {
  return typeof computation === 'function' ? computation() : computation;
};

(window as any).$derived.by = function (computation: () => any) {
  return '';
};

(window as any).$effect = function (fn: () => void) {
  // Don't execute effects in extension - they're for reactivity
};

interface ViewerData {
  binaryData: Uint8Array;
  downloadUrl: string;
  configUrl: string | null;
  isConfigFile?: boolean;
}

// Format bytes with color coding
function formatBytes(bytes: Uint8Array, maxLen = 32): string {
  const hex = Array.from(bytes)
    .slice(0, maxLen)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  return bytes.length > maxLen ? `${hex}...` : hex;
}

// Render the protobuf data as a tree
function renderTree(editor: StructuralEditor): string {
  const lines: string[] = [];
  const rootMsg = editor.decodedData;

  if (!rootMsg) {
    return '<span class="forma-unset">No data decoded</span>';
  }

  function addLine(content: string) {
    lines.push(`<div class="forma-tree-line">${content}</div>`);
  }

  function escape(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '<span class="forma-unset">(unset)</span>';
    }

    if (typeof value === 'string') {
      return `<span class="forma-value-string">"${escape(value)}"</span>`;
    }

    if (typeof value === 'number') {
      return `<span class="forma-value-number">${value}</span>`;
    }

    if (typeof value === 'boolean') {
      return `<span class="forma-value-bool">${value}</span>`;
    }

    if (value instanceof Uint8Array) {
      return `<span class="forma-value-bytes">&lt;${formatBytes(value)}&gt;</span>`;
    }

    // For MessageValue objects
    if ('fields' in value && 'type' in value) {
      return ''; // Will be rendered recursively
    }

    return String(value);
  }

  function isMessageValue(value: any): boolean {
    return value && typeof value === 'object' && 'fields' in value && 'type' in value;
  }

  function renderField(msg: any, field: any, indent: string, isLast: boolean) {
    const branch = isLast ? '└─ ' : '├─ ';
    const extension = isLast ? '   ' : '│  ';

    const fieldHeader = `<span class="forma-field-name">${escape(field.name)}</span><span class="forma-field-number">#${field.number}</span>`;

    // Get field data from message
    const fieldData = msg.fields.get(field.number);

    if (!fieldData || fieldData.length === 0) {
      return; // Skip unset fields
    }

    if (fieldData.length > 1) {
      // Repeated field
      addLine(`${indent}${branch}${fieldHeader}: <span class="forma-type-name">[${fieldData.length}]</span>`);

      fieldData.forEach((item: any, idx: number) => {
        const isLastItem = idx === fieldData.length - 1;
        const itemBranch = isLastItem ? '└─ ' : '├─ ';
        const itemExt = isLastItem ? '   ' : '│  ';

        const formatted = formatValue(item);
        if (formatted) {
          addLine(`${indent}${extension}${itemBranch}[${idx}]: ${formatted}`);
        } else if (isMessageValue(item)) {
          addLine(`${indent}${extension}${itemBranch}[${idx}]: <span class="forma-type-name">${field.typeName || '(message)'}</span>`);
          renderMessage(item, indent + extension + itemExt);
        }
      });
    } else {
      // Singular field
      const value = fieldData[0];
      const formatted = formatValue(value);
      if (formatted) {
        addLine(`${indent}${branch}${fieldHeader}: ${formatted}`);
      } else if (isMessageValue(value)) {
        addLine(`${indent}${branch}${fieldHeader}: <span class="forma-type-name">${field.typeName || '(message)'}</span>`);
        renderMessage(value, indent + extension);
      }
    }
  }

  function renderMessage(msg: any, indent: string) {
    if (!msg || !msg.type || !msg.type.fields) return;

    const fields = Array.from(msg.type.fields.values());
    fields.forEach((field: any, idx: number) => {
      renderField(msg, field, indent, idx === fields.length - 1);
    });
  }

  // Start rendering from root
  if (rootMsg.type) {
    addLine(`<span class="forma-type-name">${rootMsg.type.fullName}</span> {`);
    renderMessage(rootMsg, '  ');
    addLine('}');
  }

  return lines.join('\n');
}

// Main viewer initialization
async function initViewer() {
  // Read data from DOM attributes
  const viewerDiv = document.getElementById('forma-viewer');
  if (!viewerDiv) {
    console.error('[Forma] Viewer div not found');
    return;
  }

  const base64Data = viewerDiv.getAttribute('data-forma-binary');
  const downloadUrl = viewerDiv.getAttribute('data-forma-download-url');
  const configUrl = viewerDiv.getAttribute('data-forma-config-url');
  const isConfigFile = viewerDiv.getAttribute('data-forma-is-config') === 'true';

  if (!base64Data || !downloadUrl) {
    console.error('[Forma] No viewer data found in DOM attributes');
    return;
  }

  // Decode base64 to binary data
  const binaryString = atob(base64Data);
  const binaryData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    binaryData[i] = binaryString.charCodeAt(i);
  }

  const data: ViewerData = {
    binaryData,
    downloadUrl,
    configUrl,
    isConfigFile,
  };

  console.log('[Forma] Loaded data from DOM:', {
    dataSize: binaryData.length,
    downloadUrl,
    configUrl,
  });

  const contentDiv = document.getElementById('forma-content');
  if (!contentDiv) {
    console.error('[Forma] Content div not found');
    return;
  }

  // Show loading state
  contentDiv.innerHTML = `
    <div class="forma-message">
      <h3>Loading...</h3>
      <p>Parsing protobuf data...</p>
    </div>
  `;

  try {
    // If this is a config file itself, display it specially
    if (data.isConfigFile) {
      console.log('[Forma] Displaying config file...');
      await displayConfigFile(data);
    } else if (data.configUrl) {
      // Regular data file with config - auto-load it
      console.log('[Forma] Auto-loading from config file...');
      await loadConfigAndRender(data.configUrl, data);
    } else {
      // No config file found
      contentDiv.innerHTML = `
        <div class="forma-message">
          <h3>No configuration found</h3>
          <p>Protobuf file detected (${(data.binaryData.byteLength / 1024).toFixed(2)} KB)</p>
          <p>Unable to find a <code>config.forma.binpb</code> file in parent directories.</p>
          <p class="forma-hint">Create a config file to automatically view protobuf files.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('[Forma] Error:', error);
    contentDiv.innerHTML = `
      <div class="forma-message">
        <h3>Error</h3>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
  }
}

async function displayConfigFile(data: ViewerData) {
  const contentDiv = document.getElementById('forma-content');
  if (!contentDiv) return;

  contentDiv.innerHTML = `
    <div class="forma-message">
      <h3>Parsing config file...</h3>
    </div>
  `;

  try {
    // Embedded config schema descriptor (forma.proto compiled)
    const CONFIG_SCHEMA_BASE64 = 'CoQKChJjb25maWcvZm9ybWEucHJvdG8SDGZvcm1hLmNvbmZpZyKiAQoLRmlsZU1hcHBpbmcSEgoEZGF0YRgBIAEoCVIEZGF0YRIaCgZzY2hlbWEYAiABKAlCAhgBUgZzY2hlbWESKwoRc2NoZW1hX2Rlc2NyaXB0b3IYBCABKAlSEHNjaGVtYURlc2NyaXB0b3ISEgoEdHlwZRgDIAEoCVIEdHlwZRIiCgxwcmVzZW50YXRpb24YBSABKAlSDHByZXNlbnRhdGlvbiI5CgZDb25maWcSLwoFZmlsZXMYASADKAsyGS5mb3JtYS5jb25maWcuRmlsZU1hcHBpbmdSBWZpbGVzSvcHCgYSBAAAFQEKCAoBDBIDAAASCggKAQISAwEAFQpNCgIEABIEBAAQARpBIEEgbWFwcGluZyBiZXR3ZWVuIGEgZGF0YSBmaWxlIGFuZCB0aGUgc2NoZW1hL3R5cGUgdG8gZGVjb2RlIGl0LgoKCgoDBAABEgMECBMKVQoEBAACABIDBgISGkggUGF0aCB0byB0aGUgYmluYXJ5IGRhdGEgZmlsZSAocmVsYXRpdmUgdG8gY29uZmlnIGxvY2F0aW9uIG9yIGFic29sdXRlKQoKDAoFBAACAAUSAwYCCAoMCgUEAAIAARIDBgkNCgwKBQQAAgADEgMGEBEKUgoEBAACARIDCAIqGkUgUGF0aCB0byB0aGUgLnByb3RvIHNjaGVtYSAocmVsYXRpdmUgdG8gY29uZmlnIGxvY2F0aW9uIG9yIGFic29sdXRlKQoKDAoFBAACAQUSAwgCCAoMCgUEAAIBARIDCAkPCgwKBQQAAgEDEgMIEhMKDAoFBAACAQgSAwgUKQoNCgYEAAIBCAMSAwgWJwpbCgQEAAICEgMKAh8aTiBQYXRoIHRvIHRoZSBiaW5hcnkgZGVzY3JpcHRvciBmaWxlIChyZWxhdGl2ZSB0byBjb25maWcgbG9jYXRpb24gb3IgYWJzb2x1dGUpCgoMCgUEAAICBRIDCgIICgwKBQQAAgIBEgMKCRoKDAoFBAACAgMSAwodHgpJCgQEAAIDEgMMAhIaPCBGdWxseS1xdWFsaWZpZWQgUHJvdG9idWYgbWVzc2FnZSB0eXBlIHRvIGRlY29kZSAob3B0aW9uYWwpCgoMCgUEAAIDBRIDDAIICgwKBQQAAgMBEgMMCQ0KDAoFBAACAwMSAwwQEQqaAQoEBAACBBIDDwIaGowBIE9wdGlvbmFsOiBQYXRoIHRvIHByZXNlbnRhdGlvbiBmaWxlIHdpdGggY29tbWVudHMgYW5kIHN0eWxpbmcKIEF1dG8tY3JlYXRlZCBhcyA8ZGF0YT4ucHJlc2VudGF0aW9uLmZvcm1hLmJpbnBiIHdoZW4gZmlyc3QgY29tbWVudCBpcyBhZGRlZAoKDAoFBAACBAUSAw8CCAoMCgUEAAIEARIDDwkVCgwKBQQAAgQDEgMPGBkKTgoCBAESBBMAFQEaQiBXb3Jrc3BhY2UtbGV2ZWwgY29uZmlndXJhdGlvbjogbXVsdGlwbGUgbWFwcGluZ3Mgc3VwcG9ydGVkIG9ubHkuCgoKCgMEAQESAxMIDgoLCgQEAQIAEgMUAiEKDAoFBAECAAQSAxQCCgoMCgUEAQIABhIDFAsWCgwKBQQBAgABEgMUFxwKDAoFBAECAAMSAxQfIGIGcHJvdG8z';

    // Decode base64 to bytes
    const binaryString = atob(CONFIG_SCHEMA_BASE64);
    const configSchemaBytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      configSchemaBytes[i] = binaryString.charCodeAt(i);
    }

    // Use the regular rendering with the config schema
    await renderWithSchema(configSchemaBytes, data, contentDiv, 'forma.config.Config');
  } catch (error) {
    console.error('[Forma] Error displaying config:', error);
    contentDiv.innerHTML = `
      <div class="forma-message">
        <h3>Error parsing config file</h3>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
  }
}

async function loadSchemaAndRender(file: File, data: ViewerData) {
  const contentDiv = document.getElementById('forma-content');
  if (!contentDiv) return;

  try {
    const schemaBytes = new Uint8Array(await file.arrayBuffer());
    await renderWithSchema(schemaBytes, data, contentDiv);
  } catch (error) {
    console.error('[Forma] Error loading schema:', error);
    contentDiv.innerHTML = `
      <div class="forma-message">
        <h3>Error loading schema</h3>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
  }
}

async function loadConfigAndRender(configUrl: string, data: ViewerData) {
  const contentDiv = document.getElementById('forma-content');
  if (!contentDiv) return;

  contentDiv.innerHTML = `
    <div class="forma-message">
      <h3>Loading config...</h3>
      <p>Downloading and parsing config file...</p>
    </div>
  `;

  try {
    // Download config file
    const response = await fetch(configUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.statusText}`);
    }
    const configBytes = new Uint8Array(await response.arrayBuffer());

    // Parse config file
    console.log('[Forma] Parsing config file...');
    const config = parseConfig(configBytes);
    console.log('[Forma] Config parsed:', config);

    // Get the directory URL of the config file
    const configUrlObj = new URL(configUrl);
    const configDir = configUrlObj.pathname.substring(0, configUrlObj.pathname.lastIndexOf('/'));

    // Get the data file URL to match against config
    const dataUrlObj = new URL(data.downloadUrl);
    const dataPath = dataUrlObj.pathname;

    // Find matching file mapping
    let matchedMapping: FileMapping | null = null;
    for (const fileMapping of config.files) {
      // Construct full path for the data file in config
      const configDataPath = `${configDir}/${fileMapping.data}`;
      console.log('[Forma] Checking mapping:', { configDataPath, dataPath });

      if (dataPath.endsWith(fileMapping.data) || dataPath.includes(configDataPath)) {
        matchedMapping = fileMapping;
        console.log('[Forma] Found matching mapping:', matchedMapping);
        break;
      }
    }

    if (!matchedMapping || !matchedMapping.schemaDescriptor) {
      throw new Error('No matching schema descriptor found in config for this file');
    }

    // Download the schema descriptor
    const schemaUrl = new URL(matchedMapping.schemaDescriptor, configUrl);
    console.log('[Forma] Downloading schema descriptor from:', schemaUrl.href);

    const schemaResponse = await fetch(schemaUrl.href);
    if (!schemaResponse.ok) {
      throw new Error(`Failed to fetch schema descriptor: ${schemaResponse.statusText}`);
    }
    const schemaBytes = new Uint8Array(await schemaResponse.arrayBuffer());

    // Render with the schema, passing the type name from config
    await renderWithSchema(schemaBytes, data, contentDiv, matchedMapping.type);
  } catch (error) {
    console.error('[Forma] Error loading config:', error);
    contentDiv.innerHTML = `
      <div class="forma-message">
        <h3>Error loading configuration</h3>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        <p class="forma-hint">Check that your config file and schema descriptor are properly configured.</p>
      </div>
    `;
  }
}

async function renderWithSchema(schemaBytes: Uint8Array, data: ViewerData, contentDiv: HTMLElement, typeName?: string) {
  contentDiv.innerHTML = `
    <div class="forma-message">
      <h3>Parsing...</h3>
      <p>Loading protobuf schema and parsing data...</p>
    </div>
  `;

  try {
    // Initialize editor
    const editor = new StructuralEditor();
    await editor.initialize({
      data: data.binaryData,
      schemaDescriptor: schemaBytes,
      typeName,
    });

    console.log('[Forma] Editor initialized:', {
      schemaLoaded: editor.schemaLoaded,
      selectedTypeName: editor.selectedTypeName,
      availableTypes: editor.availableTypes,
      hasDecodedData: !!editor.decodedData,
    });

    // Show type selector if there are multiple types and no type specified
    const types = editor.availableTypes;
    if (types.length > 1 && !editor.selectedTypeName) {
      contentDiv.innerHTML = `
        <div class="forma-message">
          <h3>Select Message Type</h3>
          <p>The schema contains multiple message types. Please select the type of this file:</p>
          <div class="forma-actions">
            ${types.map(type => `<button class="forma-btn forma-type-btn" data-type="${type}">${type}</button>`).join('')}
          </div>
        </div>
      `;

      contentDiv.querySelectorAll('.forma-type-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const selectedType = (btn as HTMLElement).dataset.type!;

          // Re-initialize with type name
          const newEditor = new StructuralEditor();
          await newEditor.initialize({
            data: data.binaryData,
            schemaDescriptor: schemaBytes,
            typeName: selectedType,
          });

          const html = renderTree(newEditor);
          contentDiv.innerHTML = `<div class="forma-tree">${html}</div>`;
        });
      });
    } else {
      // Auto-select the only type or type already selected
      const html = renderTree(editor);
      contentDiv.innerHTML = `<div class="forma-tree">${html}</div>`;
    }
  } catch (error) {
    console.error('[Forma] Error rendering:', error);
    contentDiv.innerHTML = `
      <div class="forma-message">
        <h3>Error parsing protobuf</h3>
        <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViewer);
} else {
  initViewer();
}
