import React, { useEffect, useRef } from 'react'

const MENUS = [
    {
        title: 'Product',
        links: [
            { label: 'Features', href: '#' },
            { label: 'Pricing', href: '#' },
            { label: 'Changelog', href: '#' },
            { label: 'Roadmap', href: '#' },
        ],
    },
    {
        title: 'Developers',
        links: [
            { label: 'Documentation', href: '#' },
            { label: 'API Reference', href: '#' },
            { label: 'SDKs', href: '#' },
            { label: 'Status', href: '#' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '#' },
            { label: 'Blog', href: '#' },
            { label: 'Careers', href: '#' },
            { label: 'Contact', href: '#' },
        ],
    },
]

const SOCIAL = [
    { icon: 'github', href: '#', label: 'GitHub' },
    { icon: 'twitter-x', href: '#', label: 'X (Twitter)' },
    { icon: 'linkedin', href: '#', label: 'LinkedIn' },
    { icon: 'youtube', href: '#', label: 'YouTube' },
]

const LEGAL_LINKS = [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
]

const CTA = {
    heading: 'Start building today',
    description: 'Join thousands of developers shipping faster with Toolcase.',
    label: 'Get started free',
    href: '#',
}

const PageFooterDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const noCtaRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)

    useEffect(() => {
        if (fullRef.current) {
            const el = fullRef.current
            el.menus = MENUS
            el.socialLinks = SOCIAL
            el.legalLinks = LEGAL_LINKS
            el.cta = CTA
        }
    }, [])

    useEffect(() => {
        if (noCtaRef.current) {
            const el = noCtaRef.current
            el.menus = MENUS.slice(0, 2)
            el.socialLinks = SOCIAL
            el.legalLinks = LEGAL_LINKS
        }
    }, [])

    useEffect(() => {
        if (minimalRef.current) {
            const el = minimalRef.current
            el.legalLinks = [
                { label: 'Privacy', href: '#' },
                { label: 'Terms', href: '#' },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PageFooter"
                            description="Full-site footer with brand column, navigation menus, social links, optional CTA block, and a legal bar. Menus, socialLinks, legalLinks, and cta are set via JS properties."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full footer (CTA + menus + social + legal)">
                                {/* @ts-ignore */}
                                <tc-page-footer
                                    ref={fullRef}
                                    brand="toolcase"
                                    tagline="The open-source UI toolkit"
                                    description="Framework-free components and utilities for ambitious applications."
                                    legal-text="© 2026 Toolcase. All rights reserved."
                                />
                            </tc-section-card>

                            <tc-section-card title="Without CTA (menus + social + legal)">
                                {/* @ts-ignore */}
                                <tc-page-footer
                                    ref={noCtaRef}
                                    brand="toolcase"
                                    tagline="Build faster. Ship better."
                                    description="Open-source components for modern web applications."
                                    legal-text="© 2026 Toolcase, Inc."
                                />
                            </tc-section-card>

                            <tc-section-card title="Minimal (brand + legal text only)">
                                {/* @ts-ignore */}
                                <tc-page-footer
                                    ref={minimalRef}
                                    brand="toolcase"
                                    legal-text="© 2026 Toolcase."
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PageFooterDemo
