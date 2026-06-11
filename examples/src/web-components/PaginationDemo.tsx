import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function usePaginationPage(initial: number): [number, React.RefObject<any>] {
    const [current, setCurrent] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => setCurrent((e as CustomEvent).detail.page)
        el.addEventListener('tc-page-change', handler)
        return () => el.removeEventListener('tc-page-change', handler)
    }, [])

    return [current, ref]
}

const PaginationDemo: React.FC = () => {
    const [page1, ref1] = usePaginationPage(1)
    const [page2, ref2] = usePaginationPage(5)
    const [page3, ref3] = usePaginationPage(3)
    const [page4, ref4] = usePaginationPage(4)
    const [page5, ref5] = usePaginationPage(1)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Pagination"
                            description="Bootstrap pagination wrapper. Set total for page count, current for the active page (1-based), and max-visible to control the window of visible page links (with automatic ellipsis). Use size for sm/lg variants, and align for flex alignment."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — 10 pages, active page updates on click">
                                {/* @ts-ignore */}
                                <tc-pagination ref={ref1} total="10" current="1" />
                                <p className="mt-2 text-muted small">Current page: {page1}</p>
                            </SectionCard>

                            <SectionCard title="max-visible=5 — windowed with ellipses">
                                {/* @ts-ignore */}
                                <tc-pagination ref={ref2} total="20" current="5" max-visible="5" />
                                <p className="mt-2 text-muted small">Current page: {page2}</p>
                            </SectionCard>

                            <SectionCard title="size=sm — small pagination">
                                {/* @ts-ignore */}
                                <tc-pagination ref={ref3} total="8" current="3" size="sm" />
                                <p className="mt-2 text-muted small">Current page: {page3}</p>
                            </SectionCard>

                            <SectionCard title="size=lg — large pagination">
                                {/* @ts-ignore */}
                                <tc-pagination ref={ref4} total="8" current="4" size="lg" />
                                <p className="mt-2 text-muted small">Current page: {page4}</p>
                            </SectionCard>

                            <SectionCard title="align=center — centred">
                                {/* @ts-ignore */}
                                <tc-pagination ref={ref5} total="6" current="1" align="center" />
                                <p className="mt-2 text-muted small">Current page: {page5}</p>
                            </SectionCard>

                            <SectionCard title="align=end — right-aligned">
                                {/* @ts-ignore */}
                                <tc-pagination total="6" current="3" align="end" />
                            </SectionCard>

                            <SectionCard title="Single page — prev/next both disabled">
                                {/* @ts-ignore */}
                                <tc-pagination total="1" current="1" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PaginationDemo
