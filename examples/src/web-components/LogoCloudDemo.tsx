import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const LOGOS_BASIC = [
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',
        alt: 'React',
        width: 56,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',
        alt: 'TypeScript',
        width: 56,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg',
        alt: 'Node.js',
        width: 80,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg',
        alt: 'Vite',
        width: 52,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg',
        alt: 'Vue',
        width: 52,
    },
]

const LOGOS_LINKED = [
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',
        alt: 'React',
        width: 56,
        href: 'https://react.dev',
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',
        alt: 'TypeScript',
        width: 56,
        href: 'https://www.typescriptlang.org',
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg',
        alt: 'Node.js',
        width: 80,
        href: 'https://nodejs.org',
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg',
        alt: 'Vite',
        width: 52,
        href: 'https://vitejs.dev',
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg',
        alt: 'Vue',
        width: 52,
        href: 'https://vuejs.org',
    },
]

const LOGOS_3COL = [
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg',
        alt: 'React',
        width: 56,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Typescript_logo_2020.svg',
        alt: 'TypeScript',
        width: 56,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg',
        alt: 'Node.js',
        width: 80,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Vitejs-logo.svg',
        alt: 'Vite',
        width: 52,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/9/95/Vue.js_Logo_2.svg',
        alt: 'Vue',
        width: 52,
    },
    {
        src: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Svelte_Logo.svg',
        alt: 'Svelte',
        width: 44,
    },
]

const LogoCloudDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({ logos: LOGOS_BASIC })
    const grayscaleRef = useTc<HTMLElement>({ logos: LOGOS_BASIC })
    const linkedRef = useTc<HTMLElement>({ logos: LOGOS_LINKED })
    const threeColRef = useTc<HTMLElement>({ logos: LOGOS_3COL })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LogoCloud"
                            description="Grid of logos with an optional section title, grayscale filter, and optional links. Set logos via the JS property. Use the grayscale attribute for a desaturated-at-rest presentation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (5 columns, title attribute)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={basicRef} title="Trusted by teams using" />
                            </tc-section-card>

                            <tc-section-card title="Grayscale variant (hover to reveal color)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={grayscaleRef} title="Built with" grayscale />
                            </tc-section-card>

                            <tc-section-card title="Linked logos (opens in new tab, 5 columns)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={linkedRef} title="Powered by" />
                            </tc-section-card>

                            <tc-section-card title="Custom column count (columns=3)">
                                {/* @ts-ignore */}
                                <tc-logo-cloud ref={threeColRef} columns="3" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LogoCloudDemo
