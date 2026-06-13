import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const VisuallyHiddenDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="VisuallyHidden"
                        description="Hides content from sighted users while keeping it in the accessibility tree for screen readers. Use it to label icon-only controls, provide skip links, or add context that assistive technology needs."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Icon button with screen-reader label">
                            <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                The button below looks like an icon button. Sighted users see only the icon; screen readers announce "Close dialog".
                            </p>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                aria-label="Close dialog"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                                <span aria-hidden="true">✕</span>
                                {/* @ts-ignore */}
                                <tc-visually-hidden>Close dialog</tc-visually-hidden>
                            </button>
                        </SectionCard>

                        <SectionCard title="Skip link (visually hidden until focused)">
                            <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                A classic skip-navigation pattern. The link is clipped from view but reachable by keyboard — Tab into this section to reveal it.
                            </p>
                            <div style={{ position: 'relative', minHeight: '48px' }}>
                                {/* @ts-ignore */}
                                <tc-visually-hidden>
                                    <a href="#main-content" className="btn btn-primary" style={{ position: 'absolute', top: 0, left: 0 }}>
                                        Skip to main content
                                    </a>
                                {/* @ts-ignore */}
                                </tc-visually-hidden>
                                <span style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                    (Tab here — the skip link becomes visible on focus via the browser's default focus-visible styles)
                                </span>
                            </div>
                        </SectionCard>

                        <SectionCard title="as=&quot;span&quot; (default) — inline context">
                            <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                Use the default <code>as="span"</code> to annotate inline elements without introducing block-level structure.
                            </p>
                            <button type="button" className="btn btn-primary">
                                Save
                                {/* @ts-ignore */}
                                <tc-visually-hidden> — saves your current document</tc-visually-hidden>
                            </button>
                        </SectionCard>

                        <SectionCard title="as=&quot;div&quot; — block hidden region">
                            <p className="mb-3" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                Use <code>as="div"</code> when the hidden content is a block-level region (e.g. a landmark description or a live region).
                            </p>
                            <div role="status" aria-live="polite">
                                {/* @ts-ignore */}
                                <tc-visually-hidden as="div">
                                    3 items loaded successfully.
                                {/* @ts-ignore */}
                                </tc-visually-hidden>
                                <span style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                    (A live region — screen readers will announce "3 items loaded successfully" when this updates)
                                </span>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default VisuallyHiddenDemo
