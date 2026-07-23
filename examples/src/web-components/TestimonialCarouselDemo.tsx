import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const SAMPLE = [
    {
        id: 't1',
        quote: 'Dropping these custom elements into our stack took an afternoon — no framework wiring, no build gymnastics.',
        author: 'Ada Reyes',
        role: 'Staff Engineer',
        company: 'Northwind',
        rating: 5,
        avatarUrl: 'https://i.pravatar.cc/80?img=47',
    },
    {
        id: 't2',
        quote: 'The slate-neutral design system looks sharp out of the box and themes cleanly with a handful of CSS variables.',
        author: 'Marcus Lin',
        role: 'Design Lead',
        company: 'Helio',
        rating: 4,
        avatarUrl: 'https://i.pravatar.cc/80?img=12',
    },
    {
        id: 't3',
        quote: 'Accessibility was already handled — keyboard nav, focus rings, reduced-motion. That saved us a full review cycle.',
        author: 'Priya Nair',
        role: 'Accessibility Specialist',
        rating: 5,
    },
]

const TestimonialCarouselDemo: React.FC = () => {
    const [lastChange, setLastChange] = useState<string>('—')

    const manualRef = useTc<HTMLElement>(
        { items: SAMPLE },
        {
            'tc-change': (e: any) => {
                setLastChange(`index ${e.detail.index} (id: ${e.detail.id})`)
            },
        }
    )
    const autoplayRef = useTc<HTMLElement>({ items: SAMPLE })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Testimonial Carousel"
                            description="One testimonial at a time with prev/next arrow controls and a row of dot indicators. Supports autoplay, keyboard navigation, and ratings."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Manual navigation (arrows + dots)">
                                <p className="text-muted small mb-3">
                                    Use the arrows, click a dot, or focus the carousel and press ← /
                                    →. Last <code>tc-change</code>: {lastChange}
                                </p>
                                {/* @ts-ignore */}
                                <tc-testimonial-carousel
                                    ref={manualRef}
                                    aria-label="Customer testimonials"
                                />
                            </tc-section-card>

                            <tc-section-card title="Autoplay (interval=3000ms)">
                                <p className="text-muted small mb-3">
                                    Auto-advances every 3 seconds. Pauses on hover, on focus, and
                                    when the tab is hidden.
                                </p>
                                {/* @ts-ignore */}
                                <tc-testimonial-carousel
                                    ref={autoplayRef}
                                    autoplay
                                    interval="3000"
                                    aria-label="Autoplaying customer testimonials"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TestimonialCarouselDemo
