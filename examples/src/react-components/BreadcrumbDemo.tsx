import React from 'react'
import { Breadcrumb } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const basicItems = [
	{ label: 'Home', href: '#' },
	{ label: 'Products', href: '#' },
	{ label: 'Shoes', href: '#' },
	{ label: 'Running' },
]

const longItems = [
	{ label: 'Home', href: '#' },
	{ label: 'Settings', href: '#' },
	{ label: 'Organization', href: '#' },
	{ label: 'Teams', href: '#' },
	{ label: 'Backend Engineers', href: '#' },
	{ label: 'Current Member' },
]

export const BreadcrumbDemo: React.FC = () => {
	return (
		<DemoPage
			eyebrow="Navigation"
			title="Breadcrumb"
			lede="Navigation trail showing the current page's position in the hierarchy."
		>
			<DemoSection title="Default (slash separator)">
				<Breadcrumb items={basicItems} />
			</DemoSection>

			<DemoSection title="Custom separator">
				<Breadcrumb items={basicItems} separator="›" />
			</DemoSection>

			<DemoSection title="Collapsed — maxItems=3" caption="Click the ellipsis to expand the full path.">
				<Breadcrumb items={longItems} maxItems={3} />
			</DemoSection>
		</DemoPage>
	)
}

export default BreadcrumbDemo
