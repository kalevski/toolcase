import React, { useEffect, useRef, useState } from 'react'

const ICON_OPTIONS = [
    { value: 'star', label: 'Star' },
    { value: 'heart', label: 'Heart' },
    { value: 'home', label: 'Home' },
    { value: 'search', label: 'Search' },
    { value: 'settings', label: 'Settings' },
    { value: 'user', label: 'User' },
    { value: 'bell', label: 'Bell' },
    { value: 'bookmark', label: 'Bookmark' },
    { value: 'camera', label: 'Camera' },
    { value: 'check', label: 'Check' },
    { value: 'circle', label: 'Circle' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'code', label: 'Code' },
    { value: 'copy', label: 'Copy' },
    { value: 'download', label: 'Download' },
    { value: 'edit', label: 'Edit' },
    { value: 'eye', label: 'Eye' },
    { value: 'file', label: 'File' },
    { value: 'filter', label: 'Filter' },
    { value: 'flag', label: 'Flag' },
    { value: 'folder', label: 'Folder' },
    { value: 'globe', label: 'Globe' },
    { value: 'hash', label: 'Hash' },
    { value: 'image', label: 'Image' },
    { value: 'inbox', label: 'Inbox' },
    { value: 'info', label: 'Info' },
    { value: 'key', label: 'Key' },
    { value: 'layers', label: 'Layers' },
    { value: 'link', label: 'Link' },
    { value: 'lock', label: 'Lock' },
    { value: 'mail', label: 'Mail' },
    { value: 'map', label: 'Map' },
    { value: 'menu', label: 'Menu' },
    { value: 'message-circle', label: 'Message' },
    { value: 'monitor', label: 'Monitor' },
    { value: 'moon', label: 'Moon' },
    { value: 'music', label: 'Music' },
    { value: 'package', label: 'Package' },
    { value: 'paperclip', label: 'Paperclip' },
    { value: 'pen', label: 'Pen' },
    { value: 'phone', label: 'Phone' },
    { value: 'play', label: 'Play' },
    { value: 'plus', label: 'Plus' },
    { value: 'printer', label: 'Printer' },
    { value: 'refresh-cw', label: 'Refresh' },
    { value: 'share', label: 'Share' },
    { value: 'shield', label: 'Shield' },
    { value: 'shopping-cart', label: 'Cart' },
    { value: 'sliders', label: 'Sliders' },
    { value: 'sun', label: 'Sun' },
    { value: 'tag', label: 'Tag' },
    { value: 'target', label: 'Target' },
    { value: 'terminal', label: 'Terminal' },
    { value: 'trash', label: 'Trash' },
    { value: 'trending-up', label: 'Trend' },
    { value: 'unlock', label: 'Unlock' },
    { value: 'upload', label: 'Upload' },
    { value: 'users', label: 'Users' },
    { value: 'video', label: 'Video' },
    { value: 'wifi', label: 'Wifi' },
    { value: 'x', label: 'Close' },
    { value: 'zap', label: 'Zap' },
    { value: 'zoom-in', label: 'Zoom In' },
]

const IconPickerDemo: React.FC = () => {
    const pickerRef = useRef<any>(null)
    const columnsRef = useRef<any>(null)
    const nolabelRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)

    const [selectedValue, setSelectedValue] = useState('star')

    useEffect(() => {
        const el = pickerRef.current
        if (!el) return
        el.icons = ICON_OPTIONS
        el.value = selectedValue
        const handler = (e: Event) => setSelectedValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = columnsRef.current
        if (!el) return
        el.icons = ICON_OPTIONS
    }, [])

    useEffect(() => {
        const el = nolabelRef.current
        if (!el) return
        el.icons = ICON_OPTIONS
        el.value = 'heart'
    }, [])

    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.icons = []
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="IconPicker"
                            description="Searchable icon-grid dropdown for selecting a lucide icon by name."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic usage">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-icon-picker ref={pickerRef} label="Choose an icon" />
                                    <div className="form-text mt-2">Selected: {selectedValue}</div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom columns (4)">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-icon-picker
                                        ref={columnsRef}
                                        label="Icon"
                                        columns="4"
                                        value="home"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="No label">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-icon-picker ref={nolabelRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                <div>
                                    {/* @ts-ignore */}
                                    <tc-icon-picker ref={loadingRef} label="Loading…" loading />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default IconPickerDemo
