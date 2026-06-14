import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const HeroDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const statsRef = useRef<any>(null)
    const metricsRef = useRef<any>(null)
    const bgIconsRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.primaryAction = { label: 'Get Started', href: '#' }
            basicRef.current.secondaryAction = { label: 'View Docs', href: '#' }
        }
    }, [])

    useEffect(() => {
        if (fullRef.current) {
            fullRef.current.primaryAction = {
                label: 'Start for Free',
                onClick: () => console.log('primary action clicked'),
            }
            fullRef.current.secondaryAction = {
                label: 'See Demo',
                onClick: () => console.log('secondary action clicked'),
            }
            fullRef.current.statCards = [
                { label: 'Total Users', value: '12K+' },
                { label: 'Packages', value: '340' },
                { label: 'Uptime', value: '99.9%' },
            ]
            fullRef.current.addEventListener('tc-action', (e: CustomEvent) => {
                console.log('tc-action', e.detail)
            })
        }
    }, [])

    useEffect(() => {
        if (statsRef.current) {
            statsRef.current.primaryAction = { label: 'View Stats', href: '#' }
            statsRef.current.statCards = [
                { label: 'Downloads', value: '1.2M' },
                { label: 'Stars', value: '8.4K' },
                { label: 'Contributors', value: '142' },
                { label: 'Releases', value: '38' },
            ]
        }
    }, [])

    useEffect(() => {
        if (metricsRef.current) {
            metricsRef.current.primaryAction = { label: 'Get Started', href: '#' }
            metricsRef.current.metrics = [
                { label: 'Build time', value: '83s' },
                { label: 'Bundle size', value: '142kb' },
                { label: 'Coverage', value: '91%' },
                { label: 'Type errors', value: '0' },
            ]
        }
    }, [])

    useEffect(() => {
        if (bgIconsRef.current) {
            bgIconsRef.current.primaryAction = { label: 'Explore', href: '#' }
            bgIconsRef.current.secondaryAction = { label: 'Learn More', href: '#' }
            bgIconsRef.current.bgIcons = ['Zap', 'Shield', 'Code', 'Globe', 'Package', 'Star', 'Lock']
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Hero"
                            description="Large hero section with eyebrow, title, description, primary/secondary actions, optional background icons, stat cards, and metrics."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic — title, description, actions (href)">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={basicRef}
                                    eyebrow="Open Source"
                                    title="Build faster with toolcase"
                                    description="A curated collection of framework-free web components and utilities for modern product teams."
                                />
                            </SectionCard>

                            <SectionCard title="Full — eyebrow, title, description, actions (onClick), stat cards + tc-action event">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={fullRef}
                                    eyebrow="Now in beta"
                                    title="Ship production-ready UI in minutes"
                                    description="Drop tc-* elements into any stack — React, Vue, Svelte, or plain HTML. No build step required."
                                />
                            </SectionCard>

                            <SectionCard title="With stat cards">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={statsRef}
                                    title="Trusted by developers worldwide"
                                    description="Thousands of teams rely on toolcase every day."
                                />
                            </SectionCard>

                            <SectionCard title="With metrics">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={metricsRef}
                                    eyebrow="Performance first"
                                    title="Built for speed"
                                    description="Optimised build pipeline with full TypeScript coverage and zero runtime dependencies."
                                />
                            </SectionCard>

                            <SectionCard title="With background icons">
                                {/* @ts-ignore */}
                                <tc-hero
                                    ref={bgIconsRef}
                                    eyebrow="Powered by toolcase"
                                    title="Framework-free components"
                                    description="Custom elements that work everywhere — scattered icons appear faintly behind the content."
                                />
                            </SectionCard>

                            <SectionCard title="Minimal — title only">
                                {/* @ts-ignore */}
                                <tc-hero title="Simple hero — no extras" />
                            </SectionCard>

                            <SectionCard title="title-as attribute (h2 heading)">
                                {/* @ts-ignore */}
                                <tc-hero
                                    title-as="h2"
                                    eyebrow="Section header"
                                    title="Rendered as an h2"
                                    description="Uses the title-as attribute to control the heading level for semantics and accessibility."
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeroDemo
