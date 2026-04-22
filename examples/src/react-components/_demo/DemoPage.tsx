import type { FC, ReactNode } from 'react'
import './demo-shell.css'

export interface DemoPageProps {
	eyebrow?: string
	title: string
	lede?: ReactNode
	children?: ReactNode
}

/**
 * Container + masthead for a component demo page.
 * Used by every demo in `examples/src/react-components/`.
 */
export const DemoPage: FC<DemoPageProps> = ({ eyebrow, title, lede, children }) => (
	<div className="demo-page">
		<header className="demo-page__masthead">
			{eyebrow && <span className="demo-page__eyebrow">{eyebrow}</span>}
			<h1 className="demo-page__title">{title}</h1>
			{lede && <p className="demo-page__lede">{lede}</p>}
		</header>
		<div className="demo-page__body">{children}</div>
	</div>
)

export default DemoPage
