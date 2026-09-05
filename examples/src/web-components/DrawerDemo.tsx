import React, { useRef, useState, useEffect } from 'react'
import type { DrawerSide, DrawerSize } from '@toolcase/web-components'

type DrawerVariant = {
    side: DrawerSide
    size?: DrawerSize
    pinned?: boolean
    title: string
    description: string
}

const VARIANTS: DrawerVariant[] = [
    {
        side: 'right',
        title: 'Right Drawer',
        description:
            'Default — slides in from the right edge. Press Escape or click the backdrop to close.',
    },
    { side: 'left', title: 'Left Drawer', description: 'Slides in from the left edge.' },
    { side: 'top', title: 'Top Drawer', description: 'Slides down from the top edge.' },
    { side: 'bottom', title: 'Bottom Drawer', description: 'Slides up from the bottom edge.' },
    {
        side: 'right',
        size: 'small',
        title: 'Small Drawer',
        description: 'Uses size="small" for a narrower panel.',
    },
    {
        side: 'right',
        size: 'large',
        title: 'Large Drawer',
        description: 'Uses size="large" for a wide panel.',
    },
    {
        side: 'right',
        pinned: true,
        title: 'Pinned Drawer',
        description:
            'No backdrop, no body scroll lock — the page stays interactive behind the panel. Close with the button or Escape.',
    },
]

const DrawerDemo: React.FC = () => {
    const [openIdx, setOpenIdx] = useState<number | null>(null)
    const drawerRefs = useRef<(HTMLElement | null)[]>(VARIANTS.map(() => null))

    useEffect(() => {
        const listeners: Array<() => void> = []
        VARIANTS.forEach((_, idx) => {
            const el = drawerRefs.current[idx]
            if (!el) return
            const handler = () => setOpenIdx(null)
            el.addEventListener('tc-close', handler)
            listeners.push(() => el.removeEventListener('tc-close', handler))
        })
        return () => listeners.forEach((remove) => remove())
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Drawer"
                            description="Slide-out panel with focus trap, keyboard handling, and optional pinned mode. Controlled component — fires tc-close when the user requests dismissal; set open to false to close."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            {VARIANTS.map((v, idx) => {
                                const sectionTitle = v.pinned
                                    ? 'pinned — no backdrop, no scroll lock'
                                    : v.size
                                      ? `size="${v.size}" — ${v.size} panel`
                                      : `side="${v.side}" — slide from ${v.side}`

                                const attrs: Record<string, string | boolean | undefined> = {
                                    title: v.title,
                                    side: v.side,
                                }
                                if (v.size) attrs.size = v.size
                                if (v.pinned) attrs.pinned = true

                                return (
                                    <tc-section-card key={idx} title={sectionTitle}>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => setOpenIdx(idx)}
                                        >
                                            Open {v.title.toLowerCase()}
                                        </button>
                                        {/* @ts-ignore */}
                                        <tc-drawer
                                            ref={(el: HTMLElement | null) => {
                                                drawerRefs.current[idx] = el
                                            }}
                                            title={v.title}
                                            side={v.side}
                                            size={v.size}
                                            open={openIdx === idx}
                                            pinned={v.pinned}
                                        >
                                            <p>{v.description}</p>
                                            {/* @ts-ignore */}
                                        </tc-drawer>
                                    </tc-section-card>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DrawerDemo
