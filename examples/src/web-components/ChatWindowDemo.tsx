import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

interface ChatMessage {
    id: string
    channel?: string
    sender: string
    body: string
    color?: string
    system?: boolean
}

interface ChatChannel {
    id: string
    label: string
    color?: string
}

const CHANNELS: ChatChannel[] = [
    { id: 'general', label: 'General' },
    { id: 'trade', label: 'Trade', color: 'var(--tc-success)' },
    { id: 'help', label: 'Help', color: 'var(--tc-info)' },
]

const INITIAL_MESSAGES: ChatMessage[] = [
    { id: 'm0', sender: 'system', body: 'Connected to general.', system: true },
    { id: 'm1', sender: 'aria', body: 'morning all 👋', color: 'var(--tc-info)' },
    {
        id: 'm2',
        sender: 'kade',
        body: 'anyone running the raid tonight?',
        color: 'var(--tc-success)',
    },
    { id: 'm3', sender: 'aria', body: 'I am in, give me 10', color: 'var(--tc-info)' },
    { id: 'm4', sender: 'mox', body: 'selling spare keys, DM me', color: 'var(--tc-warning)' },
]

let _idCounter = 100

const ChatWindowDemo: React.FC = () => {
    const [lastSend, setLastSend] = useState<string | null>(null)
    const [activeChannel, setActiveChannel] = useState<string>('general')

    // Basic feed — messages only, no channels.
    const basicRef = useTc<HTMLElement>({ messages: [...INITIAL_MESSAGES] })

    // Channels feed — echoes whatever you send back into the log.
    const channelsRef = useTc<HTMLElement>(
        { channels: [...CHANNELS], messages: [...INITIAL_MESSAGES] },
        {
            'tc-send': (e: CustomEvent) => {
                const el = e.currentTarget as any
                const { channel, text } = e.detail
                el.messages = [
                    ...el.messages,
                    {
                        id: `you-${++_idCounter}`,
                        channel,
                        sender: 'you',
                        body: text,
                        color: 'var(--tc-app-accent)',
                    },
                ]
            },
        }
    )

    // Events demo — surfaces tc-send and tc-channel-change detail payloads.
    const eventsRef = useTc<HTMLElement>(
        { channels: [...CHANNELS], messages: [...INITIAL_MESSAGES] },
        {
            'tc-send': (e: CustomEvent) => {
                setLastSend(`channel="${e.detail.channel}" text="${e.detail.text}"`)
            },
            'tc-channel-change': (e: CustomEvent) => setActiveChannel(e.detail.id),
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ChatWindow"
                            description="Scrolling chat log with channel tabs and a compose row. Messages and channels are set via JS properties; sending fires tc-send and switching tabs fires tc-channel-change. Newest messages appear at the bottom."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — message log + compose">
                                {/* @ts-ignore */}
                                <tc-chat-window ref={basicRef} placeholder="Say something..." />
                            </tc-section-card>

                            <tc-section-card title="Channels — tabs + echo (your messages appear in the log)">
                                {/* @ts-ignore */}
                                <tc-chat-window
                                    ref={channelsRef}
                                    active-channel="general"
                                    placeholder="Message #general"
                                    height="320"
                                />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-send and tc-channel-change">
                                {/* @ts-ignore */}
                                <tc-chat-window ref={eventsRef} active-channel="general" />
                                <div className="form-text mt-2">
                                    Active channel: <code>{activeChannel}</code>
                                </div>
                                {lastSend && (
                                    <div className="form-text text-success">
                                        ✓ <code>tc-send</code> → {lastSend}
                                    </div>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChatWindowDemo
