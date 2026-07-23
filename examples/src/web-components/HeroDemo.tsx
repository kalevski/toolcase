import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const HeroDemo: React.FC = () => {
    // Blueprint split — two-column hero with a framed preview panel on the right,
    // mirroring the "vector blueprint" landing hero.
    const blueprintRef = useTc<HTMLElement>({
        primaryAction: {
            label: 'Insert coin — start free',
            icon: 'Zap',
            href: '#',
        },
        secondaryAction: {
            label: 'Watch tour',
            icon: 'Play',
            href: '#',
        },
    })

    const basicRef = useTc<HTMLElement>({
        primaryAction: { label: 'Get Started', href: '#' },
        secondaryAction: { label: 'View Docs', href: '#' },
    })

    // Mirrors the react Hero demo's "Full Featured" scenario: eyebrow, title,
    // description, both actions, stat cards AND a centered metrics band.
    const fullRef = useTc<HTMLElement>(
        {
            primaryAction: {
                label: 'Get Started Free',
                onClick: () => console.log('primary action clicked'),
            },
            secondaryAction: {
                label: 'View Docs',
                onClick: () => console.log('secondary action clicked'),
            },
            statCards: [
                { label: 'Active players', value: '12,482' },
                { label: 'Avg. session time', value: '32m' },
                { label: 'Retention', value: '91%' },
            ],
            metrics: [
                { label: 'studio teams', value: '180+' },
                { label: 'ms response', value: '28ms' },
                { label: 'uptime', value: '99.99%' },
            ],
        },
        {
            'tc-action': (e: CustomEvent) => {
                console.log('tc-action', e.detail)
            },
        }
    )

    // Mirrors the react Hero demo's "Minimal (No Stats)" scenario.
    const minimalRef = useTc<HTMLElement>({
        primaryAction: { label: 'Start Building', href: '#' },
    })

    const statsRef = useTc<HTMLElement>({
        primaryAction: { label: 'View Stats', href: '#' },
        statCards: [
            { label: 'Downloads', value: '1.2M' },
            { label: 'Stars', value: '8.4K' },
            { label: 'Contributors', value: '142' },
            { label: 'Releases', value: '38' },
        ],
    })

    const metricsRef = useTc<HTMLElement>({
        primaryAction: { label: 'Get Started', href: '#' },
        metrics: [
            { label: 'Build time', value: '83s' },
            { label: 'Bundle size', value: '142kb' },
            { label: 'Coverage', value: '91%' },
            { label: 'Type errors', value: '0' },
        ],
    })

    const bgIconsRef = useTc<HTMLElement>({
        primaryAction: { label: 'Explore', href: '#' },
        secondaryAction: { label: 'Learn More', href: '#' },
        bgIcons: ['Zap', 'Shield', 'Code', 'Globe', 'Package', 'Star', 'Lock'],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Hero"
                            description="Large hero section with eyebrow, title, description, primary/secondary actions, optional background icons, stat cards, and metrics."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Blueprint split — two columns, preview panel, note + action icons">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={blueprintRef}
                                    eyebrow="Cloud console for web gaming"
                                    title="Build worlds. We run the backend."
                                    description="Store the art, pack the bundles, build every version, tune the live game, run the team — one console handles the machinery behind your web games."
                                    note="Free indie plan · No card · 1UP when you grow"
                                    preview
                                    backdrop="grid"
                                    media-label="Live build"
                                    media-caption="vector-thrust · world.js"
                                />
                            </tc-section-card>

                            <tc-section-card title="Basic — title, description, actions (href)">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={basicRef}
                                    eyebrow="Open Source"
                                    title="Build faster with toolcase"
                                    description="A curated collection of framework-free web components and utilities for modern product teams."
                                />
                            </tc-section-card>

                            <tc-section-card title="Full Featured — eyebrow, title, description, actions (onClick), stat cards + metrics + tc-action event">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={fullRef}
                                    eyebrow="Now in public beta"
                                    title="Ship your web games faster"
                                    description="A cloud platform built for indie game developers. Host, deploy and scale your browser games with zero infrastructure headaches."
                                />
                            </tc-section-card>

                            <tc-section-card title="Minimal (No Stats) — title, description, single action">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={minimalRef}
                                    title="Build amazing games"
                                    description="Everything you need to create, test, and publish browser-based games."
                                />
                            </tc-section-card>

                            <tc-section-card title="With stat cards">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={statsRef}
                                    title="Trusted by developers worldwide"
                                    description="Thousands of teams rely on toolcase every day."
                                />
                            </tc-section-card>

                            <tc-section-card title="With metrics">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={metricsRef}
                                    eyebrow="Performance first"
                                    title="Built for speed"
                                    description="Optimised build pipeline with full TypeScript coverage and zero runtime dependencies."
                                />
                            </tc-section-card>

                            <tc-section-card title="With background icons">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={bgIconsRef}
                                    eyebrow="Powered by toolcase"
                                    title="Framework-free components"
                                    description="Custom elements that work everywhere — scattered icons appear faintly behind the content."
                                />
                            </tc-section-card>

                            <tc-section-card title="Minimal — title only">
                                {/* @ts-ignore */}
                                <tc-hero title="Simple hero — no extras" />
                            </tc-section-card>

                            <tc-section-card title="title-as attribute (h2 heading)">
                                {/* @ts-ignore */}
                                <tc-hero
                                    title-as="h2"
                                    eyebrow="Section header"
                                    title="Rendered as an h2"
                                    description="Uses the title-as attribute to control the heading level for semantics and accessibility."
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeroDemo
