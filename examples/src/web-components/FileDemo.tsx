import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const TAGS = [
    { id: 'design', label: 'Design', color: 'var(--tc-info, #0ea5e9)' },
    { id: 'review', label: 'Review', color: 'var(--tc-warning, #f59e0b)' },
    { id: 'approved', label: 'Approved', color: 'var(--tc-success, #10b981)' },
    { id: 'draft', label: 'Draft' },
]

const MENU_ITEMS = [
    { key: 'rename', label: 'Rename', icon: 'Pencil' },
    { key: 'duplicate', label: 'Duplicate', icon: 'Copy' },
    { key: 'download', label: 'Download', icon: 'Download' },
    { key: 'delete', label: 'Delete', icon: 'Trash2' },
]

const CATEGORIES = [
    { key: 'document', label: 'Document', description: 'Reports, contracts, notes' },
    { key: 'media', label: 'Media', description: 'Images, video, audio' },
    { key: 'archive', label: 'Archive', description: 'Compressed bundles' },
    { key: 'source', label: 'Source', description: 'Code and configuration' },
]

// Stable references — useTc reassigns an instance prop whenever its reference
// changes, and reassigning tagIds re-renders the chips (discarding in-place
// edits). Inline array literals here would reset the tags on every React render.
const INITIAL_TAG_IDS = ['design', 'review']

