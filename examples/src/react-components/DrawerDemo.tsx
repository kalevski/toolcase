import React, { useState } from 'react'
import {
	Button,
	Drawer,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

export const DrawerDemo: React.FC = () => {
	const [rightOpen, setRightOpen] = useState(false)
	const [leftOpen, setLeftOpen] = useState(false)
	const [topOpen, setTopOpen] = useState(false)
	const [bottomOpen, setBottomOpen] = useState(false)
	const [smallOpen, setSmallOpen] = useState(false)
	const [largeOpen, setLargeOpen] = useState(false)
	const [noTitleOpen, setNoTitleOpen] = useState(false)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Overlays</RichPageHeaderChip>}
				title="Drawer"
				description="A panel that slides in from any edge of the viewport. Supports focus trap, Escape to close, and size variants."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Side">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Button variant="primary" onClick={() => setRightOpen(true)}>Right (default)</Button>
					<Button variant="secondary" onClick={() => setLeftOpen(true)}>Left</Button>
					<Button variant="info" onClick={() => setTopOpen(true)}>Top</Button>
					<Button variant="secondary" onClick={() => setBottomOpen(true)}>Bottom</Button>
				</div>
			</SectionCard>

			<SectionCard title="Size">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Button variant="primary" onClick={() => setSmallOpen(true)}>Small</Button>
					<Button variant="primary" onClick={() => setRightOpen(true)}>Default</Button>
					<Button variant="primary" onClick={() => setLargeOpen(true)}>Large</Button>
				</div>
			</SectionCard>

			<SectionCard title="Without header">
				<Button variant="secondary" onClick={() => setNoTitleOpen(true)}>Open (no title)</Button>
			</SectionCard>

			{/* Drawers */}
			<Drawer open={rightOpen} onClose={() => setRightOpen(false)} side="right" title="Right Drawer">
				<p className="text-muted">This drawer slides in from the <strong>right</strong>.</p>
				<p>Press <kbd>Escape</kbd> or click the backdrop to close.</p>
				<Button variant="secondary" onClick={() => setRightOpen(false)}>Close</Button>
			</Drawer>

			<Drawer open={leftOpen} onClose={() => setLeftOpen(false)} side="left" title="Left Drawer">
				<p className="text-muted">This drawer slides in from the <strong>left</strong>.</p>
				<Button variant="secondary" onClick={() => setLeftOpen(false)}>Close</Button>
			</Drawer>

			<Drawer open={topOpen} onClose={() => setTopOpen(false)} side="top" title="Top Drawer">
				<p className="text-muted">This drawer slides in from the <strong>top</strong>.</p>
				<Button variant="secondary" onClick={() => setTopOpen(false)}>Close</Button>
			</Drawer>

			<Drawer open={bottomOpen} onClose={() => setBottomOpen(false)} side="bottom" title="Bottom Drawer">
				<p className="text-muted">This drawer slides in from the <strong>bottom</strong>.</p>
				<Button variant="secondary" onClick={() => setBottomOpen(false)}>Close</Button>
			</Drawer>

			<Drawer open={smallOpen} onClose={() => setSmallOpen(false)} side="right" size="small" title="Small Drawer">
				<p className="text-muted">Width: <strong>280px</strong></p>
				<Button variant="secondary" onClick={() => setSmallOpen(false)}>Close</Button>
			</Drawer>

			<Drawer open={largeOpen} onClose={() => setLargeOpen(false)} side="right" size="large" title="Large Drawer">
				<p className="text-muted">Width: <strong>560px</strong></p>
				<Button variant="secondary" onClick={() => setLargeOpen(false)}>Close</Button>
			</Drawer>

			<Drawer open={noTitleOpen} onClose={() => setNoTitleOpen(false)} side="right">
				<p className="text-muted mb-3">No header — content only.</p>
				<Button variant="secondary" onClick={() => setNoTitleOpen(false)}>Close</Button>
			</Drawer>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default DrawerDemo
