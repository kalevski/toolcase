import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const GithubStarsCardDemo: React.FC = () => {
    const staticRef = useTc<HTMLElement>({
        stats: {
            stars: 4800,
            forks: 312,
            contributors: 47,
            version: 'v3.2.1',
        },
    })
    const liveRef = useTc<HTMLElement>({
        onStats: (stats: unknown) => {
            console.log('[GithubStarsCard] onStats callback', stats)
        },
    })
    const fullRef = useTc<HTMLElement>(
        {
            stats: {
                stars: 12300,
                forks: 780,
                contributors: 93,
                version: 'v2.0.0',
            },
        },
        {
            'tc-stats': (e: CustomEvent) => {
                console.log('[GithubStarsCard] tc-stats event', e.detail)
            },
            'tc-cta-click': (e: CustomEvent) => {
                console.log('[GithubStarsCard] tc-cta-click event', e.detail)
            },
        },
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="GithubStarsCard"
                            description="GitHub repository card showing stars, forks, contributors, version, and a CTA. Supports pre-fetched stats via the stats JS property or live fetch from the GitHub API via fetch-live."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Static stats (via JS property)">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-github-stars-card
                                        ref={staticRef}
                                        owner="toolcase"
                                        repo="toolcase"
                                        cta-label="Star on GitHub"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Partial stats (stars + version only)">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-github-stars-card
                                        owner="kalevski"
                                        repo="toolcase"
                                        cta-label="View repository"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Full static stats + custom CTA label + event listeners">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-github-stars-card
                                        ref={fullRef}
                                        owner="kalevski"
                                        repo="toolcase"
                                        cta-label="Star this project"
                                        fetch-live
                                    />
                                </div>
                                <p className="mt-2 text-muted" style={{ fontSize: '0.8125rem' }}>
                                    fetch-live is set — card shows a skeleton then populates from
                                    the GitHub API. Pre-set stats appear immediately; live values
                                    override once the fetch resolves. Check the browser console for
                                    tc-stats and tc-cta-click events.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Live fetch (fetch-live attribute — real GitHub API)">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-github-stars-card
                                        ref={liveRef}
                                        owner="microsoft"
                                        repo="vscode"
                                        fetch-live
                                        cta-label="View on GitHub"
                                    />
                                </div>
                                <p className="mt-2 text-muted" style={{ fontSize: '0.8125rem' }}>
                                    Live fetch from the GitHub REST API for microsoft/vscode. Check
                                    the browser console for the onStats callback result.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GithubStarsCardDemo
