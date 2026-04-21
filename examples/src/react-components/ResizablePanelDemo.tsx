import React from 'react'
import { ResizablePanel, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { ResizablePanel } from '@toolcase/react-components'

<ResizablePanel defaultSizes={[40, 60]} direction="horizontal" style={{ height: 300 }}>
  <div>Left panel</div>
  <div>Right panel</div>
</ResizablePanel>`

const panelStyle: React.CSSProperties = {
	padding: '1rem',
	background: '#f8fafc',
	height: '100%',
	overflow: 'auto',
}

export const ResizablePanelDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ResizablePanel</h1>
					<p className="text-muted mb-0">Split-pane layout with a draggable divider. Double-click the handle to reset sizes.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Horizontal split</h2>
						<ResizablePanel
							defaultSizes={[40, 60]}
							direction="horizontal"
							style={{ height: 240, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}
						>
							<div style={panelStyle}>
								<strong>Left Panel</strong>
								<p className="text-muted" style={{ fontSize: '0.85rem' }}>Drag the divider to resize. Double-click to reset.</p>
							</div>
							<div style={panelStyle}>
								<strong>Right Panel</strong>
								<p className="text-muted" style={{ fontSize: '0.85rem' }}>Content here.</p>
							</div>
						</ResizablePanel>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Vertical split</h2>
						<ResizablePanel
							defaultSizes={[50, 50]}
							direction="vertical"
							style={{ height: 300, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}
						>
							<div style={panelStyle}>
								<strong>Top Panel</strong>
							</div>
							<div style={panelStyle}>
								<strong>Bottom Panel</strong>
							</div>
						</ResizablePanel>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
