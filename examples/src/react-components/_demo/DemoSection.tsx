import type { FC, ReactNode } from 'react'

export interface DemoSectionProps {
	eyebrow?: string
	title: ReactNode
	caption?: ReactNode
	aside?: ReactNode
	children: ReactNode
	flush?: boolean
}

/**
 * A titled section inside a DemoPage. Renders an eyebrow / title / caption
 * masthead followed by a flat content surface. `flush` removes the padding
 * around the body for cases where the child already has its own container.
 */
export const DemoSection: FC<DemoSectionProps> = ({
	eyebrow,
	title,
	caption,
	aside,
	flush,
	children,
}) => (
	<section className="demo-section">
		<div className="demo-section__head">
			<div className="demo-section__head-text">
				{eyebrow && <span className="demo-section__eyebrow">{eyebrow}</span>}
				<h2 className="demo-section__title">{title}</h2>
				{caption && <p className="demo-section__caption">{caption}</p>}
			</div>
			{aside && <div className="demo-section__aside">{aside}</div>}
		</div>
		<div className={`demo-section__body${flush ? ' demo-section__body--flush' : ''}`}>{children}</div>
	</section>
)

export default DemoSection
