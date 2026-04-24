import React from 'react'
import { Spacer } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const SpacerDemo: React.FC = () => (
	<DemoPage
		eyebrow="Layout & Surfaces"
		title="Spacer"
		lede="Flex spacer or fixed-size gap for layout spacing. Supports horizontal and vertical axis."
	>
		<DemoSection title="Flex Spacer (horizontal)">
			<div style={{ display: 'flex', alignItems: 'center', border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
				<span>Left</span>
				<Spacer axis="horizontal" />
				<span>Right</span>
			</div>
		</DemoSection>

		<DemoSection title="Fixed Size (vertical)">
			<div style={{ border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
				<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Top Block</div>
				<Spacer size={24} axis="vertical" />
				<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Bottom Block (24px gap)</div>
				<Spacer size={48} axis="vertical" />
				<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Even Further (48px gap)</div>
			</div>
		</DemoSection>

		<DemoSection title="Fixed Size (horizontal)">
			<div style={{ display: 'flex', border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
				<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>A</div>
				<Spacer size={32} axis="horizontal" />
				<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>B (32px gap)</div>
				<Spacer size={64} axis="horizontal" />
				<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>C (64px gap)</div>
			</div>
		</DemoSection>
	</DemoPage>
)

export default SpacerDemo
