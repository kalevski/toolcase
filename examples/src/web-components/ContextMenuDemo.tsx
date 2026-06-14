import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ContextMenuDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const nestedRef = useRef<any>(null)
    const [lastKey, setLastKey] = useState<string | null>(null)

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.items = [
            { key: 'copy', label: 'Copy', icon: 'Copy' },
            { key: 'cut', label: 'Cut', icon: 'Scissors' },
            { key: 'paste', label: 'Paste', icon: 'Clipboard', disabled: true },
            { key: 'sep-1', label: '', separator: true },
            { key: 'delete', label: 'Delete', icon: 'Trash2', danger: true },
        ]
        const handler = (e: Event) => {
            setLastKey((e as CustomEvent<{ key: string }>).detail.key)
        }
        basicRef.current.addEventListener('tc-select', handler)
        return () => basicRef.current?.removeEventListener('tc-select', handler)
    }, [])

    useEffect(() => {
        if (!nestedRef.current) return
        nestedRef.current.items = [
            { key: 'open', label: 'Open', icon: 'FolderOpen' },
            {
                key: 'share',
                label: 'Share',
                icon: 'Share2',
                children: [
                    { key: 'share-link', label: 'Copy link', icon: 'Link' },
                    { key: 'share-email', label: 'Send by email', icon: 'Mail' },
                    { key: 'share-sep', label: '', separator: true },
                    { key: 'share-export', label: 'Export…', icon: 'Download' },
                ],
            },
            { key: 'rename', label: 'Rename', icon: 'Pencil' },
            { key: 'sep-2', label: '', separator: true },
            { key: 'remove', label: 'Remove', icon: 'Trash2', danger: true },
        ]
        const handler = (e: Event) => {
            setLastKey((e as CustomEvent<{ key: string }>).detail.key)
        }
        nestedRef.current.addEventListener('tc-select', handler)
        return () => nestedRef.current?.removeEventListener('tc-select', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ContextMenu"
                            description="Right-click / long-press context menu with nested submenu support and full keyboard navigation. Set items via the items JS property; listen for tc-select events."
                        />

                        {lastKey && (
                            <div className="alert alert-info mt-3 py-2">
                                Last selected key: <strong>{lastKey}</strong>
                            </div>
                        )}

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic — right-click the area below">
                                <p className="text-muted small mb-3">
                                    Right-click (or long-press on touch) to open the context menu. Keyboard: Arrow keys to navigate, Enter/Space to select, Escape to close.
                                </p>
                                {/* @ts-ignore */}
                                <tc-context-menu ref={basicRef}>
                                    <div
                                        style={{
                                            height: 120,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px dashed var(--tc-border)',
                                            color: 'var(--tc-text-faint)',
                                            fontSize: '0.875rem',
                                            userSelect: 'none',
                                        }}
                                    >
                                        Right-click here
                                    </div>
                                </tc-context-menu>
                            </SectionCard>

                            <SectionCard title="With nested submenu">
                                <p className="text-muted small mb-3">
                                    The Share item has a nested submenu. Hover or press ArrowRight to open it.
                                </p>
                                {/* @ts-ignore */}
                                <tc-context-menu ref={nestedRef}>
                                    <div
                                        style={{
                                            height: 120,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px dashed var(--tc-border)',
                                            color: 'var(--tc-text-faint)',
                                            fontSize: '0.875rem',
                                            userSelect: 'none',
                                        }}
                                    >
                                        Right-click here (nested submenu)
                                    </div>
                                </tc-context-menu>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ContextMenuDemo
