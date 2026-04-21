import React, { useState } from 'react'
import { Drawer, Button, Card, CodeSnippet } from '@toolcase/react-components'

export const DrawerDemo: React.FC = () => {
	const [rightOpen, setRightOpen] = useState(false)
	const [leftOpen, setLeftOpen] = useState(false)
	const [topOpen, setTopOpen] = useState(false)
	const [bottomOpen, setBottomOpen] = useState(false)
	const [smallOpen, setSmallOpen] = useState(false)
	const [largeOpen, setLargeOpen] = useState(false)
	const [noTitleOpen, setNoTitleOpen] = useState(false)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Drawer</h1>
					<p className="text-muted mb-0">A panel that slides in from any edge of the viewport. Supports focus trap, Escape to close, and size variants.</p>
				</div>
			</div>

			{/* Side variants */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Side</h2>
						<div className="d-flex flex-wrap gap-2">
							<Button variant="primary" onClick={() => setRightOpen(true)}>Right (default)</Button>
							<Button variant="secondary" onClick={() => setLeftOpen(true)}>Left</Button>
							<Button variant="info" onClick={() => setTopOpen(true)}>Top</Button>
							<Button variant="secondary" onClick={() => setBottomOpen(true)}>Bottom</Button>
						</div>
					</Card>
				</div>
			</div>

			{/* Size variants */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Size</h2>
						<div className="d-flex flex-wrap gap-2">
							<Button variant="primary" onClick={() => setSmallOpen(true)}>Small</Button>
							<Button variant="primary" onClick={() => setRightOpen(true)}>Default</Button>
							<Button variant="primary" onClick={() => setLargeOpen(true)}>Large</Button>
						</div>
					</Card>
				</div>
			</div>

			{/* Without title */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Without header</h2>
						<p className="text-muted small mb-3">Omit the <code>title</code> prop to render content only, no header bar.</p>
						<Button variant="secondary" onClick={() => setNoTitleOpen(true)}>Open (no title)</Button>
					</Card>
				</div>
			</div>

			{/* Code */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { Drawer, Button } from '@toolcase/react-components'

const [open, setOpen] = useState(false)

<Button onClick={() => setOpen(true)}>Open Drawer</Button>

<Drawer
  open={open}
  onClose={() => setOpen(false)}
  side="right"
  size="default"
  title="Settings"
>
  <p>Drawer content goes here.</p>
</Drawer>`}
						/>
					</Card>
				</div>
			</div>

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
	)
}
