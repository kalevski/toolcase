import React from 'react'
import {
	Breadcrumb,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Navigation</RichPageHeaderChip>}
				title="Breadcrumb"
				description="Navigation trail showing the current page's position in the hierarchy."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Default (slash separator)">
				<Breadcrumb items={basicItems} />
			</SectionCard>

			<SectionCard title="Custom separator">
				<Breadcrumb items={basicItems} separator="›" />
			</SectionCard>

			<SectionCard title="Collapsed — maxItems=3">
				<Breadcrumb items={longItems} maxItems={3} />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default BreadcrumbDemo
