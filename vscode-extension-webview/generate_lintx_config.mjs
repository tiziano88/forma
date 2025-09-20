// DEPRECATED: Generate a binary .lintx config using protobufjs
// This script still uses protobufjs for utility purposes only
// Usage examples:
//  - Single mapping:
//    node structural-editor/generate_lintx_config.mjs --data a.bin --schema a.proto --type pkg.Root --out lintx.lintx
//  - Multiple mappings:
//    node structural-editor/generate_lintx_config.mjs --map data=a.bin,schema=a.proto,type=pkg.A --map data=b.bin,schema=b.proto,type=pkg.B --out lintx.lintx
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as protobuf from 'protobufjs'

const LINTX_PROTO = `syntax = "proto3"; package lintx; message FileMapping { string data = 1; string schema = 2; string type = 3; } message Config { repeated FileMapping files = 1; string data = 10; string schema = 11; string type = 12; }`

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val =
        argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      if (args[key] !== undefined) {
        // support repeated --map
        if (Array.isArray(args[key])) args[key].push(val)
        else args[key] = [args[key], val]
      } else {
        args[key] = val
      }
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv)
  const out = args.out ?? 'lintx.lintx'

  const { root } = protobuf.parse(LINTX_PROTO)
  const Config = root.lookupType('lintx.Config')
  const File = root.lookupType('lintx.FileMapping')

  const maps = []
  const mapArgs = Array.isArray(args.map)
    ? args.map
    : args.map
      ? [args.map]
      : []
  for (const v of mapArgs) {
    const parts = String(v)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const m = {}
    for (const p of parts) {
      const idx = p.indexOf('=')
      if (idx > 0) m[p.slice(0, idx)] = p.slice(idx + 1)
    }
    maps.push(m)
  }

  const files = maps.length
    ? maps.map((m) =>
        File.create({ data: m.data, schema: m.schema, type: m.type })
      )
    : [
        File.create({
          data: args.data ?? 'structural-editor/public/sample.bin',
          schema: args.schema ?? 'structural-editor/public/sample.proto',
          type: args.type ?? 'example.Person',
        }),
      ]
  const message = Config.create({ files })

  const buffer = Config.encode(message).finish()
  const outPath = path.resolve(process.cwd(), out)
  await fs.writeFile(outPath, buffer)
  console.log('Wrote', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
