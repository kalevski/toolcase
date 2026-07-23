import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const MENU_ITEMS = [
    { key: 'edit', icon: 'Pencil', label: 'Edit Bundle' },
    { key: 'duplicate', icon: 'Copy', label: 'Duplicate' },
    { key: 'build', icon: 'Play', label: 'Build Now' },
    { key: 'export', icon: 'Download', label: 'Export Config' },
    { key: 'divider-1', label: '', divider: true },
    { key: 'delete', icon: 'Trash2', label: 'Delete', danger: true },
]

const AssetBundleDemo: React.FC = () => {
    const [menuKey, setMenuKey] = useState<string | null>(null)
    const [advancedOpen, setAdvancedOpen] = useState<boolean | null>(null)
    const [buildTag, setBuildTag] = useState<string | null>(null)

    const fullRef = useTc<HTMLElement>(
        {
            includedTags: ['hud', 'buttons', 'icons'],
            excludedTags: ['debug', 'placeholder'],
            counts: { textures: 124, fonts: 8, configs: 3 },
            advanced: {
                compress: true,
                powerOfTwo: true,
                trim: false,
                padding: 2,
                algorithm: 'maxrects',
            },
            menuItems: MENU_ITEMS,
        },
        {
            'tc-menu-click': (e: CustomEvent) => setMenuKey(e.detail.key),
            'tc-advanced-toggle': (e: CustomEvent) => setAdvancedOpen(e.detail.open),
            'tc-build-tag-change': (e: CustomEvent) => setBuildTag(e.detail.tag),
        },
    )
    const godotRef = useTc<HTMLElement>({
        includedTags: ['hero', 'npc', 'enemy'],
        excludedTags: ['wip'],
        counts: { textures: 89, animations: 34, sounds: 12 },
        advanced: { compress: false, powerOfTwo: true, trim: true, padding: 0 },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="AssetBundle"
                            description="Asset bundle card showing target engine, included/excluded tags, file-type counts, build references, an action menu, and a collapsible Advanced packing section."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card
                                title={`Unity — full configuration${menuKey ? ` (menu: "${menuKey}")` : ''}${advancedOpen != null ? ` (advanced: ${advancedOpen ? 'open' : 'closed'})` : ''}${buildTag ? ` (build tag: "${buildTag}")` : ''}`}
                            >
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-bundle
                                        ref={fullRef}
                                        name="UI Sprites"
                                        target="unity"
                                        target-icon="Boxes"
                                        category="Interface"
                                        latest-build-ref="a1b3c9f"
                                        default-build-tag="v2.1-release"
                                        build-tag="nightly"
                                    />
                                </div>
                                <p className="mt-2 mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                    Toggle <em>Advanced</em> and switch the build-tag chips — events
                                    are logged in the card title above (<code>tc-menu-click</code>,{' '}
                                    <code>tc-advanced-toggle</code>,{' '}
                                    <code>tc-build-tag-change</code>).
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Godot — character pack">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-bundle
                                        ref={godotRef}
                                        name="Character Sprites"
                                        target="godot"
                                        target-icon="Gamepad2"
                                        category="Characters"
                                        latest-build-ref="sprint-14"
                                        default-build-tag="sprint-14"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                <div style={{ maxWidth: 420 }}>
                                    {/* @ts-ignore */}
                                    <tc-asset-bundle loading />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AssetBundleDemo
