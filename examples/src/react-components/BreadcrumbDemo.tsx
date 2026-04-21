import React from 'react'
import { Breadcrumb, Card, CodeSnippet } from '@toolcase/react-components'

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
	const usageCode = `import { Breadcrumb } from '@toolcase/react-components'

const items = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Running Shoes' },
]

<Breadcrumb items={items} />
<Breadcrumb items={items} separator=">" />
<Breadcrumb items={items} maxItems={3} />`

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Breadcrumb</h1>
					<p className="text-muted mb-0">Navigation trail showing the current page's position in the hierarchy.</p>
				</div>
			</div>

			{/* Default */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Default (slash separator)</h2>
						<Breadcrumb items={basicItems} />
					</Card>
				</div>
			</div>

			{/* Custom separator */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Custom separator</h2>
						<Breadcrumb items={basicItems} separator="›" />
					</Card>
				</div>
			</div>

			{/* Collapsed with maxItems */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Collapsed — maxItems=3</h2>
						<p className="text-muted small mb-3">Click the ellipsis to expand the full path.</p>
						<Breadcrumb items={longItems} maxItems={3} />
					</Card>
				</div>
			</div>

			{/* Code */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}

export default BreadcrumbDemo
