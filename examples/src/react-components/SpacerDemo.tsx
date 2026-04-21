import React from 'react'
import { Spacer, Card, CodeSnippet } from '@toolcase/react-components'

const SpacerDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Spacer</h1>
				<p className="text-muted mb-5">
					Flex spacer or fixed-size gap for layout spacing. Supports horizontal and vertical axis.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Flex Spacer (horizontal)</h2>
					<div className="d-flex align-items-center" style={{ border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
						<span>Left</span>
						<Spacer axis="horizontal" />
						<span>Right</span>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Fixed Size (vertical)</h2>
					<div style={{ border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
						<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Top Block</div>
						<Spacer size={24} axis="vertical" />
						<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Bottom Block (24px gap)</div>
						<Spacer size={48} axis="vertical" />
						<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Even Further (48px gap)</div>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Fixed Size (horizontal)</h2>
					<div className="d-flex" style={{ border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
						<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>A</div>
						<Spacer size={32} axis="horizontal" />
						<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>B (32px gap)</div>
						<Spacer size={64} axis="horizontal" />
						<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>C (64px gap)</div>
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
						code={`import { Spacer } from '@toolcase/react-components'

<Spacer size="md" />
<Spacer size="xl" />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default SpacerDemo
