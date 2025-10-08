# Forma CLI

Pretty-print protobuf binary files to the terminal with colors and tree visualization.

## Installation

```bash
cd /Users/tzn/src/lintx
pnpm install
pnpm --filter @lintx/cli build
```

## Usage

### Basic Usage

```bash
# Using npm script from root
npm run forma <file.binpb> --schema <schema.desc> --type <.full.TypeName>

# Or directly
node cli/dist/index.js <file.binpb> --schema <schema.desc> --type <.full.TypeName>
```

### With Config File

If you have a `config.forma.binpb` file in a parent directory, the CLI will automatically find it:

```bash
npm run forma data.binpb
```

### Options

- `-s, --schema <file>` - Schema descriptor file (.desc)
- `-t, --type <name>` - Root message type name (e.g., `.example.Person`)
- `--no-color` - Disable colored output
- `--no-field-numbers` - Hide field numbers
- `--no-comments` - Hide comments from presentation data
- `--compact` - Compact output (shorter strings, less detail)
- `--json` - Output as JSON instead of tree

### Examples

```bash
# Pretty tree with colors (default)
npm run forma web-app/public/data.binpb \
  --schema web-app/public/rv.binpb \
  --type .oak.attestation.v1.ReferenceValues

# Plain text (no colors)
npm run forma web-app/public/data.binpb \
  --schema web-app/public/rv.binpb \
  --type .oak.attestation.v1.ReferenceValues \
  --no-color

# JSON output
npm run forma web-app/public/data.binpb \
  --schema web-app/public/rv.binpb \
  --type .oak.attestation.v1.ReferenceValues \
  --json

# Read from stdin
cat data.binpb | npm run forma -- --schema schema.desc --type .MyType
```

## Output Format

The CLI displays protobuf messages as a colored tree:

- **Cyan** - Field names
- **Blue** - Message type names
- **Green** - String values
- **Yellow** - Numeric values
- **Magenta** - Boolean values
- **Dim** - Field numbers, metadata, unset fields

```
.oak.attestation.v1.ReferenceValues
├─ oak_containers (2): .oak.attestation.v1.OakContainersReferenceValues
│  ├─ system_layer (3): .oak.attestation.v1.SystemLayerReferenceValues
│  │  └─ system_image (1): (unset)
├─ cb (3): .oak.attestation.v1.CBReferenceValues
│  └─ layers (5): [1 item]
│     └─ [0]: .oak.attestation.v1.EventReferenceValues
│        └─ event (1): .oak.attestation.v1.BinaryReferenceValue
└─ confidential_space (5): .oak.attestation.v1.ConfidentialSpaceReferenceValues
   └─ container_image_reference (3): "test"
```

## Features

- ✅ Tree visualization with box-drawing characters
- ✅ Color-coded output (field names, types, values)
- ✅ Support for all protobuf types (primitives, messages, enums, bytes)
- ✅ Repeated field handling
- ✅ Enum value names
- ✅ Comment display from presentation files
- ✅ JSON output mode
- ✅ Automatic config file discovery
- ✅ Read from file or stdin
- ✅ No-color mode for piping/logging
