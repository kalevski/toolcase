import React from 'react'
import {
	ResizablePanel,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const panelStyle: React.CSSProperties = {
	padding: '1rem',
	background: '#f8fafc',
	height: '100%',
	overflow: 'auto',
}

export const ResizablePanelDemo: React.FC = () => {
	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="ResizablePanel"
				description="Split-pane layout with a draggable divider. Double-click the handle to reset sizes."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Horizontal split">
				<ResizablePanel
					defaultSizes={[40, 60]}
					direction="horizontal"
					style={{ height: 240, border: '1px solid #e2e8f0', overflow: 'hidden' }}
				>
					<div style={panelStyle}>
						<strong>Left Panel</strong>
						<p style={{ color: '#64748b', fontSize: '0.85rem' }}>Drag the divider to resize. Double-click to reset.</p>
					</div>
					<div style={panelStyle}>
						<strong>Right Panel</strong>
						<p style={{ color: '#64748b', fontSize: '0.85rem' }}>Content here.</p>
					</div>
				</ResizablePanel>
			</SectionCard>

			<SectionCard title="Vertical split">
				<ResizablePanel
					defaultSizes={[50, 50]}
					direction="vertical"
					style={{ height: 300, border: '1px solid #e2e8f0', overflow: 'hidden' }}
				>
					<div style={panelStyle}>
						<strong>Top Panel</strong>
					</div>
					<div style={panelStyle}>
						<strong>Bottom Panel</strong>
					</div>
				</ResizablePanel>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
