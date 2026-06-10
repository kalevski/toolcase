'use client'

// C3 — workspace search palette (Cmd/Ctrl+K): one box over tasks, knowledge,
// notes; results grouped by type; Enter / click deep-links into the owning page
// (?open=<id> is picked up by the target client).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Kbd, Text } from '@toolcase/react-components'
import type { SearchDocType, SearchHit } from '@/server/domain/types'
import { useProject } from '../ProjectContext'

const TYPE_LABEL: Record<SearchDocType, string> = {
    task: 'Tasks',
    knowledge: 'Knowledge',
    note: 'Notes',
}

const TYPE_ORDER: SearchDocType[] = ['task', 'knowledge', 'note']

function hrefFor(project: string, hit: SearchHit): string {
    const page = hit.type === 'task' ? 'tasks' : hit.type === 'knowledge' ? 'knowledge' : 'notes'
    return `/projects/${project}/${page}?open=${encodeURIComponent(hit.id)}`
}

/** Render an FTS5 `<mark>`-delimited snippet without dangerouslySetInnerHTML. */
function Snippet({ text }: { text: string }) {
    const parts = text.split(/<\/?mark>/g)
    return (
        <span className="tf-palette__snippet">
            {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>))}
        </span>
    )
}

export function SearchPalette() {
    const { project } = useProject()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [hits, setHits] = useState<SearchHit[]>([])
    const [available, setAvailable] = useState(true)
    const [active, setActive] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    // global hotkey
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen((v) => !v)
            } else if (e.key === 'Escape') {
                setOpen(false)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    useEffect(() => {
        if (open) {
            setQuery('')
            setHits([])
            setActive(0)
            setTimeout(() => inputRef.current?.focus(), 0)
        }
    }, [open])

    const runSearch = useCallback(
        (q: string) => {
            if (debounce.current) clearTimeout(debounce.current)
            debounce.current = setTimeout(async () => {
                if (!q.trim()) {
                    setHits([])
                    return
                }
                try {
                    const d = await fetch(
                        `/api/projects/${project}/search?q=${encodeURIComponent(q)}`,
                    ).then((r) => (r.ok ? r.json() : null))
                    if (d) {
                        setAvailable(d.available !== false)
                        setHits(d.hits ?? [])
                        setActive(0)
                    }
                } catch {
                    /* transient */
                }
            }, 180)
        },
        [project],
    )

    const grouped = useMemo(() => {
        const flat: { hit: SearchHit; index: number }[] = []
        const groups: { type: SearchDocType; items: { hit: SearchHit; index: number }[] }[] = []
        for (const type of TYPE_ORDER) {
            const items = hits.filter((h) => h.type === type).map((hit) => ({ hit, index: 0 }))
            if (!items.length) continue
            for (const item of items) {
                item.index = flat.length
                flat.push(item)
            }
            groups.push({ type, items })
        }
        return { flat, groups }
    }, [hits])

    const go = useCallback(
        (hit: SearchHit) => {
            setOpen(false)
            router.push(hrefFor(project, hit))
        },
        [project, router],
    )

    const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, grouped.flat.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
        } else if (e.key === 'Enter' && grouped.flat[active]) {
            e.preventDefault()
            go(grouped.flat[active].hit)
        }
    }

    if (!open) return null

    return (
        <div className="tf-palette__backdrop" onClick={() => setOpen(false)}>
            <div className="tf-palette" role="dialog" aria-label="Workspace search" onClick={(e) => e.stopPropagation()}>
                <div className="tf-palette__head">
                    <input
                        ref={inputRef}
                        className="tf-palette__input"
                        placeholder={`Search ${project} tasks, knowledge, notes…`}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            runSearch(e.target.value)
                        }}
                        onKeyDown={onInputKey}
                    />
                    <Kbd>esc</Kbd>
                </div>
                {!available && (
                    <div className="tf-palette__empty">
                        <Text variant="muted">Search unavailable — this runtime&apos;s SQLite lacks FTS5.</Text>
                    </div>
                )}
                {available && query.trim() && grouped.flat.length === 0 && (
                    <div className="tf-palette__empty">
                        <Text variant="muted">No matches.</Text>
                    </div>
                )}
                <div className="tf-palette__results">
                    {grouped.groups.map((g) => (
                        <div key={g.type} className="tf-palette__group">
                            <div className="tf-palette__group-title">{TYPE_LABEL[g.type]}</div>
                            {g.items.map(({ hit, index }) => (
                                <button
                                    key={`${hit.type}:${hit.id}`}
                                    type="button"
                                    className={`tf-palette__row${index === active ? ' tf-palette__row--active' : ''}`}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => go(hit)}
                                >
                                    <span className="tf-palette__row-title">
                                        {hit.title} <Badge variant="secondary" size="sm">{hit.id}</Badge>
                                    </span>
                                    <Snippet text={hit.snippet} />
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
