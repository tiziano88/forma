const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const GOOGLE_PROTOBUF_DIR = path.dirname(require.resolve('google-protobuf'))
const OUTPUT_DIR = path.resolve(__dirname, '../media/schemas')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'well_known_types.desc')

// Since google-protobuf doesn't include proto files in the same way,
// we'll use protoc's built-in well-known types
const PROTO_FILES = [
  'google/protobuf/any.proto',
  'google/protobuf/timestamp.proto',
  'google/protobuf/duration.proto',
]

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const protoFilePaths = PROTO_FILES.join(' ')

const command = `
  protoc \
    --descriptor_set_out=${OUTPUT_FILE} \
    --include_imports \
    ${protoFilePaths}
`

try {
  console.log(
    'Generating Well-Known Types descriptor set for VS Code extension...'
  )
  execSync(command, { stdio: 'inherit' })
  console.log(`Successfully generated ${OUTPUT_FILE}`)
} catch (error) {
  console.error('Error generating descriptor set:', error)
  process.exit(1)
}
