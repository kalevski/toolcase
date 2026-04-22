import type { FC, ReactNode } from 'react'

export interface DemoRowProps {
	label?: ReactNode
	children: ReactNode
}

/**
 * A labeled row for showing one variant/state side-by-side with its name.
 * Great for "Default · Loading · Disabled" style displays.
 */
export const DemoRow: FC<DemoRowProps> = ({ label, children }) => (
	<div className="demo-row">
		{label && <div className="demo-row__label">{label}</div>}
		<div className="demo-row__content">{children}</div>
	</div>
)

export default DemoRow
