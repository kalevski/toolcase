import React from 'react'
import { Tooltip } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const TooltipDemo: React.FC = () => (
	<DemoPage
		eyebrow="Overlays"
		title="Tooltip"
		lede="Hover/focus tooltip that appears on top, bottom, left, or right of its child element."
	>
		<DemoSection title="Positions">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', padding: '2rem' }}>
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
		</DemoSection>

		<DemoSection title="Rich Content">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', padding: '2rem' }}>
				<Tooltip content={<span><strong>Bold</strong> and <em>italic</em> content</span>}>
					<span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>Hover me</span>
				</Tooltip>
				<Tooltip content="This is a helpful hint for the icon">
					<span style={{ cursor: 'help' }}><i className="bi bi-question-circle" /></span>
				</Tooltip>
			</div>
		</DemoSection>
	</DemoPage>
)

export default TooltipDemo
