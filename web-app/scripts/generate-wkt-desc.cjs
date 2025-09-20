const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const PROTOBUFJS_DIR = path.dirname(require.resolve('protobufjs'))
const WELL_KNOWN_TYPES_DIR = path.join(PROTOBUFJS_DIR, 'google', 'protobuf')
const OUTPUT_DIR = path.resolve(__dirname, '../public')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'well_known_types.desc')

const PROTO_FILES = [
  'any.proto',
  'timestamp.proto',
  'duration.proto',
  // Add any other well-known types you need here
]

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

const protoPaths = PROTO_FILES.map((file) =>
  path.join(WELL_KNOWN_TYPES_DIR, file)
).join(' ')

const protoFiles = PROTO_FILES.map((file) =>
  path.join('google', 'protobuf', file)
).join(' ')

const command = `
  cd ${PROTOBUFJS_DIR} && 
  protoc \
    --descriptor_set_out=${OUTPUT_FILE} \
    --include_imports \
    ${protoFiles}
`

try {
  console.log('Generating Well-Known Types descriptor set...')
  execSync(command, { stdio: 'inherit' })
  console.log(`Successfully generated ${OUTPUT_FILE}`)
} catch (error) {
  console.error('Error generating descriptor set:', error)
  process.exit(1)
}
