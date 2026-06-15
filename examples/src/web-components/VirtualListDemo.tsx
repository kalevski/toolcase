import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

interface Row {
    id: number
    name: string
    sha: string
}

function makeRows(start: number, count: number): Row[] {
    const rows: Row[] = []
    for (let i = 0; i < count; i++) {
        const id = start + i
        rows.push({
            id,
            name: `commit-${id.toString().padStart(5, '0')}`,
            sha: (id * 2654435761 % 0xffffff).toString(16).padStart(6, '0'),
        })
    }
    return rows
}

const FixedDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const countRef = useRef(10000)
    const [count, setCount] = useState(10000)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        el.itemHeight = 36
        el.items = makeRows(1, countRef.current)
        el.renderItem = (item: Row, index: number) => {
            const wrap = document.createElement('div')
            wrap.style.cssText = 'display:flex;align-items:center;gap:0.75rem;width:100%;font-family:var(--tc-font-mono);font-size:0.8125rem'
            wrap.innerHTML =
                `<span style="color:var(--tc-text-faint);width:3.5rem">#${index + 1}</span>` +
                `<span style="color:var(--tc-text);flex:1">${item.name}</span>` +
                `<span style="color:var(--tc-text-muted)">${item.sha}</span>`
            return wrap
        }

        // Lazy loading: append another page when the bottom is reached.
        const onEnd = () => {
            const next = countRef.current + 5000
            countRef.current = next
            el.items = makeRows(1, next)
            setCount(next)
        }
        el.addEventListener('tc-end-reached', onEnd)
        return () => el.removeEventListener('tc-end-reached', onEnd)
    }, [])

    return (
        <SectionCard title="10,000 rows — fixed height, lazy loading on scroll-to-end">
            {/* @ts-ignore */}
            <tc-virtual-list ref={ref} height="360" overscan="4" end-reached-threshold="240" />
            <p className="mt-2 mb-0" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                {count.toLocaleString()} rows loaded — only the visible window lives in the DOM. Scroll to the
                bottom to append 5,000 more.
            </p>
        </SectionCard>
    )
}

const VariableDemo: React.FC = () => {
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        const items = makeRows(1, 2000)
        // Variable row heights via a per-index function (cumulative offset table).
        el.itemHeight = (index: number) => 40 + (index % 4) * 18
        el.items = items
        el.renderItem = (item: Row, index: number) => {
            const lines = (index % 4) + 1
            const wrap = document.createElement('div')
            wrap.style.cssText = 'width:100%'
            const body = Array.from({ length: lines })
                .map(() => `<div style="color:var(--tc-text-muted);font-size:0.75rem">Detail line for ${item.name}</div>`)
                .join('')
            wrap.innerHTML =
                `<div style="font-weight:500;color:var(--tc-text);font-size:0.8125rem">${item.name}</div>` + body
            return wrap
        }
    }, [])

    return (
        <SectionCard title="Variable row heights (2,000 rows)">
            {/* @ts-ignore */}
            <tc-virtual-list ref={ref} height="320" />
            <p className="mt-2 mb-0" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                <code>itemHeight</code> is a function returning a different height per index; a cumulative
                offset table keeps scrolling accurate.
            </p>
        </SectionCard>
    )
}

const VirtualListDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="VirtualList"
                            description="Windowed scroll viewport for large datasets. Set the items, itemHeight (fixed px or a per-index function), and a renderItem callback as JS properties; only the visible rows (plus an overscan margin) are kept in the DOM. Listen for tc-end-reached to lazy-load more."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <FixedDemo />
                            <VariableDemo />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VirtualListDemo
