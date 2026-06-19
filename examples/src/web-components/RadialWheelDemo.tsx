import React, { useEffect, useRef, useState } from 'react'

const DEFAULT_OPTIONS = [
    { id: 'sword', icon: '⚔', label: 'Sword', color: 'var(--tc-app-accent)' },
    { id: 'bow', icon: '🏹', label: 'Bow', color: '#22c55e' },
    { id: 'staff', icon: '✦', label: 'Staff', color: '#a855f7' },
    { id: 'shield', icon: '🛡', label: 'Shield', color: '#0ea5e9' },
    { id: 'potion', icon: '⚕', label: 'Potion', color: '#ef4444' },
    { id: 'horn', icon: '☩', label: 'Horn (disabled)', disabled: true },
]

const RadialWheelDemo: React.FC = () => {
    const wheelRef = useRef<any>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState<string | null>(null)

    // Set JS-property options on mount.
    useEffect(() => {
        if (!wheelRef.current) return
        wheelRef.current.options = DEFAULT_OPTIONS
    }, [])

    // Mirror React state → [open] attribute.
    useEffect(() => {
        if (!wheelRef.current) return
        if (open) wheelRef.current.setAttribute('open', '')
        else wheelRef.current.removeAttribute('open')
    }, [open])

    // Listen for tc-select and tc-close.
    useEffect(() => {
        const el = wheelRef.current
        if (!el) return
        const onSelect = (e: CustomEvent) => {
            setLast(`tc-select — id: "${e.detail.id}"`)
            setOpen(false)
        }
        const onClose = () => setOpen(false)
        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-close', onClose)
        return () => {
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-close', onClose)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Radial Wheel"
                            description="Modal radial (pie) item / ability selector. Options are set via the JS options property. Hover shows a label in the centre; Escape and backdrop click close the wheel. All cosmetics flow through --bs-radial-wheel-* custom properties."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — 6 options (one disabled)">
                                <p className="text-muted mb-3">
                                    Click the button to open the wheel. Hover over a segment to see
                                    its label in the centre. Click an option to select it; click the
                                    backdrop or press <kbd>Escape</kbd> to dismiss.
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-primary me-3"
                                    onClick={() => setOpen(true)}
                                >
                                    Open wheel
                                </button>
                                {last && (
                                    <span className="text-muted">
                                        Last event: <code>{last}</code>
                                    </span>
                                )}

                                {/* The wheel renders as a fixed overlay so it can live anywhere in the tree. */}
                                {/* @ts-ignore */}
                                <tc-radial-wheel
                                    ref={wheelRef}
                                    radius="120"
                                    option-size="56"
                                    center-label="Choose"
                                />
                            </tc-section-card>

                            <tc-section-card title="Smaller radius + no center label">
                                <SmallWheelExample />
                            </tc-section-card>

                            <tc-section-card title="Paginated — many options across pages">
                                <p className="text-muted mb-3">
                                    With more options than <code>per-page</code> (here 8), the wheel
                                    pages through groups. Use the centred dot indicator below the
                                    disc, or the <kbd>←</kbd>/<kbd>→</kbd> arrow keys, to switch
                                    pages. The hub shows the current page when nothing is hovered.
                                </p>
                                <PaginatedWheelExample />
                            </tc-section-card>

                            <tc-section-card title="Custom properties">
                                <pre
                                    className="text-muted"
                                    style={{ fontSize: '0.8rem' }}
                                >{`tc-radial-wheel {
  --bs-radial-wheel-backdrop-opacity: 0.7;
  --bs-radial-wheel-disc-bg: var(--tc-ink);
  --bs-radial-wheel-option-bg: var(--tc-surface-muted);
  --bs-radial-wheel-option-hover-color: var(--tc-accent);
}`}</pre>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

/** Secondary demo — smaller wheel, no center label, fewer options. */
const SmallWheelExample: React.FC = () => {
    const ref = useRef<any>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState<string | null>(null)

    useEffect(() => {
        if (!ref.current) return
        ref.current.options = [
            { id: 'fire', icon: '🔥', label: 'Fire' },
            { id: 'ice', icon: '❄', label: 'Ice' },
            { id: 'storm', icon: '⚡', label: 'Storm' },
            { id: 'earth', icon: '🪨', label: 'Earth' },
        ]
    }, [])

    useEffect(() => {
        if (!ref.current) return
        if (open) ref.current.setAttribute('open', '')
        else ref.current.removeAttribute('open')
    }, [open])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (e: CustomEvent) => {
            setLast(e.detail.id)
            setOpen(false)
        }
        const onClose = () => setOpen(false)
        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-close', onClose)
        return () => {
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-close', onClose)
        }
    }, [])

    return (
        <>
            <button
                type="button"
                className="btn btn-outline-secondary me-3"
                onClick={() => setOpen(true)}
            >
                Open wheel (radius=80)
            </button>
            {last && (
                <span className="text-muted">
                    Selected: <code>{last}</code>
                </span>
            )}
            {/* @ts-ignore */}
            <tc-radial-wheel ref={ref} radius="80" option-size="48" />
        </>
    )
}

/** Pagination demo — 14 options paged 8-at-a-time across two wheels. */
const PaginatedWheelExample: React.FC = () => {
    const ref = useRef<any>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState<string | null>(null)

    useEffect(() => {
        if (!ref.current) return
        ref.current.options = [
            { id: 'sword', icon: '⚔', label: 'Sword' },
            { id: 'axe', icon: '🪓', label: 'Axe' },
            { id: 'bow', icon: '🏹', label: 'Bow' },
            { id: 'staff', icon: '✦', label: 'Staff' },
            { id: 'shield', icon: '🛡', label: 'Shield' },
            { id: 'potion', icon: '⚕', label: 'Potion' },
            { id: 'bomb', icon: '💣', label: 'Bomb' },
            { id: 'key', icon: '🗝', label: 'Key' },
            { id: 'map', icon: '🗺', label: 'Map' },
            { id: 'torch', icon: '🔦', label: 'Torch' },
            { id: 'rope', icon: '➰', label: 'Rope' },
            { id: 'scroll', icon: '📜', label: 'Scroll' },
            { id: 'gem', icon: '💎', label: 'Gem' },
            { id: 'ring', icon: '💍', label: 'Ring' },
        ]
    }, [])

    useEffect(() => {
        if (!ref.current) return
        if (open) ref.current.setAttribute('open', '')
        else ref.current.removeAttribute('open')
    }, [open])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (e: CustomEvent) => {
            setLast(e.detail.id)
            setOpen(false)
        }
        const onClose = () => setOpen(false)
        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-close', onClose)
        return () => {
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-close', onClose)
        }
    }, [])

    return (
        <>
            <button type="button" className="btn btn-primary me-3" onClick={() => setOpen(true)}>
                Open wheel (14 options, per-page=8)
            </button>
            {last && (
                <span className="text-muted">
                    Selected: <code>{last}</code>
                </span>
            )}
            {/* @ts-ignore */}
            <tc-radial-wheel
                ref={ref}
                radius="120"
                option-size="52"
                per-page="8"
                center-label="Inventory"
            />
        </>
    )
}

export default RadialWheelDemo
