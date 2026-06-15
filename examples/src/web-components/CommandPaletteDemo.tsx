import React, { useRef, useState, useEffect } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

interface CommandPaletteItem {
    id: string
    label: string
    group?: string
    icon?: string
    shortcut?: string
    keywords?: string[]
}

const ITEMS: CommandPaletteItem[] = [
    { id: 'new-file', label: 'New File', group: 'File', icon: 'file-plus', shortcut: '⌘ N', keywords: ['create', 'document'] },
    { id: 'open-file', label: 'Open File…', group: 'File', icon: 'folder-open', shortcut: '⌘ O', keywords: ['browse'] },
    { id: 'save', label: 'Save', group: 'File', icon: 'save', shortcut: '⌘ S' },
    { id: 'cut', label: 'Cut', group: 'Edit', icon: 'scissors', shortcut: '⌘ X' },
    { id: 'copy', label: 'Copy', group: 'Edit', icon: 'copy', shortcut: '⌘ C' },
    { id: 'paste', label: 'Paste', group: 'Edit', icon: 'clipboard', shortcut: '⌘ V' },
    { id: 'find', label: 'Find in File', group: 'Edit', icon: 'search', shortcut: '⌘ F', keywords: ['search'] },
    { id: 'toggle-theme', label: 'Toggle Dark Theme', group: 'View', icon: 'moon', keywords: ['dark', 'light', 'appearance'] },
    { id: 'zen', label: 'Enter Zen Mode', group: 'View', icon: 'maximize', keywords: ['fullscreen', 'focus'] },
    { id: 'settings', label: 'Open Settings', group: 'View', icon: 'settings', shortcut: '⌘ ,' },
]

const CommandPaletteDemo: React.FC = () => {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [lastSelected, setLastSelected] = useState<string | null>(null)
    const paletteRef = useRef<any>(null)

    // JS-property + events must be wired via ref (React can't set object props
    // as attributes, and listens for the tc-* CustomEvents).
    useEffect(() => {
        const el = paletteRef.current
        if (!el) return
        el.items = ITEMS

        const onSelect = (e: Event) => {
            const item = (e as CustomEvent).detail.item as CommandPaletteItem
            setLastSelected(item.label)
            setOpen(false)
        }
        const onClose = () => setOpen(false)

        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-close', onClose)
        return () => {
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-close', onClose)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Command Palette"
                            description="Modal command-search overlay with fuzzy filtering, grouped results, shortcut chips, and full keyboard navigation. Controlled component — fires tc-select / tc-close; set open to false to dismiss."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Interactive — ⌘K style launcher">
                                <div className="d-flex align-items-center gap-3 flex-wrap">
                                    <button className="btn btn-primary" onClick={() => { setLoading(false); setOpen(true) }}>
                                        Open command palette
                                    </button>
                                    <button className="btn btn-outline-secondary" onClick={() => { setLoading(true); setOpen(true) }}>
                                        Open in loading state
                                    </button>
                                    {lastSelected && (
                                        <span className="text-muted small">
                                            Last selected: <strong>{lastSelected}</strong>
                                        </span>
                                    )}
                                </div>
                                <p className="text-muted small mt-3 mb-0">
                                    Type to filter, ↑/↓ to navigate, ↵ to select, Esc or backdrop click to close.
                                </p>

                                {/* @ts-ignore */}
                                <tc-command-palette
                                    ref={paletteRef}
                                    open={open || undefined}
                                    loading={loading || undefined}
                                    placeholder="Type a command or search…"
                                />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CommandPaletteDemo
