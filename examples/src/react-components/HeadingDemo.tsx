import React from 'react'
import { Heading, Card, CodeSnippet } from '@toolcase/react-components'

const HeadingDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Heading</h1>
				<p className="text-muted mb-5">
					Semantic heading component with h1–h6 support and optional gradient styling.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Levels</h2>
					<div className="d-flex flex-column gap-3">
						<Heading as="h1">Heading 1</Heading>
						<Heading as="h2">Heading 2</Heading>
						<Heading as="h3">Heading 3</Heading>
						<Heading as="h4">Heading 4</Heading>
						<Heading as="h5">Heading 5</Heading>
						<Heading as="h6">Heading 6</Heading>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Gradient</h2>
					<div className="d-flex flex-column gap-3">
						<Heading as="h1" gradient>Gradient Heading 1</Heading>
						<Heading as="h2" gradient>Gradient Heading 2</Heading>
						<Heading as="h3" gradient>Gradient Heading 3</Heading>
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
					code={`import { Heading } from '@webgame-cloud/react-components'

<Heading level={1}>Page Title</Heading>
<Heading level={3} muted>Section Heading</Heading>`}
				/>
			</Card>
		</div>
	</div>
	</div>
)

export default HeadingDemo
