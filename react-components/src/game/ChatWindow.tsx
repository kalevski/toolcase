import React from 'react'

export interface ChatMessage {
    id: string
    channel?: string
    sender: React.ReactNode
    body: React.ReactNode
    color?: string
    timestamp?: number
    system?: boolean
}

export interface ChatChannel {
    id: string
    label: string
    color?: string
}

export interface ChatWindowProps {
    messages: ChatMessage[]
    channels?: ChatChannel[]
    activeChannel?: string
    onChannelChange?: (id: string) => void
    onSend?: (channel: string, text: string) => void
    placeholder?: string
    height?: number | string
    width?: number | string
    style?: React.CSSProperties
    className?: string
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, channels = [], activeChannel, onChannelChange, onSend, placeholder = 'Press Enter to chat', height = 200, width = 360, style, className }) => {
    const [text, setText] = React.useState('')
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const ch = activeChannel ?? channels[0]?.id

    React.useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages])

    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', width, height, background: 'rgba(8,10,14,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, color: '#e6e8ec', fontSize: 12, ...style }}>
            {channels.length > 0 && (
                <div style={{ display: 'flex', gap: 2, padding: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {channels.map((channel) => (
                        <button key={channel.id} type="button" onClick={() => onChannelChange?.(channel.id)} style={{ background: ch === channel.id ? 'rgba(255,255,255,0.1)' : 'transparent', color: channel.color ?? '#e6e8ec', border: 'none', padding: '4px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11 }}>{channel.label}</button>
                    ))}
                </div>
            )}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
                {messages.map((message) => (
                    <div key={message.id} style={{ marginBottom: 2, opacity: message.system ? 0.7 : 1 }}>
                        {message.channel && <span style={{ opacity: 0.6 }}>[{message.channel}] </span>}
                        {!message.system && <span style={{ color: message.color ?? '#6aa9ff', fontWeight: 600 }}>{message.sender}: </span>}
                        <span>{message.body}</span>
                    </div>
                ))}
            </div>
            {onSend && (
                <form onSubmit={(event) => { event.preventDefault(); if (text && ch) { onSend(ch, text); setText('') } }} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <input value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} style={{ flex: 1, background: 'transparent', color: '#e6e8ec', border: 'none', padding: 6, outline: 'none', fontSize: 12 }} />
                </form>
            )}
        </div>
    )
}
