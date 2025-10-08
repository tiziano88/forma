#!/usr/bin/env node

// Initialize Svelte rune shims before importing anything else
import './svelte-shim.js';

import { readFile } from 'fs/promises';
import { resolve, dirname, join } from 'path';
import { Command } from 'commander';
import pc from 'picocolors';
import { StructuralEditor } from '@lintx/core';
import { ProtoFormatter } from './formatter.js';
import { findConfig } from './config-finder.js';

const program = new Command();

program
  .name('forma')
  .description('Pretty-print protobuf binary files to the terminal')
  .version('1.0.0')
  .argument('[file]', 'Protobuf binary file to print (or read from stdin)')
  .option('-s, --schema <file>', 'Schema descriptor file (.desc)')
  .option('-t, --type <name>', 'Root message type name (e.g., .example.Person)')
  .option('--no-color', 'Disable colored output')
  .option('--no-field-numbers', 'Hide field numbers')
  .option('--no-comments', 'Hide comments from presentation data')
  .option('--compact', 'Compact output')
  .option('--json', 'Output as JSON instead of tree')
  .option('--display-unset', 'Display unset/empty fields (hidden by default)')
  .option('--display-types', 'Display type names for message fields (hidden by default)')
  .action(async (file, options) => {
    try {
      await printProto(file, options);
    } catch (error) {
      console.error(pc.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

program.parse();

async function printProto(filePath: string | undefined, options: any) {
  // Read data file
  let dataBytes: Uint8Array;
  if (filePath) {
    dataBytes = await readFile(filePath);
  } else {
    // Read from stdin
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    dataBytes = Buffer.concat(chunks);
  }

  if (dataBytes.length === 0) {
    console.error(pc.yellow('Warning: Empty input'));
    return;
  }

  // Resolve schema and type
  let schemaBytes: Uint8Array | undefined;
  let typeName: string | undefined = options.type;
  let presentationBytes: Uint8Array | undefined;

  // Try to find config file if schema not specified
  if (!options.schema && filePath) {
    const configPath = await findConfig(filePath);
    if (configPath) {
      const config = await loadConfig(configPath, filePath);
      if (config.schemaDescriptor) {
        schemaBytes = await readFile(config.schemaDescriptor);
      }
      if (config.type) {
        typeName = config.type;
      }
      if (config.presentation) {
        try {
          presentationBytes = await readFile(config.presentation);
        } catch (error) {
          // Presentation file is optional
        }
      }
    }
  }

  // Schema from command line overrides config
  if (options.schema) {
    schemaBytes = await readFile(options.schema);
  }

  // Check if we have a schema
  if (!schemaBytes) {
    console.error(pc.red('Error: No schema descriptor found.'));
    console.error('');
    console.error('Provide a schema using one of:');
    console.error('  1. --schema <file.desc>');
    console.error('  2. Create a config.forma.binpb file in a parent directory');
    process.exit(1);
  }

  // Initialize editor
  const editor = new StructuralEditor();
  await editor.initialize({
    data: dataBytes,
    schemaDescriptor: schemaBytes,
    typeName: typeName,
    presentationData: presentationBytes,
  });

  // Check if data was decoded
  if (!editor.decodedData) {
    console.error(pc.red('Error: Failed to decode data'));
    console.error('Make sure the schema matches the data and the type name is correct.');
    process.exit(1);
  }

  // Output format
  if (options.json) {
    // JSON output
    console.log(JSON.stringify(messageToJSON(editor.decodedData), null, 2));
  } else {
    // Pretty tree output
    const formatter = new ProtoFormatter(editor, {
      colors: options.color,
      showFieldNumbers: options.fieldNumbers,
      showComments: options.comments,
      compact: options.compact,
      showUnsetFields: options.displayUnset,
      showTypes: options.displayTypes,
    });

    const output = formatter.format(editor.decodedData, typeName);
    console.log(output);
  }
}

/**
 * Convert MessageValue to plain JSON object
 */
function messageToJSON(msg: any): any {
  if (msg === null || msg === undefined) {
    return null;
  }

  if (typeof msg !== 'object') {
    return msg;
  }

  if (msg instanceof Uint8Array) {
    return Array.from(msg);
  }

  if ('fields' in msg && 'type' in msg) {
    // MessageValue
    const result: any = {};
    for (const [fieldNum, values] of msg.fields.entries()) {
      const fieldDef = msg.type.fields.get(fieldNum);
      if (!fieldDef) continue;

      const jsonValues = values.map((v: any) => messageToJSON(v));
      result[fieldDef.name] = jsonValues.length === 1 ? jsonValues[0] : jsonValues;
    }
    return result;
  }

  return msg;
}

/**
 * Load and parse config file
 */
async function loadConfig(
  configPath: string,
  dataFilePath: string
): Promise<{
  schemaDescriptor?: string;
  type?: string;
  presentation?: string;
}> {
  const configDir = dirname(configPath);
  const dataFileName = resolve(dataFilePath);

  // Read and parse config
  const configBytes = await readFile(configPath);
  const { parseConfig } = await import('@lintx/core/dist/forma-parser.js');
  const config = parseConfig(configBytes);

  // Find matching file mapping
  for (const fileMapping of config.files) {
    const mappedDataPath = resolve(configDir, fileMapping.data);
    if (mappedDataPath === dataFileName) {
      return {
        schemaDescriptor: fileMapping.schemaDescriptor
          ? resolve(configDir, fileMapping.schemaDescriptor)
          : undefined,
        type: fileMapping.type || undefined,
        presentation: fileMapping.presentation
          ? resolve(configDir, fileMapping.presentation)
          : undefined,
      };
    }
  }

  // No specific mapping found, return undefined
  return {};
}
