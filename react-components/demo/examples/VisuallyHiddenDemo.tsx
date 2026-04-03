import React from 'react'
import { VisuallyHidden, Card, CodeSnippet } from '../../src'

const VisuallyHiddenDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">VisuallyHidden</h1>
				<p className="text-muted mb-5">
					Hides content visually while keeping it accessible to screen readers. Use the browser dev tools
					or a screen reader to confirm the hidden text is in the DOM.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Hidden Label for Icon Button</h2>
					<p className="text-muted mb-3">
						The button below only shows an icon, but has an accessible label for screen readers.
					</p>
					<button className="btn btn-outline-secondary">
						<i className="bi bi-heart-fill" />
						<VisuallyHidden>Add to favorites</VisuallyHidden>
					</button>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Skip Link</h2>
					<p className="text-muted mb-3">
						A common pattern for skip-navigation links. The text below is invisible but present in the DOM.
					</p>
					<VisuallyHidden as="div">
						Skip to main content
					</VisuallyHidden>
					<p>The hidden text &quot;Skip to main content&quot; exists in the DOM above this paragraph—inspect to verify.</p>
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
						code={`import { VisuallyHidden } from '@webgame-cloud/react-components'

<button>
  <Icon name="trash" />
  <VisuallyHidden>Delete item</VisuallyHidden>
</button>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default VisuallyHiddenDemo
