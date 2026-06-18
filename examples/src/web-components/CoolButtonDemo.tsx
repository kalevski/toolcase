import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CoolButtonDemo: React.FC = () => {
    const [clicked, setClicked] = useState('')
    const [busy, setBusy] = useState(false)
    const loadingRef = useRef<any>(null)
    const toggleRef = useRef<any>(null)
    const addonLeftRef = useRef<any>(null)
    const addonRightSlotRef = useRef<any>(null)

    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.addEventListener('tc-click', () => setClicked('loading button clicked'))
    }, [])

    // Toggle a real loading cycle so the stable-width behaviour is visible:
    // the button must not grow, shrink, or jump when `loading` flips on/off.
    useEffect(() => {
        const el = toggleRef.current
        if (!el) return
        const handler = () => {
            setBusy(true)
            window.setTimeout(() => setBusy(false), 1600)
        }
        el.addEventListener('tc-click', handler)
        return () => el.removeEventListener('tc-click', handler)
    }, [])

    useEffect(() => {
        if (toggleRef.current) toggleRef.current.loading = busy
    }, [busy])

    useEffect(() => {
        const el = addonLeftRef.current
        if (!el) return
        el.addEventListener('tc-click', () => setClicked('addon-left button clicked'))
    }, [])

    useEffect(() => {
        const el = addonRightSlotRef.current
        if (!el) return
        el.addEventListener('tc-click', () => setClicked('addon-right slot button clicked'))
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CoolButton"
                            description="Grouped button with variants, sizes, loading state, and an optional addon region separated by a 1px divider."
                        />

                        {clicked && (
                            <div className="alert alert-info mt-3">
                                Event: <strong>{clicked}</strong>
                            </div>
                        )}

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Variants">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" label="Primary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" label="Secondary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" label="Success"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="danger" label="Danger"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="warning" label="Warning"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="info" label="Info"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Outline variants">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" outline label="Primary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline label="Secondary"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" outline label="Success"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="danger" outline label="Danger"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="warning" outline label="Warning"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="info" outline label="Info"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Sizes">
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="small" label="Small"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="default" label="Default"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="large" label="Large"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading state">
                                <p className="text-secondary small mb-2">
                                    The spinner is centred over the label and sized to the text. The label is hidden
                                    (not removed), so the button keeps its resting width and stays non-interactive.
                                </p>
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={loadingRef} variant="primary" loading label="Saving…"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" loading label="Processing"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" outline loading label="Uploading"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="small" loading label="Small"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" size="large" loading label="Large"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading — interactive (stable width)">
                                <p className="text-secondary small mb-2">
                                    Click to start a 1.6s task. Watch the button: it does not resize or shift when the
                                    spinner appears or disappears.
                                </p>
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={toggleRef} variant="primary" label="Save changes"></tc-cool-button>
                                    <span className="text-secondary small">{busy ? 'working…' : 'idle'}</span>
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading — combined with an addon">
                                <p className="text-secondary small mb-2">
                                    With a leading addon the spinner replaces the icon glyph; with a trailing addon it
                                    overlays the label and the addon glyph stays put.
                                </p>
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" label="Download" addon="↓" addon-position="left" loading></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" label="Deploy" addon="▶" loading></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline label="Options" addon="▾" loading></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" disabled label="Disabled"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline disabled label="Disabled outline"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Addon — attribute (right, default)">
                                <p className="text-secondary small mb-2">
                                    Addon glyphs are sized to the label and vertically centred against it, with a
                                    consistent gap and a 1px divider.
                                </p>
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary" label="Deploy" addon="▶"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="success" label="Approve" addon="✓"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline label="Options" addon="▾"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Addon — attribute (left)">
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={addonLeftRef} variant="primary" label="Download" addon="↓" addon-position="left"></tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="danger" label="Delete" addon="✕" addon-position="left"></tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Addon — slot children (right)">
                                <p className="text-secondary small mb-2">
                                    Slotted addon content is centred and aligned to the label too — here a mono version
                                    tag and a glyph that inherits the label sizing.
                                </p>
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button ref={addonRightSlotRef} variant="primary">
                                        Publish
                                        {/* @ts-ignore */}
                                        <span slot="addon" style={{ fontFamily: 'var(--tc-font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>v2</span>
                                    </tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="secondary" outline>
                                        Share
                                        {/* @ts-ignore */}
                                        <span slot="addon">↗</span>
                                    </tc-cool-button>
                                </div>
                            </SectionCard>

                            <SectionCard title="Slotted label (default children)">
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="primary">
                                        <strong>Bold label</strong>
                                    </tc-cool-button>
                                    {/* @ts-ignore */}
                                    <tc-cool-button variant="info" outline>
                                        <em>Italic label</em>
                                    </tc-cool-button>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CoolButtonDemo
