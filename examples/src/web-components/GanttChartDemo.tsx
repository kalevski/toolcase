import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const roadmap = [
    { id: 'design', label: 'Design system', start: '2026-01-05', end: '2026-01-20', progress: 100 },
    { id: 'api', label: 'API contract', start: '2026-01-15', end: '2026-02-05', progress: 80 },
    { id: 'frontend', label: 'Frontend build', start: '2026-01-25', end: '2026-03-01', progress: 55 },
    { id: 'backend', label: 'Backend build', start: '2026-02-01', end: '2026-03-10', progress: 40 },
    { id: 'qa', label: 'QA & hardening', start: '2026-03-05', end: '2026-03-25', progress: 10 },
    { id: 'launch', label: 'Launch', start: '2026-03-25', end: '2026-04-01' },
]

const colored = [
    { id: 'a', label: 'Discovery', start: '2026-02-01', end: '2026-02-10', progress: 100, color: 'var(--tc-success)' },
    { id: 'b', label: 'Prototype', start: '2026-02-08', end: '2026-02-22', progress: 70, color: 'var(--tc-app-accent)' },
    { id: 'c', label: 'Review', start: '2026-02-20', end: '2026-02-28', progress: 30, color: 'var(--tc-warning)' },
]

const GanttChartDemo: React.FC = () => {
    const mainRef = useRef<any>(null)
    const coloredRef = useRef<any>(null)
    const [clicked, setClicked] = useState<string | null>(null)

    useEffect(() => {
        if (coloredRef.current) coloredRef.current.tasks = colored

        const el = mainRef.current
        if (el) {
            el.tasks = roadmap
            const handler = (e: any) =>
                setClicked(`${e.detail.task.label} (${e.detail.task.start} → ${e.detail.task.end})`)
            el.addEventListener('tc-task-click', handler)
            // also exercise the onTaskClick callback property
            el.onTaskClick = (task: any) => console.log('onTaskClick', task.label)
            return () => el.removeEventListener('tc-task-click', handler)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="GanttChart"
                            description="Gantt chart with time-based task bars, progress fills, a date-marker axis, and a horizontally-scrolling body. tasks are set via a JS property; title/subtitle/start-date/end-date/loading are attributes. Each bar is keyboard-reachable; hovering shows a tooltip and clicking/activating one fires tc-task-click and calls the onTaskClick callback."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Project roadmap — progress + click">
                                {/* @ts-ignore */}
                                <tc-gantt-chart
                                    ref={mainRef}
                                    title="Release roadmap"
                                    subtitle="Q1 2026 milestones"
                                />
                                <p className="text-muted small mt-2 mb-0">
                                    Last clicked task: <strong>{clicked ?? 'none'}</strong>
                                </p>
                            </SectionCard>

                            <SectionCard title="Per-task colors + fixed span">
                                {/* @ts-ignore */}
                                <tc-gantt-chart
                                    ref={coloredRef}
                                    title="Sprint plan"
                                    subtitle="start-date / end-date pin the span"
                                    start-date="2026-02-01"
                                    end-date="2026-02-28"
                                />
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-gantt-chart loading title="Loading…" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GanttChartDemo
