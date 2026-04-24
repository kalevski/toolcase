import React, { useMemo, useState } from 'react'
import {
    Icon,
    Input,
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
    Text,
    tcIcons,
} from '@toolcase/react-components'

const allIconNames = Object.keys(tcIcons).sort()

const ToolcaseIconsDemo: React.FC = () => {
    const [query, setQuery] = useState('')
    const [copied, setCopied] = useState<string | null>(null)

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return allIconNames
        return allIconNames.filter((name) => name.includes(q))
    }, [query])

    const handleCopy = async (name: string) => {
        try {
            await navigator.clipboard.writeText(name)
            setCopied(name)
            window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1200)
        } catch {
            // no-op — clipboard may be unavailable in some contexts
        }
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Basic Components</RichPageHeaderChip>}
                        title="Toolcase Icons"
                        description={
                            <>
                                The full <code>tc</code> icon catalog — {allIconNames.length} hand-drawn 24×24 SVG
                                glyphs themed for game-dev. Use via{' '}
                                <code>{'<Icon set="tc" name="…" />'}</code>. Click a tile to copy its slug.
                            </>
                        }
                    />
                    <div className="mt-4 mb-4" style={{ maxWidth: 420 }}>
                        <Input
                            type="search"
                            placeholder="Filter icons by name…"
                            value={query}
                            onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
                        />
                    </div>
                    <SectionCard title={`Icons (${filtered.length})`}>
                        {filtered.length === 0 ? (
                            <Text as="p" variant="muted">No icons match "{query}".</Text>
                        ) : (
                            <div className="row g-2">
                                {filtered.map((name) => {
                                    const isCopied = copied === name
                                    return (
                                        <div key={name} className="col-6 col-sm-4 col-md-3 col-lg-2">
                                            <button
                                                type="button"
                                                className="toolcase-icons__tile"
                                                onClick={() => handleCopy(name)}
                                                aria-label={`Copy "${name}"`}
                                            >
                                                <Icon set="tc" name={name} size={28} decorative />
                                                <span className="toolcase-icons__slug">{name}</span>
                                                {isCopied && (
                                                    <span className="toolcase-icons__copied">Copied</span>
                                                )}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </SectionCard>
                </div>
            </div>

            <style>{`
                .toolcase-icons__tile {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 16px 8px;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #1e293b;
                    cursor: pointer;
                    transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
                    position: relative;
                }
                .toolcase-icons__tile:hover {
                    border-color: #1e293b;
                    background: #f8fafc;
                }
                .toolcase-icons__tile:focus-visible {
                    outline: 2px solid #1e293b;
                    outline-offset: 2px;
                }
                .toolcase-icons__slug {
                    font-size: 11px;
                    color: #64748b;
                    font-family: 'Ubuntu Mono', 'JetBrains Mono', 'SF Mono', Monaco, Consolas, monospace;
                    word-break: break-all;
                    text-align: center;
                    line-height: 1.3;
                }
                .toolcase-icons__copied {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    font-size: 10px;
                    font-weight: 600;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                    color: #ffffff;
                    background: #16a34a;
                    padding: 2px 6px;
                }
            `}</style>
        </div>
    )
}

export default ToolcaseIconsDemo
