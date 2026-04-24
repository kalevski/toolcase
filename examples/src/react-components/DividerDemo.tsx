import React from 'react'
import { Divider } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const DividerDemo: React.FC = () => (
	<DemoPage
		eyebrow="Layout & Surfaces"
		title="Divider"
		lede="A horizontal or vertical divider line with optional label for separating content."
	>
		<DemoSection title="Default (horizontal)">
			<p>Content above</p>
			<Divider />
			<p>Content below</p>
		</DemoSection>

		<DemoSection title="Horizontal with label">
			<Divider label="or" />
		</DemoSection>

		<DemoSection title="Horizontal with longer label">
			<Divider label="section break" />
		</DemoSection>

		<DemoSection title="Vertical">
			<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', height: 80 }}>
				<span>Left</span>
				<Divider vertical />
				<span>Right</span>
			</div>
		</DemoSection>

		<DemoSection title="Vertical with label">
			<div style={{ display: 'flex', alignItems: 'stretch', gap: '1rem', height: 120 }}>
				<span>Left</span>
				<Divider vertical label="or" />
				<span>Right</span>
			</div>
		</DemoSection>
	</DemoPage>
)

export default DividerDemo
