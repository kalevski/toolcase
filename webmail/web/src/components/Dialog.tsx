import type { ReactNode } from 'react'

type Props = {
    open: boolean
    title: string
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    size?: 'sm' | 'lg' | 'xl'
}

/**
 * A bottom sheet, controlled, the same container the dashboard uses for its forms. The sheet closes itself on
 * Escape, its grabber and the scrim and reports it with tc-sheet-close; we mirror that into state. Body content is
 * only mounted while open so forms start fresh each time.
 */
export function Dialog({ open, title, onClose, children, footer, size }: Props) {
    return (
        <tc-bottom-sheet
            heading={title}
            open={open}
            snap={size === 'lg' || size === 'xl' ? 'full' : 'auto'}
            ontc-sheet-close={() => onClose()}
        >
            {open ? (
                <div className="wm-dialog-body">
                    {children}
                    {footer ? <div className="wm-dialog-footer">{footer}</div> : null}
                </div>
            ) : null}
        </tc-bottom-sheet>
    )
}
