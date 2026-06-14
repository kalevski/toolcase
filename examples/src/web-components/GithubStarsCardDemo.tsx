import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const GithubStarsCardDemo: React.FC = () => {
    const staticRef = useRef<any>(null)
    const liveRef = useRef<any>(null)
    const fullRef = useRef<any>(null)

    useEffect(() => {
        if (!staticRef.current) return
        staticRef.current.stats = {
            stars: 4800,
            forks: 312,
            contributors: 47,
            version: 'v3.2.1',
        }
    }, [])

    useEffect(() => {
        if (!fullRef.current) return
        fullRef.current.stats = {
            stars: 12300,
            forks: 780,
            contributors: 93,
            version: 'v2.0.0',
        }
        fullRef.current.addEventListener('tc-stats', (e: CustomEvent) => {
            console.log('[GithubStarsCard] tc-stats event', e.detail)
        })
        fullRef.current.addEventListener('tc-cta-click', (e: CustomEvent) => {
            console.log('[GithubStarsCard] tc-cta-click event', e.detail)
        })
    }, [])

    useEffect(() => {
        if (!liveRef.current) return
        liveRef.current.onStats = (stats: unknown) => {
            console.log('[GithubStarsCard] onStats callback', stats)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="GithubStarsCard"
                            description="GitHub repository card showing stars, forks, contributors, version, and a CTA. Supports pre-fetched stats via the stats JS property or live fetch from the GitHub API via fetch-live."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Static stats (via JS property)">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-github-stars-card
                                        ref={staticRef}
                                        owner="toolcase"
                                        repo="toolcase"
                                        cta-label="Star on GitHub"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Partial stats (stars + version only)">
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-github-stars-card
                                        owner="kalevski"
                                        repo="toolcase"
                                        cta-label="View repository"
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Full static stats + custom CTA label + event listeners">
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
                                    fetch-live is set — card shows a skeleton then populates from the GitHub API.
                                    Pre-set stats appear immediately; live values override once the fetch resolves.
                                    Check the browser console for tc-stats and tc-cta-click events.
                                </p>
                            </SectionCard>

                            <SectionCard title="Live fetch (fetch-live attribute — real GitHub API)">
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
                                    Live fetch from the GitHub REST API for microsoft/vscode. Check the browser
                                    console for the onStats callback result.
                                </p>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GithubStarsCardDemo
