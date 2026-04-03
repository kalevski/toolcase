import React from 'react'
import { Text, Card, CodeSnippet } from '@toolcase/react-components'

const TextDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Text</h1>
				<p className="text-muted mb-5">
					Semantic text component with variant, size, and polymorphic tag support.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Variants</h2>
					<div className="d-flex flex-column gap-3">
						<Text variant="default">Default text — standard body copy.</Text>
						<Text variant="muted">Muted text — secondary / helper content.</Text>
						<Text variant="code">const x = 42; // inline code</Text>
						<Text variant="mono">Monospace text — for IDs and hashes.</Text>
						<Text variant="truncate" style={{ maxWidth: 200 }}>
							This is a very long text that should be truncated with an ellipsis when it overflows.
						</Text>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Sizes</h2>
					<div className="d-flex flex-column gap-3">
						<Text size="small">Small text</Text>
						<Text size="default">Default text</Text>
						<Text size="large">Large text</Text>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Polymorphic Tag</h2>
					<div className="d-flex flex-column gap-3">
						<Text as="p">Rendered as &lt;p&gt;</Text>
						<Text as="span">Rendered as &lt;span&gt;</Text>
						<Text as="small">Rendered as &lt;small&gt;</Text>
						<Text as="div">Rendered as &lt;div&gt;</Text>
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
					code={`import { Text } from '@webgame-cloud/react-components'

<Text>Default body text</Text>
<Text muted size="sm">Secondary info</Text>`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default TextDemo
