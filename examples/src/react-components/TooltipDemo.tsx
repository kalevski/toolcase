import React from 'react'
import { Tooltip, Card, CodeSnippet } from '@toolcase/react-components'

const TooltipDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Tooltip</h1>
				<p className="text-muted mb-5">
					Hover/focus tooltip that appears on top, bottom, left, or right of its child element.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Positions</h2>
					<div className="d-flex gap-4 flex-wrap align-items-center" style={{ padding: '2rem' }}>
						<Tooltip content="Top tooltip" position="top">
							<button className="btn btn-outline-secondary btn-sm">Top</button>
						</Tooltip>
						<Tooltip content="Bottom tooltip" position="bottom">
							<button className="btn btn-outline-secondary btn-sm">Bottom</button>
						</Tooltip>
						<Tooltip content="Left tooltip" position="left">
							<button className="btn btn-outline-secondary btn-sm">Left</button>
						</Tooltip>
						<Tooltip content="Right tooltip" position="right">
							<button className="btn btn-outline-secondary btn-sm">Right</button>
						</Tooltip>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Rich Content</h2>
					<div className="d-flex gap-4 flex-wrap align-items-center" style={{ padding: '2rem' }}>
						<Tooltip content={<span><strong>Bold</strong> and <em>italic</em> content</span>}>
							<span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>Hover me</span>
						</Tooltip>
						<Tooltip content="This is a helpful hint for the icon">
							<span style={{ cursor: 'help' }}><i className="bi bi-question-circle" /></span>
						</Tooltip>
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
						code={`import { Tooltip } from '@webgame-cloud/react-components'

<Tooltip content="Helpful info" position="top">
  <button>Hover me</button>
</Tooltip>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default TooltipDemo
