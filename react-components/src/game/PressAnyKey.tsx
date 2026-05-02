import React from 'react'

export interface PressAnyKeyProps {
    onContinue?: () => void
    text?: React.ReactNode
    /** Filter: only respond to certain keys. */
    keys?: string[]
    style?: React.CSSProperties
    className?: string
}

export const PressAnyKey: React.FC<PressAnyKeyProps> = ({ onContinue, text = 'Press any key to continue', keys, style, className }) => {
    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (keys && !keys.includes(event.key)) return
            event.preventDefault()
            onContinue?.()
        }
        const onClick = () => onContinue?.()
        window.addEventListener('keydown', onKey)
        window.addEventListener('mousedown', onClick)
        return () => {
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('mousedown', onClick)
        }
    }, [onContinue, keys])

    return (
        <div className={className} style={{ color: '#fff', fontSize: 18, opacity: 0.9, animation: 'pak-blink 1.5s ease-in-out infinite', textShadow: '0 2px 8px rgba(0,0,0,0.8)', cursor: 'pointer', ...style }}>
            {text}
            <style>{`@keyframes pak-blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
        </div>
    )
}
