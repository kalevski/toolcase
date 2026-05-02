import React from 'react'

export interface NavIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string
    size?: number
}

const baseStyle = (size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'rgba(15,18,24,0.7)',
    color: '#e6e8ec',
    border: '1px solid rgba(255,255,255,0.15)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: size * 0.45,
})

export const BackButton = React.forwardRef<HTMLButtonElement, NavIconButtonProps>(({ label, size = 36, style, ...props }, ref) => (
    <button ref={ref} type="button" aria-label={label ?? 'Back'} {...props} style={{ ...baseStyle(size), ...style }}>
        ←
    </button>
))
BackButton.displayName = 'BackButton'

export const CloseButton = React.forwardRef<HTMLButtonElement, NavIconButtonProps>(({ label, size = 36, style, ...props }, ref) => (
    <button ref={ref} type="button" aria-label={label ?? 'Close'} {...props} style={{ ...baseStyle(size), ...style }}>
        ✕
    </button>
))
CloseButton.displayName = 'CloseButton'
