import React, { useEffect, useRef, useState } from 'react'

const PAGE_SIZE = 10
const MAX_PAGES = 5

function createItemEl(text: string): HTMLDivElement {
    const el = document.createElement('div')
    el.dataset.demoItem = 'true'
    el.style.cssText =
        'padding:0.6rem 1rem;border-bottom:1px solid var(--tc-border);font-size:0.875rem;font-family:var(--tc-font-mono)'
    el.textContent = text
    return el
}

const InfiniteScrollDemo: React.FC = () => {
    const scrollRef = useRef<any>(null)
    const pageRef = useRef(0)
    const loadingRef = useRef(false)
    const [status, setStatus] = useState('Page 1 of 5 — scroll down')

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        // Seed the first page of items as direct children of the element itself —
        // tc-infinite-scroll no longer wraps consumer content in a container; the
        // sentinel/loading/end rows order themselves after these via CSS `order`.
        const alreadySeeded = el.querySelector('[data-demo-item]') != null
        if (!alreadySeeded) {
            for (let i = 1; i <= PAGE_SIZE; i++) {
                el.appendChild(createItemEl(`Item ${i}`))
            }
        }

        const handleLoadMore = () => {
            if (loadingRef.current) return
            loadingRef.current = true
            el.setAttribute('loading', '')

            setTimeout(() => {
                const nextPage = pageRef.current + 1
                pageRef.current = nextPage
                const base = nextPage * PAGE_SIZE
                for (let i = 1; i <= PAGE_SIZE; i++) {
                    el.appendChild(createItemEl(`Item ${base + i}`))
                }
                if (nextPage >= MAX_PAGES - 1) {
                    el.removeAttribute('has-more')
                    setStatus('All 5 pages loaded')
                } else {
                    setStatus(`Page ${nextPage + 1} of ${MAX_PAGES} — scroll down`)
                }
                el.removeAttribute('loading')
                loadingRef.current = false
            }, 800)
        }

        el.addEventListener('tc-load-more', handleLoadMore)
        return () => el.removeEventListener('tc-load-more', handleLoadMore)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="InfiniteScroll"
                            description="Intersection Observer wrapper that fires tc-load-more when the sentinel enters the viewport. Set has-more to keep loading; remove it to show the end slot. The loading slot appears while fetching."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Scroll to load more (5 pages × 10 items)">
                                <div
                                    style={{
                                        maxHeight: 400,
                                        overflowY: 'auto',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-infinite-scroll ref={scrollRef} has-more="">
                                        {/* @ts-ignore */}
                                    </tc-infinite-scroll>
                                </div>
                                <p
                                    className="mt-2 mb-0"
                                    style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}
                                >
                                    {status}
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Custom loading and end slots">
                                <div
                                    style={{
                                        maxHeight: 300,
                                        overflowY: 'auto',
                                        border: '1px solid var(--tc-border)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-infinite-scroll>
                                        <div
                                            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
                                        >
                                            Alpha
                                        </div>
                                        <div
                                            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
                                        >
                                            Beta
                                        </div>
                                        <div
                                            style={{ padding: '0.6rem 1rem', fontSize: '0.875rem' }}
                                        >
                                            Gamma
                                        </div>
                                        <div
                                            data-slot="loading"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                color: 'var(--tc-text-muted)',
                                                fontSize: '0.8125rem',
                                            }}
                                        >
                                            ⏳ Fetching more…
                                        </div>
                                        <div
                                            data-slot="end"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                color: 'var(--tc-text-faint)',
                                                fontSize: '0.75rem',
                                                textAlign: 'center',
                                            }}
                                        >
                                            — No more items —
                                        </div>
                                        {/* @ts-ignore */}
                                    </tc-infinite-scroll>
                                </div>
                                <p
                                    className="mt-2 mb-0"
                                    style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}
                                >
                                    No <code>has-more</code> attribute — end slot is shown
                                    immediately.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InfiniteScrollDemo
