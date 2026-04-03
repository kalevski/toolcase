import React from 'react'
import { Link, Card, CodeSnippet } from '@toolcase/react-components'

const LinkDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Link</h1>
				<p className="text-muted mb-5">
					Styled anchor element with variant colors, underline control, and external link indicator.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Variants</h2>
					<div className="d-flex gap-3 flex-wrap">
						<Link href="#" variant="primary">Primary</Link>
						<Link href="#" variant="secondary">Secondary</Link>
						<Link href="#" variant="info">Info</Link>
						<Link href="#" variant="success">Success</Link>
						<Link href="#" variant="warning">Warning</Link>
						<Link href="#" variant="danger">Danger</Link>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Underline</h2>
					<div className="d-flex gap-3 flex-wrap">
						<Link href="#" underline="always">Always underlined</Link>
						<Link href="#" underline="hover">Underline on hover</Link>
						<Link href="#" underline="none">No underline</Link>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">External</h2>
					<div className="d-flex gap-3 flex-wrap">
						<Link href="https://example.com" external>External Link</Link>
						<Link href="https://example.com" external variant="info">External Info</Link>
					</div>
				</Card>
			</div>
		</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { Link } from '@webgame-cloud/react-components'

<Link href="/docs">Documentation</Link>
<Link href="https://example.com" external>External Link</Link>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default LinkDemo