function downloadDemoFile(name: string) {
    const blob = new Blob([`toolcase tc-file demo download: ${name}\n`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.txt`
    a.click()
    URL.revokeObjectURL(url)
}

function EditableExample() {
    const [log, setLog] = useState<string[]>([])
    const ref = useTc<HTMLElement>(
        {
            tags: TAGS,
            tagIds: INITIAL_TAG_IDS,
            menuItems: MENU_ITEMS,
        },
        {
            'tc-name-change': (e: CustomEvent) => {
                setLog((prev) => [`name changed → "${e.detail.name}"`, ...prev].slice(0, 5))
            },
            'tc-menu-item-click': (e: CustomEvent) => {
                setLog((prev) => [`menu clicked → "${e.detail.key}"`, ...prev].slice(0, 5))
            },
        },
    )

    return (
        <div className="d-flex flex-column gap-3">
            {/* @ts-ignore */}
            <tc-file
                ref={ref}
                name="Q3-Report"
                extension=".pdf"
                format="PDF"
                size="2621440"
                items="12"
            />
            {log.length > 0 && (
                <ul className="list-unstyled mb-0 small text-muted">
                    {log.map((entry, i) => (
                        <li key={i}>
                            <code>{entry}</code>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

function FullFeaturedExample() {
    // Controlled state: tags and category live in React and flow back into the
    // element via useTc, so the demo survives re-renders without losing edits.
    const [tagIds, setTagIds] = useState<string[]>(['design'])
    const [category, setCategory] = useState('media')
    const [name, setName] = useState('brand-assets')
    const [log, setLog] = useState<string[]>([])
    const push = (entry: string) => setLog((prev) => [entry, ...prev].slice(0, 5))
    const ref = useTc<HTMLElement>(
        {
            tags: TAGS,
            tagIds,
            categories: CATEGORIES,
            menuItems: MENU_ITEMS,
        },
        {
            'tc-tags-change': (e: CustomEvent) => {
                setTagIds(e.detail.tagIds)
                push(`tags → [${e.detail.tagIds.join(', ')}]`)
            },
            'tc-category-change': (e: CustomEvent) => {
                setCategory(e.detail.category)
                push(`category → "${e.detail.category}"`)
            },
            'tc-name-change': (e: CustomEvent) => {
                setName(e.detail.name)
                push(`renamed → "${e.detail.name}"`)
            },
            'tc-menu-item-click': (e: CustomEvent) => {
                push(`menu → "${e.detail.key}"`)
            },
            'tc-items-click': (e: CustomEvent) => {
                push(`items clicked → ${e.detail.items} child files`)
            },
            'tc-action': () => {
                downloadDemoFile('brand-assets')
                push('download started (demo text file)')
            },
        },
    )

    const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? category
    const tagLabels = tagIds.map((id) => TAGS.find((t) => t.id === id)?.label ?? id)

    return (
        <div className="d-flex flex-column gap-3">
            {/* @ts-ignore */}
            <tc-file
                ref={ref}
                name="brand-assets"
                extension=".zip"
                format="ZIP"
                size="15728640"
                items="48"
                editable-tags
                category={category}
                category-placeholder="Category"
                action-icon="download"
                action-label="Download"
            />
            <p className="small text-muted mb-0">
                Extension-derived leading icon; name on top with compact category select and
                editable tag chips (× to remove, + to add) underneath; clickable child-file count,
                size, menu, and a trailing download button (downloads a small demo text file).
            </p>
            <p className="small mb-0">
                React state: <code>name = {name}</code> · <code>category = {categoryLabel}</code> ·{' '}
                <code>tags = [{tagLabels.join(', ')}]</code>
            </p>
            {log.length > 0 && (
                <ul className="list-unstyled mb-0 small text-muted">
                    {log.map((entry, i) => (
                        <li key={i}>
                            <code>{entry}</code>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

function ReadonlyExample() {
    const ref = useTc<HTMLElement>({ tags: TAGS, tagIds: ['approved'] })

    return (
        <>
            {/* @ts-ignore */}
            <tc-file
                ref={ref}
                readonly
                name="Hero-Image"
                extension=".png"
                format="PNG"
                size="5242880"
                items="0"
            />
        </>
    )
}

function LoadingExample() {
    const [loaded, setLoaded] = useState(false)

    return (
        <div className="d-flex flex-column gap-2">
            {/* @ts-ignore */}
            <tc-file loading />
            {/* @ts-ignore */}
            <tc-file loading />
            <button
                className="btn btn-sm btn-secondary mt-2"
                style={{ width: 'fit-content' }}
                onClick={() => setLoaded((v) => !v)}
            >
                {loaded ? 'Show loading' : 'Show content'}
            </button>
            {loaded && (
                /* @ts-ignore */
                <tc-file name="dataset" extension=".csv" format="CSV" size="65536" />
            )}
        </div>
    )
}

function CallbackPropertyExample() {
    const [lastAction, setLastAction] = useState<string | null>(null)
    const ref = useTc<HTMLElement>({
        menuItems: [
            { key: 'open', label: 'Open', icon: 'FolderOpen' },
            { key: 'share', label: 'Share', icon: 'Share2' },
        ],
        onMenuItemClick: (key: string) => setLastAction(key),
        onNameChange: (name: string) => setLastAction(`rename → ${name}`),
    })

    return (
        <div className="d-flex flex-column gap-2">
            {/* @ts-ignore */}
            <tc-file ref={ref} name="presentation" extension=".pptx" format="PPTX" size="8388608" />
            {lastAction && (
                <p className="small text-muted mb-0">
                    Last action: <code>{lastAction}</code>
                </p>
            )}
        </div>
    )
}

const FileDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="File"
                        description="File entry with editable name, format badge, byte size, nested item count, tag chips, and an action menu. Emits tc-name-change on rename and tc-menu-item-click on menu selection."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Editable file (with tags and menu)">
                            <EditableExample />
                        </tc-section-card>

                        <tc-section-card title="Full-featured (editable tags, category, action button)">
                            <FullFeaturedExample />
                        </tc-section-card>

                        <tc-section-card title="Readonly variant">
                            <ReadonlyExample />
                        </tc-section-card>

                        <tc-section-card title="Static examples">
                            <div className="d-flex flex-column gap-2">
                                {/* @ts-ignore */}
                                <tc-file
                                    name="architecture"
                                    extension=".png"
                                    format="PNG"
                                    size="2097152"
                                    items="3"
                                />
                                {/* @ts-ignore */}
                                <tc-file
                                    name="dataset"
                                    extension=".json"
                                    format="JSON"
                                    size="512000"
                                />
                                {/* @ts-ignore */}
                                <tc-file name="readme" extension=".md" size="4096" />
                                {/* @ts-ignore */}
                                <tc-file
                                    name="video-clip"
                                    extension=".mp4"
                                    format="MP4"
                                    size="52428800"
                                    items="1"
                                />
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Loading skeleton">
                            <LoadingExample />
                        </tc-section-card>

                        <tc-section-card title="Callback property (onMenuItemClick / onNameChange)">
                            <CallbackPropertyExample />
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default FileDemo
