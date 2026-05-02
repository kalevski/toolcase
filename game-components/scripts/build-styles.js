import { compile } from 'sass'
import { readdir, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const STYLE_DIR = join(ROOT, 'style')
const OUT_DIR = STYLE_DIR

if (!existsSync(STYLE_DIR)) {
    console.warn('[build-styles] no style/ directory; skipping.')
    process.exit(0)
}

const entries = await readdir(STYLE_DIR)
const targets = entries.filter((entry) => entry.endsWith('.scss') && !entry.startsWith('_'))

let count = 0
for (const file of targets) {
    const name = basename(file, '.scss')
    const src = join(STYLE_DIR, file)
    const result = compile(src, { style: 'compressed', loadPaths: [STYLE_DIR] })
    await writeFile(join(OUT_DIR, `${name}.styles.css`), result.css, 'utf8')
    count++
}
console.log(`[build-styles] compiled ${count} stylesheet${count === 1 ? '' : 's'}`)
