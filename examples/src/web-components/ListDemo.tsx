import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

interface ListItem {
    id: string
    label?: string
    icon?: string
    meta?: string
    disabled?: boolean
}

const BASIC_ITEMS: ListItem[] = [
    { id: 'inbox', label: 'Inbox', icon: 'inbox', meta: '12' },
    { id: 'sent', label: 'Sent', icon: 'send', meta: '4' },
    { id: 'drafts', label: 'Drafts', icon: 'file-text', meta: '2' },
    { id: 'archive', label: 'Archive', icon: 'archive', meta: '89' },
    { id: 'trash', label: 'Trash', icon: 'trash-2' },
]

const EMOJI_ITEMS: ListItem[] = [
    { id: 'sword', label: 'Iron Long-sword', icon: '⚔', meta: '12 g' },
    { id: 'shield', label: 'Oak Buckler', icon: '🛡', meta: '8 g' },
    { id: 'potion', label: 'Mana Draught', icon: '✦', meta: '24 g' },
    { id: 'tome', label: 'Tome of Rites', icon: '◈', meta: '120 g', disabled: true },
    { id: 'key', label: 'Brass Key', icon: '☩', meta: '—' },
]

const NO_ICON_ITEMS: ListItem[] = [
    { id: 'alpha', label: 'Alpha release', meta: 'v0.1.0' },
    { id: 'beta', label: 'Beta release', meta: 'v0.5.0' },
    { id: 'rc', label: 'Release candidate', meta: 'v0.9.0' },
    { id: 'stable', label: 'Stable release', meta: 'v1.0.0' },
]

const ListDemo: React.FC = () => {
    const [basicSelected, setBasicSelected] = useState('inbox')
    const [emojiSelected, setEmojiSelected] = useState('sword')
    const [noIconSelected, setNoIconSelected] = useState('stable')

    const basicRef = useTc<HTMLElement>(
        { items: BASIC_ITEMS },
        { 'tc-select': (e: any) => setBasicSelected(e.detail.id) }
    )
    const emojiRef = useTc<HTMLElement>(
        { items: EMOJI_ITEMS },
        { 'tc-select': (e: any) => setEmojiSelected(e.detail.id) }
    )
    const noIconRef = useTc<HTMLElement>(
        { items: NO_ICON_ITEMS },
        { 'tc-select': (e: any) => setNoIconSelected(e.detail.id) }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="List"
                            description="Generic vertical selectable list with icon, label, and meta cells. Items are set via the JS items property; selection is tracked via selected-id and the tc-select event."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title={`Lucide icons — selected: ${basicSelected}`}>
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-list ref={basicRef} selected-id={basicSelected} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title={`Emoji icons — selected: ${emojiSelected}`}>
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-list ref={emojiRef} selected-id={emojiSelected} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title={`No icons — selected: ${noIconSelected}`}>
                                <div style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-list ref={noIconRef} selected-id={noIconSelected} />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ListDemo
