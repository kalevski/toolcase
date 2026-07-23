import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// ── Static tree data (set via the `.nodes` JS property) ──────────────────────────

const FILE_TREE = [
    {
        key: 'src',
        label: 'src',
        icon: 'folder',
        children: [
            {
                key: 'components',
                label: 'components',
                icon: 'folder',
                children: [
                    { key: 'button.ts', label: 'Button.ts', icon: 'file-code' },
                    { key: 'badge.ts', label: 'Badge.ts', icon: 'file-code' },
                    { key: 'tree-view.ts', label: 'TreeView.ts', icon: 'file-code' },
                ],
            },
            { key: 'index.ts', label: 'index.ts', icon: 'file-code' },
            { key: 'register.ts', label: 'register.ts', icon: 'file-code', disabled: true },
        ],
    },
    {
        key: 'style',
        label: 'style',
        icon: 'folder',
        children: [
            { key: 'index.scss', label: 'index.scss', icon: 'file' },
            { key: 'reset.scss', label: 'reset.scss', icon: 'file' },
        ],
    },
    { key: 'readme', label: 'README.md', icon: 'file-text' },
]

const PERMISSIONS = [
    {
        key: 'read',
        label: 'Read',
        icon: 'eye',
        children: [
            { key: 'read:files', label: 'Files' },
            { key: 'read:metadata', label: 'Metadata' },
        ],
    },
    {
        key: 'write',
        label: 'Write',
        icon: 'pencil',
        children: [
            { key: 'write:files', label: 'Files' },
            { key: 'write:share', label: 'Share links' },
        ],
    },
    { key: 'admin', label: 'Admin', icon: 'shield', disabled: true },
]

// An async branch — children are fetched on first expand (simulated latency).
const ASYNC_TREE = [
    {
        key: 'remote',
        label: 'Remote workspace',
        icon: 'cloud',
        loadChildren: () =>
            new Promise((resolve) =>
                setTimeout(
                    () =>
                        resolve([
                            { key: 'remote/app', label: 'app', icon: 'folder' },
                            { key: 'remote/api', label: 'api', icon: 'folder' },
                            { key: 'remote/readme', label: 'README.md', icon: 'file-text' },
                        ]),
                    900,
                ),
            ),
    },
    { key: 'local', label: 'Local cache', icon: 'hard-drive' },
]

const FILE_TREE_EXPANDED = ['src', 'components']
const PERMISSIONS_EXPANDED = ['read', 'write']

const TreeViewDemo: React.FC = () => {
    const [selected, setSelected] = useState<string>('—')
    const [checked, setChecked] = useState<string[]>([])
    const [expanded, setExpanded] = useState<string[]>(['src'])

    const singleRef = useTc<HTMLElement>(
        { nodes: FILE_TREE, expanded: FILE_TREE_EXPANDED },
        {
            'tc-select': (e: any) => setSelected(e.detail.keys[0] ?? '—'),
            'tc-expand-change': (e: any) => setExpanded(e.detail.keys),
        }
    )
    const checkboxRef = useTc<HTMLElement>(
        { nodes: PERMISSIONS, expanded: PERMISSIONS_EXPANDED },
        { 'tc-select': (e: any) => setChecked(e.detail.keys) }
    )
    const asyncRef = useTc<HTMLElement>({ nodes: ASYNC_TREE })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="TreeView"
                            description="Hierarchical tree navigation with expand/collapse, optional multi-select checkboxes, async lazy-loaded branches, and full keyboard support."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Single select — chevron expand, leaf select (JS property)">
                                <div
                                    style={{
                                        maxWidth: 360,
                                        border: '1px solid var(--tc-border, #e2e8f0)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-tree-view ref={singleRef} />
                                </div>
                                <p className="mt-3 mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                    Selected <code>tc-select</code>: <strong>{selected}</strong>
                                    {' · '}
                                    Expanded <code>tc-expand-change</code>:{' '}
                                    <strong>{expanded.join(', ') || '—'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Checkbox mode — multi-select with parent aggregation">
                                <div
                                    style={{
                                        maxWidth: 360,
                                        border: '1px solid var(--tc-border, #e2e8f0)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-tree-view ref={checkboxRef} checkbox-mode />
                                </div>
                                <p className="mt-3 mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                    Checked keys: <strong>{checked.join(', ') || '—'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Async branch — children fetched on first expand (spinner)">
                                <div
                                    style={{
                                        maxWidth: 360,
                                        border: '1px solid var(--tc-border, #e2e8f0)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-tree-view ref={asyncRef} />
                                </div>
                                <p className="mt-3 mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                    Expand <em>Remote workspace</em> to lazy-load its children.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TreeViewDemo
