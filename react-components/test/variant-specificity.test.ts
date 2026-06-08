import { describe, it, expect } from 'vitest'
import * as sass from 'sass'
import path from 'path'

/**
 * Regression guard for the systemic variant-specificity bug (improvements/09):
 *
 * Base blocks are written as a double class `.component.component-x` (0,2,0).
 * A root variant modifier written as a single class `.component-x--mod` (0,1,0)
 * always loses to the base, so the variant API is silently dead.
 *
 * Rule enforced here: every root-level modifier selector for a component that
 * has a double-class base must reach specificity >= (0,2,0) in its first
 * compound (i.e. be written doubled: `.component-x.component-x--mod`), and on
 * a specificity tie it must appear after the base rule in source order.
 */

const STYLE_ENTRY = path.resolve(__dirname, '../style/index.scss')

describe('variant modifier specificity', () => {
    const css = sass.compileString(`@use 'components/index';`, {
        loadPaths: [
            path.dirname(STYLE_ENTRY),
            path.resolve(__dirname, '../../node_modules'),
        ],
        style: 'compressed',
        quietDeps: true,
    }).css

    // flatten: pull selectors out of @media blocks too, preserving order
    const flat: string[] = []
    {
        let current = ''
        for (const ch of css) {
            if (ch === '{') {
                const sel = current.trim()
                if (sel && !sel.startsWith('@')) flat.push(sel)
                current = ''
            } else if (ch === '}') {
                current = ''
            } else {
                current += ch
            }
        }
    }

    const baseIndex = new Map<string, number>()
    flat.forEach((sel, i) => {
        for (const part of sel.split(',')) {
            const m = part.trim().match(/^\.component\.component-([a-z0-9-]+)$/)
            if (m && !baseIndex.has(m[1])) baseIndex.set(m[1], i)
        }
    })

    it('every root modifier outranks (or ties after) its double-class base', () => {
        const violations: string[] = []
        flat.forEach((sel, i) => {
            for (const part of sel.split(',')) {
                const p = part.trim()
                const m = p.match(/^\.component-([a-z0-9-]+?)--[a-z0-9-]+/)
                if (!m) continue
                const name = m[1]
                if (!baseIndex.has(name)) continue
                if (p.includes('__')) continue // element-level modifier, different base
                const compound = p.split(/[\s>~+]/)[0]
                // class-count heuristic for specificity within the first compound
                const classCount = (compound.match(/\./g) || []).length
                if (classCount < 2) {
                    violations.push(`${p} — specificity below base .component.component-${name}`)
                } else if (classCount === 2 && i < (baseIndex.get(name) as number)) {
                    violations.push(`${p} — ties base specificity but appears before the base rule`)
                }
            }
        })
        expect(violations, violations.join('\n')).toEqual([])
    })
})
