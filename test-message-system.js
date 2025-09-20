#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Import the core package - use direct import
const { StructuralEditor } = require('./core/dist/StructuralEditor.js');

async function testMessageSystem() {
  console.log('=== Testing MessageType/MessageValue System ===\n');

  try {
    // Create StructuralEditor instance
    const editor = new StructuralEditor();

    // Load sample data
    const dataPath = path.join(__dirname, 'web-app/public/data.binpb');
    const schemaPath = path.join(
      __dirname,
      'vscode-extension/media/schemas/config.desc'
    );

    if (!fs.existsSync(dataPath)) {
      console.log('❌ Sample data file not found:', dataPath);
      return;
    }

    if (!fs.existsSync(schemaPath)) {
      console.log('❌ Schema descriptor file not found:', schemaPath);
      return;
    }

    const dataBytes = fs.readFileSync(dataPath);
    const schemaBytes = fs.readFileSync(schemaPath);

    console.log(
      `📄 Loading data (${dataBytes.length} bytes) and schema (${schemaBytes.length} bytes)...\n`
    );

    // Initialize editor with schema and data
    await editor.initialize({
      data: dataBytes,
      schemaDescriptor: schemaBytes,
      typeName: null, // Will be set after we see available types
    });

    // Show available types
    const availableTypes = editor.getAvailableTypes();
    console.log('🔍 Available message types:');
    availableTypes.forEach((typeName, index) => {
      console.log(`  ${index + 1}. ${typeName}`);
    });

    if (availableTypes.length === 0) {
      console.log('❌ No message types found in schema');
      return;
    }

    // Pick the first available type and parse the data
    const selectedType = availableTypes[0];
    console.log(`\n✅ Selected type: ${selectedType}`);
    await editor.setCurrentType(selectedType);

    // Get the MessageValue and show its structure
    const messageValue = editor.getMessageValue();
    if (messageValue) {
      console.log('\n🎯 Successfully parsed MessageValue!');
      console.log('Fields set:', messageValue.getSetFields());

      // Test field access
      for (const fieldNumber of messageValue.getSetFields()) {
        const fieldDef = messageValue.type.fields.get(fieldNumber);
        if (fieldDef) {
          console.log(
            `  Field ${fieldNumber} (${fieldDef.name}):`,
            fieldDef.label === 3 // LABEL_REPEATED
              ? messageValue.getRepeatedField(fieldNumber)
              : messageValue.getField(fieldNumber)
          );
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testMessageSystem().catch(console.error);
