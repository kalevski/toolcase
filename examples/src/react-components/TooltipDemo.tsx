import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Tooltip
} from '@toolcase/react-components'

const TooltipDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Overlays</RichPageHeaderChip>}
				title="Tooltip"
				description="Hover/focus tooltip that appears on top, bottom, left, or right of its child element."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Positions">
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
		</SectionCard>

		<SectionCard title="Rich Content">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', padding: '2rem' }}>
				<Tooltip content={<span><strong>Bold</strong> and <em>italic</em> content</span>}>
					<span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>Hover me</span>
				</Tooltip>
				<Tooltip content="This is a helpful hint for the icon">
					<span style={{ cursor: 'help' }}><i className="bi bi-question-circle" /></span>
				</Tooltip>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default TooltipDemo
