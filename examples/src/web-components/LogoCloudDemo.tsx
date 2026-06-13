import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const LOGOS_BASIC = [
    { src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', alt: 'React', width: 56 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg', alt: 'TypeScript', width: 56 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg', alt: 'Node.js', width: 80 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg', alt: 'Vite', width: 52 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg', alt: 'Vue', width: 52 },
]

const LOGOS_LINKED = [
    { src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', alt: 'React', width: 56, href: 'https://react.dev' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg', alt: 'TypeScript', width: 56, href: 'https://www.typescriptlang.org' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg', alt: 'Node.js', width: 80, href: 'https://nodejs.org' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg', alt: 'Vite', width: 52, href: 'https://vitejs.dev' },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg', alt: 'Vue', width: 52, href: 'https://vuejs.org' },
]

const LOGOS_3COL = [
    { src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', alt: 'React', width: 56 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg', alt: 'TypeScript', width: 56 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg', alt: 'Node.js', width: 80 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg', alt: 'Vite', width: 52 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg', alt: 'Vue', width: 52 },
    { src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Svelte_Logo.svg', alt: 'Svelte', width: 44 },
]

const LogoCloudDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const grayscaleRef = useRef<any>(null)
    const linkedRef = useRef<any>(null)
    const threeColRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) basicRef.current.logos = LOGOS_BASIC
    }, [])

    useEffect(() => {
        if (grayscaleRef.current) grayscaleRef.current.logos = LOGOS_BASIC
    }, [])

    useEffect(() => {
        if (linkedRef.current) linkedRef.current.logos = LOGOS_LINKED
    }, [])

    useEffect(() => {
        if (threeColRef.current) threeColRef.current.logos = LOGOS_3COL
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="LogoCloud"
                            description="Grid of logos with an optional section title, grayscale filter, and optional links. Set logos via the JS property. Use the grayscale attribute for a desaturated-at-rest presentation."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default (5 columns, title attribute)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={basicRef} title="Trusted by teams using" />
                            </SectionCard>

                            <SectionCard title="Grayscale variant (hover to reveal color)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={grayscaleRef} title="Built with" grayscale />
                            </SectionCard>

                            <SectionCard title="Linked logos (opens in new tab, 5 columns)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={linkedRef} title="Powered by" />
                            </SectionCard>

                            <SectionCard title="Custom column count (columns=3)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={threeColRef} columns="3" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LogoCloudDemo
