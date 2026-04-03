import React from 'react'
import { Card, CodeSnippet, Divider } from '../../src'

const DividerDemo: React.FC = () => (
	<div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
		<h2>Divider</h2>

		<div>
			<h5>Default (horizontal)</h5>
			<p>Content above</p>
			<Divider />
			<p>Content below</p>
		</div>

		<div>
			<h5>Horizontal with label</h5>
			<Divider label="or" />
		</div>

		<div>
			<h5>Horizontal with longer label</h5>
			<Divider label="section break" />
		</div>

		<div>
			<h5>Vertical</h5>
			<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: 80 }}>
				<span>Left</span>
				<Divider vertical />
				<span>Right</span>
			</div>
		</div>

		<div>
			<h5>Vertical with label</h5>
			<div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', height: 120 }}>
				<span>Left</span>
				<Divider vertical label="or" />
				<span>Right</span>
			</div>
		</div>

	<div>
		<Card>
			<h2 className="h5 mb-3">Usage</h2>
			<CodeSnippet
				language="typescript"
				code={`import { Divider } from '@webgame-cloud/react-components'

<Divider />
<Divider label="OR" />
<Divider vertical />`}
			/>
		</Card>
	</div>
	</div>
)

export default DividerDemo
