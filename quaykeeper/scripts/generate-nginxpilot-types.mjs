#!/usr/bin/env node
// Generate TypeScript types from a running nginxpilot's OpenAPI document
// (quaykeeper_better.md C3). The daemon serves GET /schema (hand-kept, CI-linted
// against its route table); this fetches it and runs openapi-typescript, so the
// generated types can progressively replace the hand-mirrored interfaces in
// server/infrastructure/nginxpilot.ts — retiring the B4 fixture drift class.
//
// Usage:
//   node scripts/generate-nginxpilot-types.mjs [schemaUrl] [outFile]
//
// Defaults: schemaUrl = $QUAYKEEPER_NGINXPILOT_ADMIN_URL/schema (or http://127.0.0.1:9090/schema),
//           outFile   = server/infrastructure/nginxpilot-schema.d.ts
//
// Intended for CI (after booting the daemon) or local dev with a daemon running.
// The output is generated — do not hand-edit.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const base = process.env.QUAYKEEPER_NGINXPILOT_ADMIN_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:9090'
const schemaUrl = process.argv[2] || `${base}/schema`
const outFile = process.argv[3] || 'server/infrastructure/nginxpilot-schema.d.ts'

const res = await fetch(schemaUrl)
if (!res.ok) {
    console.error(`GET ${schemaUrl} failed: ${res.status}`)
    process.exit(1)
}
const doc = await res.json()
if (doc.openapi !== '3.1.0' || !doc.paths) {
    console.error(`GET ${schemaUrl} did not return an OpenAPI 3.1 document`)
    process.exit(1)
}

const dir = mkdtempSync(path.join(tmpdir(), 'nginxpilot-schema-'))
const schemaFile = path.join(dir, 'schema.json')
try {
    writeFileSync(schemaFile, JSON.stringify(doc, null, 2))
    execFileSync('npx', ['-y', 'openapi-typescript@7', schemaFile, '-o', outFile], {
        stdio: 'inherit',
    })
    console.log(`generated ${outFile} from ${schemaUrl} (${Object.keys(doc.paths).length} paths)`)
} finally {
    rmSync(dir, { recursive: true, force: true })
}
