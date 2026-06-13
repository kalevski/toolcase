import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const RECIPES_2COL = [
    {
        title: 'Debounce a function',
        description: 'Delay execution until after a quiet period.',
        code: `function debounce(fn, delay) {\n  let id\n  return (...args) => {\n    clearTimeout(id)\n    id = setTimeout(() => fn(...args), delay)\n  }\n}`,
        language: 'javascript',
        tags: ['utility', 'async'],
        href: '#debounce',
    },
    {
        title: 'Deep clone an object',
        description: 'Create a structurally independent copy without references.',
        code: `const clone = obj => JSON.parse(JSON.stringify(obj))`,
        language: 'javascript',
        tags: ['utility'],
        href: '#clone',
    },
    {
        title: 'Flatten a nested array',
        description: 'Recursively flatten arrays of arbitrary depth.',
        code: `const flat = arr =>\n  arr.reduce((acc, v) =>\n    acc.concat(Array.isArray(v) ? flat(v) : v), [])`,
        language: 'javascript',
        tags: ['array', 'utility'],
    },
    {
        title: 'Group array by key',
        description: 'Group an array of objects by a shared property.',
        code: `const groupBy = (arr, key) =>\n  arr.reduce((acc, item) => {\n    const g = item[key]\n    ;(acc[g] = acc[g] || []).push(item)\n    return acc\n  }, {})`,
        language: 'javascript',
        tags: ['array', 'object'],
    },
]

const RECIPES_3COL = [
    {
        title: 'Sleep / delay',
        description: 'Promise-based delay helper.',
        code: `const sleep = ms =>\n  new Promise(r => setTimeout(r, ms))`,
        language: 'typescript',
        tags: ['async'],
    },
    {
        title: 'Clamp a number',
        code: `const clamp = (n, min, max) =>\n  Math.min(Math.max(n, min), max)`,
        language: 'typescript',
        tags: ['math'],
    },
    {
        title: 'Unique array items',
        description: 'Remove duplicate values from an array.',
        code: `const unique = arr => [...new Set(arr)]`,
        language: 'typescript',
        tags: ['array'],
    },
    {
        title: 'Pick object keys',
        code: `const pick = (obj, keys) =>\n  Object.fromEntries(\n    keys.map(k => [k, obj[k]])\n  )`,
        language: 'typescript',
        tags: ['object'],
    },
    {
        title: 'Chunk an array',
        description: 'Split array into fixed-size chunks.',
        code: `const chunk = (arr, n) =>\n  Array.from({ length: Math.ceil(arr.length / n) },\n    (_, i) => arr.slice(i * n, i * n + n))`,
        language: 'typescript',
        tags: ['array'],
    },
    {
        title: 'Omit object keys',
        code: `const omit = (obj, keys) =>\n  Object.fromEntries(\n    Object.entries(obj).filter(([k]) => !keys.includes(k))\n  )`,
        language: 'typescript',
        tags: ['object'],
    },
]

const CookbookGridDemo: React.FC = () => {
    const twoColRef = useRef<any>(null)
    const threeColRef = useRef<any>(null)
    const noTitleRef = useRef<any>(null)
    const slotTitleRef = useRef<any>(null)

    useEffect(() => {
        if (twoColRef.current) twoColRef.current.recipes = RECIPES_2COL
    }, [])

    useEffect(() => {
        if (threeColRef.current) threeColRef.current.recipes = RECIPES_3COL
    }, [])

    useEffect(() => {
        if (noTitleRef.current) noTitleRef.current.recipes = RECIPES_2COL.slice(0, 2)
    }, [])

    useEffect(() => {
        if (slotTitleRef.current) slotTitleRef.current.recipes = RECIPES_2COL.slice(0, 2)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CookbookGrid"
                            description="Multi-column grid of code-recipe cards with title, description, code snippet, and tags. Set recipes via the JS property. Linked cards animate on hover."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="2-column layout (columns=2, title attribute, linked cards)">
                                {/* @ts-ignore */}
                                <tc-cookbook-grid ref={twoColRef} columns="2" title="JS Recipes" />
                            </SectionCard>

                            <SectionCard title="3-column layout (columns=3)">
                                {/* @ts-ignore */}
                                <tc-cookbook-grid ref={threeColRef} columns="3" title="TypeScript Snippets" />
                            </SectionCard>

                            <SectionCard title="No title attribute">
                                {/* @ts-ignore */}
                                <tc-cookbook-grid ref={noTitleRef} columns="2" />
                            </SectionCard>

                            <SectionCard title="Title via slot">
                                {/* @ts-ignore */}
                                <tc-cookbook-grid ref={slotTitleRef} columns="2">
                                    <span slot="title" style={{ fontStyle: 'italic', fontWeight: 600 }}>
                                        Slotted heading
                                    </span>
                                </tc-cookbook-grid>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CookbookGridDemo
