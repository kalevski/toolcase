import React, { useEffect, useRef } from 'react'

const ITEMS_FULL = [
    {
        title: 'Zero-dependency bundling',
        description:
            'Ships as pure ESM and CJS — no runtime, no virtual DOM, no framework lock-in.',
        icon: 'package',
    },
    {
        title: 'Design-token driven',
        description:
            'Every cosmetic value flows through --tc-* custom properties so themes are one CSS file.',
        icon: 'palette',
    },
    {
        title: 'Accessibility first',
        description:
            'Landmark roles, aria-labelledby, keyboard focus, and reduced-motion support out of the box.',
        icon: 'accessibility',
    },
    {
        title: 'Composable via slots',
        description:
            'Named media and ctas slots let you drop in any markup — buttons, images, videos — without re-implementing the shell.',
        icon: 'layers',
    },
]

const ITEMS_MINIMAL = [
    {
        title: 'Fast by default',
        description: 'No JavaScript required for layout — CSS does the heavy lifting.',
    },
    {
        title: 'Works everywhere',
        description: 'Drop into React, Vue, Svelte, or plain HTML without a build step.',
    },
    { title: 'Open source', description: 'MIT licensed. Fork it, extend it, ship it.' },
]

const PinnedFeatureShowcaseDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)
    const noIconRef = useRef<any>(null)

    useEffect(() => {
        if (fullRef.current) fullRef.current.items = ITEMS_FULL
        if (minimalRef.current) minimalRef.current.items = ITEMS_MINIMAL
        if (noIconRef.current) {
            noIconRef.current.items = [
                {
                    title: 'Layered architecture',
                    description: 'Each concern lives in its own layer — no tangled abstractions.',
                },
                {
                    title: 'Sharp corners',
                    description:
                        'The design system intentionally avoids border-radius for a precise, professional look.',
                },
                {
                    title: 'Slate neutrals',
                    description:
                        'A consistent palette of slate greys ensures visual harmony across all components.',
                },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PinnedFeatureShowcase"
                            description="Two-column showcase with a sticky/centred left panel and a right-side item list. Set items via the JS items property. Use the media and ctas slots for rich left-panel content."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-5 mt-4">
                            <tc-section-card title="Full showcase (eyebrow, image, CTA buttons, icon items)">
                                {/* @ts-ignore */}
                                <tc-pinned-feature-showcase
                                    ref={fullRef}
                                    eyebrow="Framework-free"
                                    title="Build once, run anywhere"
                                    description="tc-pinned-feature-showcase brings structured feature communication to any stack — React, Vue, Svelte, or plain HTML."
                                    image-src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=640&q=80"
                                    image-alt="Code editor screenshot"
                                >
                                    {/* @ts-ignore */}
                                    <tc-button slot="ctas" variant="primary">
                                        Get started
                                    </tc-button>
                                    {/* @ts-ignore */}
                                    <tc-button slot="ctas" variant="secondary">
                                        View docs
                                    </tc-button>
                                </tc-pinned-feature-showcase>
                            </tc-section-card>

                            <tc-section-card title="Custom media slot (overrides image-src)">
                                {/* @ts-ignore */}
                                <tc-pinned-feature-showcase
                                    eyebrow="Design system"
                                    title="Tokens all the way down"
                                    description="Every cosmetic value is a CSS custom property. Override the defaults with a single stylesheet."
                                    image-src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&q=80"
                                    image-alt="This image is hidden"
                                >
                                    <div
                                        slot="media"
                                        style={{
                                            background: 'var(--tc-surface-muted)',
                                            padding: '2rem',
                                            textAlign: 'center',
                                            fontFamily: 'var(--bs-font-monospace)',
                                            fontSize: '0.875rem',
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        [ custom media slot content ]
                                    </div>
                                    {/* @ts-ignore */}
                                    <tc-button slot="ctas" variant="primary">
                                        Explore tokens
                                    </tc-button>
                                </tc-pinned-feature-showcase>
                            </tc-section-card>

                            <tc-section-card title="Items without icons">
                                {/* @ts-ignore */}
                                <tc-pinned-feature-showcase
                                    ref={noIconRef}
                                    title="Thoughtful by design"
                                    description="Every detail is considered — from spacing to motion to colour contrast."
                                />
                            </tc-section-card>

                            <tc-section-card title="Minimal (title + description + items, no image)">
                                {/* @ts-ignore */}
                                <tc-pinned-feature-showcase
                                    ref={minimalRef}
                                    title="Simple to start"
                                    description="No configuration required. Drop the element in, set items, and you're done."
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PinnedFeatureShowcaseDemo
